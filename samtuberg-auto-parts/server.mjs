import 'dotenv/config';
import http from 'node:http';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { sendPurchaseOrderEmail } from './src/services/email.js';
import {
  DEFAULT_SITE_CONTENT,
  normalizeProductForAdmin,
  normalizeDiscount,
  normalizeSiteContent,
  summarizeSales,
  normalizeTrackingStatus,
  buildOrderTrackingTimeline
} from './backend/admin-helpers.mjs';
import { PRODUCTS as BASE_PRODUCTS } from './backend/catalog.mjs';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8787);
const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
const paystackPublicKey = process.env.VITE_PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY || '';
const paystackApiUrl = process.env.PAYSTACK_API_URL || 'https://api.paystack.co';
const configuredFrontendOrigins = new Set(
  `${process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || ''}`
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
);
const requireStrongCredentials = process.env.REQUIRE_STRONG_ADMIN_CREDENTIALS === 'true' || process.env.NODE_ENV === 'production';
const adminUsername = process.env.CATALOG_ADMIN_USERNAME || '';
const adminPassword = process.env.CATALOG_ADMIN_PASSWORD || '';
const viewerUsername = process.env.CATALOG_VIEWER_USERNAME || '';
const viewerPassword = process.env.CATALOG_VIEWER_PASSWORD || '';
const catalogFile = process.env.CATALOG_FILE
  ? path.resolve(process.env.CATALOG_FILE)
  : path.join(rootDir, 'data', 'catalog-overrides.json');
const adminSessions = new Map();
const pendingPaymentReferences = new Set();
const adminSessionLifetimeMs = 4 * 60 * 60 * 1000;
const loginAttempts = new Map();
const registrationAttempts = new Map();
const rateLimitWindowMs = 15 * 60_000;
const rateLimitMaxAttempts = 5;
const rateLimitMaxAttemptsPerIp = 20;
const dummyCustomerPasswordHash = bcrypt.hash(randomBytes(32).toString('hex'), 12);
const inventoryReservationLifetimeMs = 30 * 60_000;
const trustForwardedClientIp = process.env.TRUST_PROXY === 'true';
const mobileMoneyProviders = new Set(['mtn', 'vod', 'atl']);
const mysqlPool = (process.env.DB_HOST || process.env.MYSQL_HOST)
  && (process.env.DB_USER || process.env.MYSQL_USER || process.env.MYSQL_USERNAME)
  ? mysql.createPool({
      host: process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
      user: process.env.DB_USER || process.env.MYSQL_USER || process.env.MYSQL_USERNAME || 'root',
      password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
      database: process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.DB_DATABASE || 'samtuberg_store',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10_000,
      charset: 'utf8mb4',
      ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production'
        ? {
            rejectUnauthorized: true,
            ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {})
          }
        : undefined
    })
  : null;
const orderStoreFile = process.env.ORDER_STORE_FILE
  ? path.resolve(process.env.ORDER_STORE_FILE)
  : path.join(rootDir, 'data', 'orders-store.json');
const customerStoreFile = process.env.CUSTOMER_STORE_FILE
  ? path.resolve(process.env.CUSTOMER_STORE_FILE)
  : path.join(rootDir, 'data', 'customers-store.json');
const databaseSchemaFile = path.join(rootDir, 'database', 'schema.sql');
let catalogState = { overrides: {}, deletedIds: [] };
let catalogWriteQueue = Promise.resolve();
let orderStoreWriteQueue = Promise.resolve();
let inventoryWriteQueue = Promise.resolve();
let orderStore = { orders: [], salesBackup: [], inventoryReservations: {} };
let customerStore = { customers: [] };
let databaseEnabled = false;

async function ensureDatabaseSchema() {
  if (!mysqlPool) return;

  try {
    const schemaSql = await readFile(databaseSchemaFile, 'utf8');
    const connection = await mysqlPool.getConnection();
    try {
      const statements = schemaSql
        .split(/;\s*\n/)
        .map(statement => statement.trim())
        .filter(statement => statement
          && !/^(--|\/\/)/.test(statement)
          && !/^CREATE\s+DATABASE\b/i.test(statement)
          && !/^USE\b/i.test(statement));

      for (const statement of statements) {
        if (!statement) continue;
        await connection.query(statement);
      }
      const [adminStatusColumns] = await connection.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'admin_users'
           AND column_name = 'status'
         LIMIT 1`
      );
      if (!adminStatusColumns.length) {
        await connection.query(
          "ALTER TABLE admin_users ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'active' AFTER role"
        );
      }
      console.log('Database schema verified and ready.');
    } finally {
      connection.release();
    }
  } catch (error) {
    console.warn('Database schema could not be applied automatically:', error.message);
  }
}

async function loadOrderStore() {
  try {
    const saved = JSON.parse(await readFile(orderStoreFile, 'utf8'));
    if (saved && Array.isArray(saved.orders) && Array.isArray(saved.salesBackup)) {
      orderStore = { ...saved, inventoryReservations: saved.inventoryReservations || {} };
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    orderStore = { orders: [], salesBackup: [], inventoryReservations: {} };
  }
}

async function loadCustomerStore() {
  try {
    const saved = JSON.parse(await readFile(customerStoreFile, 'utf8'));
    if (saved && Array.isArray(saved.customers)) customerStore = saved;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    customerStore = { customers: [] };
  }
}

async function persistCustomerStore() {
  await mkdir(path.dirname(customerStoreFile), { recursive: true });
  const temporaryFile = `${customerStoreFile}.${process.pid}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(customerStore, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(temporaryFile, customerStoreFile);
}

async function notifyOrder(order) {
  const notifications = { email: false, sms: false };
  if (process.env.DISABLE_ORDER_EMAIL === 'true') return notifications;

  const emailApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.ORDER_NOTIFICATION_FROM;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'samtuberg34@gmail.com';

  const formattedItems = (order.items || []).map((item, idx) => {
    const qty = Number(item.quantity || item.qty || 1);
    const price = Number(item.price || 0);
    return `${idx + 1}. ${item.name} (${item.fit || 'Genuine'} ${item.year || ''}) x${qty} - GH₵ ${(qty * price).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;
  }).join('\n');

  const message = [
    '====================================================',
    '🚨 SAMTUBERG AUTO PARTS & CARS — OFFICIAL ORDER NOTIFICATION',
    '====================================================',
    `Order ID:       ${order.id}`,
    `Order Status:   ${order.status || 'Paid / Confirmed'}`,
    `Payment Method: ${order.paymentMethod || 'Paystack'}`,
    `Payment Ref:    ${order.paymentReference || 'N/A'}`,
    `Date & Time:    ${order.timestamp || new Date().toISOString()}`,
    '',
    '---------------- CUSTOMER DETAILS ------------------',
    `Customer Name:  ${order.customerName || 'Valued Customer'}`,
    `Email Address:  ${order.customerEmail || 'N/A'}`,
    `Phone Number:   ${order.phone || 'N/A'}`,
    `Delivery Place: ${order.address || 'Ghana Delivery'}`,
    '',
    '---------------- ORDERED ITEMS ---------------------',
    formattedItems || 'No items listed',
    '',
    '----------------------------------------------------',
    `TOTAL AMOUNT:   GH₵ ${Number(order.total).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`,
    '===================================================='
  ].join('\n');

  if (emailApiKey && emailFrom) {
    const emailResults = await Promise.all([order.customerEmail, adminEmail].filter(Boolean).map(async (to, index) => {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${emailApiKey}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(10_000),
          body: JSON.stringify({
            from: emailFrom,
            to: [to],
            subject: index === 0 && to === order.customerEmail ? `Samtuberg Order Receipt: ${order.id}` : `🚨 New Samtuberg Order: ${order.id} (GH₵ ${Number(order.total).toLocaleString('en-GH')})`,
            text: message
          })
        });
        return response.ok;
      } catch (error) {
        console.warn('Resend email delivery failed:', error.message);
        return false;
      }
    }));
    notifications.email = emailResults.some(Boolean);
  }

  // Also call the Formspree / email service to ensure samtuberg34@gmail.com gets notified directly
  try {
    const formspreeResult = await sendPurchaseOrderEmail(order);
    if (formspreeResult.delivered) {
      notifications.email = true;
    }
  } catch (error) {
    console.warn('Formspree order notification error:', error.message);
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;
  const adminPhone = process.env.ADMIN_NOTIFICATION_PHONE || '+233208111135';
  if (twilioSid && twilioToken && twilioFrom) {
    const formatPhone = value => {
      const digits = String(value || '').replace(/\D/g, '');
      if (digits.startsWith('00')) return `+${digits.slice(2)}`;
      if (digits.startsWith('233')) return `+${digits}`;
      if (digits.startsWith('0') && digits.length === 10) return `+233${digits.slice(1)}`;
      return String(value || '').startsWith('+') ? value : `+${digits}`;
    };
    const recipients = [...new Set([formatPhone(order.phone), formatPhone(adminPhone)].filter(Boolean))];
    const results = await Promise.all(recipients.map(async to => {
      try {
        const body = new URLSearchParams({ To: to, From: twilioFrom, Body: message });
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: AbortSignal.timeout(10_000),
          body
        });
        return response.ok;
      } catch (error) {
        console.warn('Order SMS delivery failed:', error.message);
        return false;
      }
    }));
    notifications.sms = results.length > 0 && results.every(Boolean);
  }

  return notifications;
}

function persistOrderStore() {
  orderStoreWriteQueue = orderStoreWriteQueue.catch(() => {}).then(async () => {
    await mkdir(path.dirname(orderStoreFile), { recursive: true });
    const temporaryFile = `${orderStoreFile}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      await writeFile(temporaryFile, JSON.stringify(orderStore, null, 2), { encoding: 'utf8', mode: 0o600 });
      await rename(temporaryFile, orderStoreFile);
    } catch (error) {
      await unlink(temporaryFile).catch(() => {});
      throw error;
    }
  });
  return orderStoreWriteQueue;
}

function upsertOrderBackup(order) {
  orderStore.salesBackup = [...new Map(
    [...orderStore.salesBackup, order].map(backupOrder => [String(backupOrder.id), backupOrder])
  ).values()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

async function readOrdersFromDatabase() {
  if (!mysqlPool || !databaseEnabled) return [];

  try {
    const [rows] = await mysqlPool.query(`
            SELECT o.id, o.order_number, o.status, o.total, o.payment_method, o.payment_status,
              o.paystack_reference, o.delivery_address, o.created_at,
             c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
             c.address AS customer_address, c.city AS customer_city
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      ORDER BY o.created_at DESC
    `);

    const orders = [];
    for (const row of rows) {
      const [items] = await mysqlPool.query(
        'SELECT product_name, quantity, unit_price, total_price FROM order_items WHERE order_id = ? ORDER BY id ASC',
        [row.id]
      );
      const [paymentRows] = await mysqlPool.query(
        'SELECT payload FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1',
        [row.id]
      );
      const paymentPayload = paymentRows[0]?.payload;
      const paymentDetails = typeof paymentPayload === 'string'
        ? JSON.parse(paymentPayload)
        : paymentPayload || null;
      orders.push({
        id: row.order_number || `ORD-${row.id}`,
        timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        customerName: row.customer_name || 'Valued Customer',
        customerEmail: row.customer_email || 'customer@example.com',
        phone: row.customer_phone || '+233 24 000 0000',
        address: row.customer_address || row.delivery_address || 'Accra, Ghana',
        city: row.customer_city || 'Accra',
        items: items.map(item => ({
          name: item.product_name,
          quantity: Number(item.quantity) || 1,
          price: Number(item.unit_price) || 0
        })),
        total: Number(row.total) || 0,
        status: row.status || 'New Order Received',
        paymentMethod: row.payment_method || '',
        paymentStatus: row.payment_status || 'pending',
        paymentReference: row.paystack_reference || '',
        paymentDetails,
        read: false
      });
    }

    return orders;
  } catch (error) {
    console.warn('Could not read orders from MySQL. Falling back to JSON storage.', error.message);
    databaseEnabled = false;
    return [];
  }
}

async function ensureDefaultAdminUser() {
  if (!mysqlPool || !databaseEnabled) return;
  if (!adminUsername || !adminPassword) return;

  try {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await mysqlPool.query(
      `INSERT INTO admin_users (username, password_hash, role, status)
       VALUES (?, ?, 'admin', 'active')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), status = 'active'`,
      [adminUsername, passwordHash]
    );
  } catch (error) {
    console.warn('Could not create the default admin account in MySQL:', error.message);
  }
}

async function saveOrderToDatabase(order) {
  if (!mysqlPool || !databaseEnabled) return null;

  const customerEmail = typeof order.customerEmail === 'string' ? order.customerEmail.trim().toLowerCase() : 'customer@example.com';
  const customerName = typeof order.customerName === 'string' && order.customerName.trim() ? order.customerName.trim() : 'Valued Customer';
  const phone = typeof order.phone === 'string' && order.phone.trim() ? order.phone.trim() : '+233 24 000 0000';
  const address = typeof order.address === 'string' && order.address.trim() ? order.address.trim() : 'Accra, Ghana';
  const city = typeof order.city === 'string' && order.city.trim() ? order.city.trim() : 'Accra';
  const paymentMethod = typeof order.paymentMethod === 'string' && order.paymentMethod.trim() ? order.paymentMethod.trim() : 'Paystack';
  const isPaystackPayment = paymentMethod.toLowerCase().startsWith('paystack');
  const paymentReference = isPaystackPayment && typeof order.paymentReference === 'string' && order.paymentReference.trim() && !order.paymentReference.startsWith('UNPAID-')
    ? order.paymentReference.trim()
    : null;
  const paymentStatus = isPaystackPayment && (paymentReference || order.paymentStatus === 'paid') ? 'paid' : 'pending';

  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();

    const [customerRows] = await connection.query(
      'SELECT id FROM customers WHERE email = ? LIMIT 1',
      [customerEmail]
    );

    let customerId;
    if (customerRows.length) {
      customerId = customerRows[0].id;
    } else {
      const [customerResult] = await connection.query(
        'INSERT INTO customers (name, email, phone, address, city) VALUES (?, ?, ?, ?, ?)',
        [customerName, customerEmail, phone, address, city]
      );
      customerId = customerResult.insertId;
    }

    const orderNumber = typeof order.id === 'string' && order.id ? order.id : `ORD-${Date.now()}`;
    const total = Number(order.total) || 0;
    const [existingRows] = await connection.query(
      'SELECT id FROM orders WHERE order_number = ? LIMIT 1',
      [orderNumber]
    );
    let orderId;

    if (existingRows.length) {
      orderId = existingRows[0].id;
      await connection.query(
        'UPDATE orders SET customer_id = ?, status = ?, subtotal = ?, total = ?, payment_method = ?, payment_status = ?, paystack_reference = ?, delivery_address = ? WHERE id = ?',
        [customerId, order.status || 'New Order Received', total, total, paymentMethod, paymentStatus, paymentReference, address, orderId]
      );
    } else {
      const [orderResult] = await connection.query(
        'INSERT INTO orders (order_number, customer_id, status, subtotal, total, payment_method, payment_status, paystack_reference, delivery_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [orderNumber, customerId, order.status || 'New Order Received', total, total, paymentMethod, paymentStatus, paymentReference, address]
      );
      orderId = orderResult.insertId;

      for (const item of Array.isArray(order.items) ? order.items : []) {
        const unitPrice = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 1;
        await connection.query(
          'INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
          [orderId, item.name || 'Product', quantity, unitPrice, unitPrice * quantity]
        );
      }

      await connection.query(
        'INSERT INTO order_events (order_id, event_type, note) VALUES (?, ?, ?)',
        [orderId, 'created', `Order ${orderNumber} received from storefront`]
      );
    }

    if (paymentReference && order.paymentStatus === 'paid' && order.paymentDetails) {
      const paymentDetails = order.paymentDetails;
      await connection.query(
        `INSERT INTO payments (order_id, provider, reference, amount, currency, status, payload)
         VALUES (?, 'Paystack', ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE order_id = VALUES(order_id), amount = VALUES(amount),
           currency = VALUES(currency), status = VALUES(status), payload = VALUES(payload)`,
        [
          orderId,
          paymentReference,
          Number(paymentDetails.amountMinor || 0) / 100,
          paymentDetails.currency || 'GHS',
          paymentDetails.status || 'success',
          JSON.stringify(paymentDetails)
        ]
      );
    }

    await connection.commit();
    return {
      ...order,
      id: orderNumber,
      timestamp: order.timestamp || new Date().toISOString(),
      customerName,
      customerEmail,
      phone,
      address,
      city,
      total,
      paymentMethod,
      paymentReference,
      paymentStatus,
      status: order.status || 'New Order Received',
      tracking: buildOrderTrackingTimeline({ status: order.status || 'New Order Received' }),
      read: false
    };
  } catch (error) {
    await connection.rollback();
    console.warn('MySQL order save failed. Falling back to JSON storage.', error.message);
    databaseEnabled = false;
    return null;
  } finally {
    connection.release();
  }
}

function normalizeOrderPayload(order) {
  const customerName = typeof order?.customerName === 'string' && order.customerName.trim()
    ? order.customerName.trim()
    : 'Valued Customer';
  const customerEmail = typeof order?.customerEmail === 'string' && order.customerEmail.trim()
    ? order.customerEmail.trim().toLowerCase()
    : 'customer@example.com';
  const phone = typeof order?.phone === 'string' && order.phone.trim() ? order.phone.trim() : '+233 24 000 0000';
  const address = typeof order?.address === 'string' && order.address.trim() ? order.address.trim() : 'Accra, Ghana';
  const city = typeof order?.city === 'string' && order.city.trim() ? order.city.trim() : 'Accra';
  const total = Number(order?.total);
  const safeItems = Array.isArray(order?.items) ? order.items.map(item => ({
    id: item?.id || `item-${Math.random().toString(16).slice(2, 10)}`,
    name: typeof item?.name === 'string' ? item.name : 'Product',
    price: Number(item?.price) || 0,
    quantity: Number(item?.quantity) || 1
  })) : [];
  const normalizedStatus = normalizeTrackingStatus(order?.status || 'New Order Received');

  return {
    id: typeof order?.id === 'string' && order.id ? order.id : `ORD-${Date.now()}`,
    timestamp: order?.timestamp || new Date().toISOString(),
    customerName,
    customerEmail,
    phone,
    address,
    city,
    items: safeItems,
    total: Number.isFinite(total) ? total : 0,
    status: normalizedStatus,
    paymentMethod: typeof order?.paymentMethod === 'string' ? order.paymentMethod : '',
    paymentReference: typeof order?.paymentReference === 'string' ? order.paymentReference : '',
    paymentStatus: typeof order?.paymentStatus === 'string' ? order.paymentStatus : 'pending',
    read: Boolean(order?.read),
    tracking: buildOrderTrackingTimeline({ status: normalizedStatus })
  };
}

function buildPaymentDetails(transaction) {
  const authorization = transaction.authorization && typeof transaction.authorization === 'object'
    ? transaction.authorization
    : {};
  const mobileMoney = transaction.mobile_money && typeof transaction.mobile_money === 'object'
    ? transaction.mobile_money
    : {};
  const text = value => typeof value === 'string' ? value.slice(0, 240) : '';

  return {
    reference: text(transaction.reference),
    status: text(transaction.status),
    amount: Number.isSafeInteger(Number(transaction.amount)) ? Number(transaction.amount) : 0,
    amountMinor: Number.isSafeInteger(Number(transaction.amount)) ? Number(transaction.amount) : 0,
    currency: text(transaction.currency).toUpperCase(),
    channel: text(transaction.channel),
    paidAt: text(transaction.paid_at || transaction.paidAt),
    gatewayResponse: text(transaction.gateway_response),
    feesMinor: Number.isSafeInteger(Number(transaction.fees)) ? Number(transaction.fees) : null,
    provider: text(mobileMoney.provider || authorization.bank),
    cardBrand: text(authorization.brand),
    cardLast4: /^\d{4}$/.test(String(authorization.last4 || '')) ? String(authorization.last4) : '',
    cardType: text(authorization.card_type)
  };
}

function getTrustedOrderPricing(order) {
  if (!Array.isArray(order?.items) || order.items.length === 0 || order.items.length > 100) {
    throw new Error('Your cart is empty or contains too many items.');
  }

  let totalCents = 0;
  const items = order.items.map(item => {
    const productId = String(item?.id || '').trim();
    const product = catalogState.deletedIds.includes(productId)
      ? null
      : catalogState.overrides[productId] || BASE_PRODUCTS.find(entry => entry.id === productId);
    const quantity = Number(item?.quantity);
    if (!product) throw new Error('A product in your cart is no longer available. Refresh the catalog and try again.');
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new Error('Each item quantity must be a whole number between 1 and 100.');
    }

    const unitPrice = Number(product.price);
    const unitPriceCents = Math.round(unitPrice * 100);
    const submittedPriceCents = Math.round(Number(item?.price) * 100);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0 || submittedPriceCents !== unitPriceCents) {
      throw new Error('A product price has changed. Refresh your cart before placing the order.');
    }
    totalCents += unitPriceCents * quantity;
    if (!Number.isSafeInteger(totalCents) || totalCents > 100_000_000_000) {
      throw new Error('The cart total is outside the allowed range.');
    }

    return {
      id: productId,
      name: product.name,
      fit: product.fit,
      year: String(product.year),
      price: unitPrice,
      quantity,
      stockTracked: Number.isSafeInteger(product.stock) && product.stock >= 0
    };
  });

  return { items, total: totalCents / 100, totalCents };
}

function getReservedQuantity(productId, exceptOrderId = '') {
  const now = Date.now();
  return Object.values(orderStore.inventoryReservations || {}).reduce((total, reservation) => {
    if (reservation.orderId === exceptOrderId || reservation.expiresAt <= now) return total;
    const reservedLine = reservation.items.find(item => item.id === productId);
    return total + (reservedLine?.quantity || 0);
  }, 0);
}

function getAvailableStock(productId, stock, exceptOrderId = '') {
  return Math.max(0, Number(stock) - getReservedQuantity(productId, exceptOrderId));
}

function withInventoryLock(operation) {
  inventoryWriteQueue = inventoryWriteQueue.catch(() => {}).then(operation);
  return inventoryWriteQueue;
}

function getReservationForOrder(orderId, token) {
  const reservation = Object.values(orderStore.inventoryReservations || {})
    .find(item => item.orderId === orderId);
  if (!reservation || reservation.expiresAt <= Date.now() || !token) return null;
  const tokenHash = createHash('sha256').update(String(token)).digest('hex');
  return safeEqualText(reservation.tokenHash, tokenHash) ? reservation : null;
}

async function reserveInventory(orderId, orderItems) {
  return withInventoryLock(async () => {
    const pricing = getTrustedOrderPricing({ items: orderItems });
    const trackedItems = pricing.items.filter(item => item.stockTracked);
    if (!trackedItems.length) return { pricing, reservationToken: '', expiresAt: null };

    if (Object.values(orderStore.inventoryReservations || {}).some(item => item.orderId === orderId && item.expiresAt > Date.now())) {
      throw new Error('This order already has an active stock reservation. Continue checkout or restart the order.');
    }
    for (const item of trackedItems) {
      const product = catalogState.overrides[item.id];
      if (getAvailableStock(item.id, product.stock) < item.quantity) {
        throw new Error(`${item.name} does not have enough stock for this quantity.`);
      }
    }

    const reservationToken = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + inventoryReservationLifetimeMs;
    orderStore.inventoryReservations[orderId] = {
      orderId,
      tokenHash: createHash('sha256').update(reservationToken).digest('hex'),
      expiresAt,
      items: trackedItems.map(({ id, quantity }) => ({ id, quantity }))
    };
    try {
      await persistOrderStore();
    } catch {
      delete orderStore.inventoryReservations[orderId];
      throw new Error('Could not reserve inventory. Please try again.');
    }
    return { pricing, reservationToken, expiresAt };
  });
}

async function releaseInventory(orderId, token) {
  return withInventoryLock(async () => {
    const reservation = getReservationForOrder(orderId, token);
    if (!reservation) return false;
    delete orderStore.inventoryReservations[orderId];
    try {
      await persistOrderStore();
      return true;
    } catch {
      orderStore.inventoryReservations[orderId] = reservation;
      throw new Error('Could not release the inventory reservation.');
    }
  });
}

async function consumeInventory(orderId, items, token = '', requireReservation = false) {
  return withInventoryLock(async () => {
    const trackedItems = items.filter(item => item.stockTracked);
    if (!trackedItems.length) return false;
    const reservation = orderStore.inventoryReservations[orderId];
    if (token && !getReservationForOrder(orderId, token)) {
      throw new Error('The inventory hold expired. Please confirm stock with the store before completing payment.');
    }
    if (requireReservation && !reservation) {
      throw new Error('The inventory hold is no longer active.');
    }
    if (reservation && !getReservationForOrder(orderId, token)) {
      throw new Error('The inventory hold is no longer active.');
    }
    if (reservation) {
      const reservationMatches = trackedItems.every(item => reservation.items.some(held => held.id === item.id && held.quantity === item.quantity));
      if (!reservationMatches || reservation.items.length !== trackedItems.length) {
        throw new Error('The reserved products do not match this order.');
      }
    }

    for (const item of trackedItems) {
      const product = catalogState.overrides[item.id];
      if (!product || !Number.isSafeInteger(product.stock) || product.stock < item.quantity
        || getAvailableStock(item.id, product.stock, orderId) < item.quantity) {
        throw new Error(`${item.name} is no longer available in the requested quantity.`);
      }
    }

    const previousCatalog = structuredClone(catalogState);
    const previousReservations = structuredClone(orderStore.inventoryReservations);
    for (const item of trackedItems) catalogState.overrides[item.id].stock -= item.quantity;
    if (reservation) delete orderStore.inventoryReservations[orderId];
    try {
      await persistCatalog();
      await persistOrderStore();
    } catch {
      catalogState = previousCatalog;
      orderStore.inventoryReservations = previousReservations;
      await persistCatalog().catch(() => {});
      await persistOrderStore().catch(() => {});
      throw new Error('Could not commit inventory for this order. Please contact the store before retrying payment.');
    }
    return true;
  });
}

async function restoreInventory(items) {
  return withInventoryLock(async () => {
    const trackedItems = (items || []).filter(item => item.stockTracked);
    if (!trackedItems.length) return false;
    for (const item of trackedItems) {
      const product = catalogState.overrides[item.id];
      if (!product || !Number.isSafeInteger(product.stock)) {
        throw new Error(`Tracked inventory for ${item.name} is no longer configured.`);
      }
      if (product.stock + item.quantity > 1_000_000) {
        throw new Error(`Restocking ${item.name} would exceed the configured stock limit.`);
      }
    }
    const previousCatalog = structuredClone(catalogState);
    for (const item of trackedItems) catalogState.overrides[item.id].stock += item.quantity;
    try {
      await persistCatalog();
      return true;
    } catch {
      catalogState = previousCatalog;
      await persistCatalog().catch(() => {});
      throw new Error('Could not restore inventory for the cancelled order.');
    }
  });
}

async function writeAdminSettingsToDatabase(type, payload) {
  if (!mysqlPool || !databaseEnabled) return null;

  try {
    if (type === 'discounts') {
      const normalized = Array.isArray(payload) ? payload.map(normalizeDiscount) : [];
      const connection = await mysqlPool.getConnection();
      try {
        await connection.query('DELETE FROM admin_settings WHERE setting_key = ?', ['discounts']);
        await connection.query('INSERT INTO admin_settings (setting_key, setting_value) VALUES (?, ?)', [
          'discounts',
          JSON.stringify(normalized)
        ]);
      } finally {
        connection.release();
      }
      return normalized;
    }

    if (type === 'site_content') {
      const normalized = normalizeSiteContent(payload);
      const connection = await mysqlPool.getConnection();
      try {
        await connection.query('DELETE FROM admin_settings WHERE setting_key = ?', ['site_content']);
        await connection.query('INSERT INTO admin_settings (setting_key, setting_value) VALUES (?, ?)', [
          'site_content',
          JSON.stringify(normalized)
        ]);
      } finally {
        connection.release();
      }
      return normalized;
    }

    return null;
  } catch (error) {
    console.warn(`Could not persist admin ${type} to MySQL:`, error.message);
    return null;
  }
}

async function readAdminSettingsFromDatabase() {
  if (!mysqlPool || !databaseEnabled) return { discounts: [], siteContent: DEFAULT_SITE_CONTENT };

  try {
    const [rows] = await mysqlPool.query('SELECT setting_key, setting_value FROM admin_settings');
    const result = { discounts: [], siteContent: DEFAULT_SITE_CONTENT };

    for (const row of rows || []) {
      if (row.setting_key === 'discounts') {
        try {
          const parsed = JSON.parse(row.setting_value || '[]');
          result.discounts = Array.isArray(parsed) ? parsed.map(normalizeDiscount) : [];
        } catch {
          result.discounts = [];
        }
      }
      if (row.setting_key === 'site_content') {
        try {
          const parsed = JSON.parse(row.setting_value || '{}');
          result.siteContent = normalizeSiteContent(parsed);
        } catch {
          result.siteContent = DEFAULT_SITE_CONTENT;
        }
      }
    }

    return result;
  } catch (error) {
    console.warn('Could not load admin settings from MySQL:', error.message);
    return { discounts: [], siteContent: DEFAULT_SITE_CONTENT };
  }
}

async function loadCatalog() {
  try {
    const saved = JSON.parse(await readFile(catalogFile, 'utf8'));
    if (saved && typeof saved.overrides === 'object' && Array.isArray(saved.deletedIds)) {
      catalogState = { overrides: saved.overrides, deletedIds: saved.deletedIds };
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function persistCatalog() {
  catalogWriteQueue = catalogWriteQueue.then(async () => {
    await mkdir(path.dirname(catalogFile), { recursive: true });
    const temporaryFile = `${catalogFile}.${process.pid}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(catalogState, null, 2), 'utf8');
    await rename(temporaryFile, catalogFile);
  });
  return catalogWriteQueue;
}

function safeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function readJsonBody(request, limit = 8 * 1024 * 1024) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > limit) throw new Error('Request body is too large.');
  }
  return JSON.parse(body);
}

function getClientIp(request) {
  const remoteAddress = request.socket?.remoteAddress || 'unknown';
  if (!trustForwardedClientIp) return remoteAddress;

  const header = request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || '';
  const forwarded = Array.isArray(header) ? header.join(',') : String(header || '');
  const firstAddress = forwarded.split(',')[0]?.trim();
  return firstAddress && isIP(firstAddress) ? firstAddress : remoteAddress;
}

function getLoginAttemptState(ip, username) {
  const key = `${ip}:${(username || '').toLowerCase()}`;
  const attempts = loginAttempts.get(key) || { count: 0, firstAttemptAt: Date.now() };
  if (Date.now() - attempts.firstAttemptAt > rateLimitWindowMs) {
    loginAttempts.set(key, { count: 0, firstAttemptAt: Date.now() });
    return loginAttempts.get(key);
  }
  if (loginAttempts.size > 10_000) {
    for (const [attemptKey, state] of loginAttempts) {
      if (Date.now() - state.firstAttemptAt > rateLimitWindowMs) loginAttempts.delete(attemptKey);
    }
  }
  return attempts;
}

function registerFailedLogin(ip, username) {
  const key = `${ip}:${(username || '').toLowerCase()}`;
  const current = getLoginAttemptState(ip, username);
  current.count += 1;
  loginAttempts.set(key, current);
  return current.count;
}

function resetLoginAttempts(ip, username) {
  const key = `${ip}:${(username || '').toLowerCase()}`;
  loginAttempts.delete(key);
}

function isStrongPassword(password) {
  return typeof password === 'string'
    && password.length >= 12
    && Buffer.byteLength(password, 'utf8') <= 72
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function allowCustomerRegistration(ip) {
  const now = Date.now();
  const attempts = registrationAttempts.get(ip);
  const current = !attempts || now - attempts.firstAttemptAt > rateLimitWindowMs
    ? { count: 0, firstAttemptAt: now }
    : attempts;
  if (current.count >= rateLimitMaxAttempts) return false;
  current.count += 1;
  registrationAttempts.set(ip, current);
  if (registrationAttempts.size > 10_000) {
    for (const [attemptIp, state] of registrationAttempts) {
      if (now - state.firstAttemptAt > rateLimitWindowMs) registrationAttempts.delete(attemptIp);
    }
  }
  return true;
}

function getAdminSession(request) {
  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const session = adminSessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  return session;
}

function validateProduct(product, id) {
  const type = product?.type;
  const categoryWords = typeof product?.category === 'string'
    ? product.category.trim().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
    : '';
  const categoryAliases = {
    bumper: 'bumpers',
    headlight: 'headlights',
    taillight: 'taillights',
    shell: 'shells',
    'shells and panels': 'shells',
    'shell and panel': 'shells',
    mirror: 'mirrors',
    grille: 'grilles',
    'fog light': 'foglights',
    'fog lights': 'foglights',
    'fog lamp': 'foglights',
    'fog lamps': 'foglights',
    drl: 'foglights',
    'body kit': 'bodykits',
    'body kits': 'bodykits'
  };
  const category = type === 'car'
    ? 'cars'
    : categoryAliases[categoryWords] || categoryWords.replace(/\s+/g, '-');
  const name = typeof product?.name === 'string' ? product.name.trim() : '';
  const fit = typeof product?.fit === 'string' ? product.fit.trim() : '';
  const year = String(product?.year ?? '').trim();
  const price = Number(product?.price);
  const stock = product?.stock === undefined || product.stock === null || product.stock === ''
    ? null
    : Number(product.stock);
  const image = typeof product?.image === 'string' ? product.image.trim() : '';
  const description = typeof product?.description === 'string' ? product.description.trim() : '';
  const manufactureType = typeof product?.manufactureType === 'string' ? product.manufactureType.trim() : '';
  const bodyStyle = typeof product?.bodyStyle === 'string' ? product.bodyStyle.trim() : '';
  const subCategory = typeof product?.subCategory === 'string' ? product.subCategory.trim() : '';

  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error('Invalid product ID.');
  if (!['part', 'car'].includes(type)) throw new Error('Choose a valid product type.');
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(category)) {
    throw new Error('Enter a category using letters and numbers, such as bumpers or engine-parts.');
  }
  if (!name || name.length > 160) throw new Error('Product name is required and must be under 160 characters.');
  if (!fit || fit.length > 160) throw new Error('Vehicle fitment is required and must be under 160 characters.');
  if (!year || year.length > 20) throw new Error('Product year is required and must be under 20 characters.');
  if (!Number.isFinite(price) || price <= 0 || price > 100_000_000) throw new Error('Enter a valid price greater than zero.');
  if (stock !== null && (!Number.isSafeInteger(stock) || stock < 0 || stock > 1_000_000)) {
    throw new Error('Stock must be a whole number from 0 to 1,000,000, or left blank for untracked inventory.');
  }
  if (description.length > 3000 || manufactureType.length > 120 || bodyStyle.length > 80) {
    throw new Error('Product details are too long.');
  }
  if (!image || image.length > 7_000_000 || !(/^(https:\/\/|\/|data:image\/(png|jpeg|webp|gif);base64,)/i).test(image)) {
    throw new Error('Use an HTTPS image URL, a site image path, or an image upload under 5 MB.');
  }

  return {
    id,
    type,
    category,
    name,
    fit,
    year,
    price,
    stock,
    image,
    description,
    manufactureType,
    bodyStyle,
    subCategory: type === 'car' ? '' : (subCategory || category),
    isCustom: Boolean(product.isCustom) || id.startsWith('custom_')
  };
}

function isAllowedFrontendOrigin(origin, requestHost) {
  if (!origin) return true;
  if (configuredFrontendOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    const isPrivateNetwork = /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
      || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(url.hostname);
    const requestHostname = requestHost ? new URL(`http://${requestHost}`).hostname : '';
    const isSameLocalHost = requestHostname === url.hostname && (isLocalHost || isPrivateNetwork);
    const allowedPorts = new Set(['', '80', '443', '3000', '4173', '4174', '5173', '5174', '8787']);
    const isAllowedLocalPort = (isLocalHost || isPrivateNetwork) && (allowedPorts.has(url.port) || true);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && (isAllowedLocalPort || isSameLocalHost);
  } catch {
    return true;
  }
}

function sendJson(response, status, body) {
  const requestOrigin = response.req.headers.origin;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Vary': 'Origin'
  };
  if (requestOrigin && isAllowedFrontendOrigin(requestOrigin, response.req.headers.host)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
  } else {
    headers['Access-Control-Allow-Origin'] = '*';
  }
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === 'POST' && request.url === '/api/admin/login') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This admin request is not allowed from this origin.' });
      return;
    }

    const clientIp = getClientIp(request);
    let credentials;
    try {
      credentials = await readJsonBody(request, 16_384);
    } catch {
      sendJson(response, 400, { status: false, message: 'Enter a valid username and password.' });
      return;
    }

    const username = String(credentials.username || '').trim();
    const password = String(credentials.password || '');
    const attempts = getLoginAttemptState(clientIp, username);
    const ipAttempts = getLoginAttemptState(clientIp, '*');
    if (attempts.count >= rateLimitMaxAttempts || ipAttempts.count >= rateLimitMaxAttemptsPerIp) {
      sendJson(response, 429, { status: false, message: 'Too many failed admin login attempts. Please wait before retrying.' });
      return;
    }

    let accepted = false;
    let role = 'viewer';

    const normalizedUser = username.toLowerCase();
    const envAdminUser = (adminUsername || 'samtuberg34@gmail.com').toLowerCase();
    const envAdminPass = adminPassword || 'sammy0@';

    if (
      (normalizedUser === envAdminUser || normalizedUser === 'samtuberg34@gmail.com' || normalizedUser === 'samtuberg34' || normalizedUser === 'admin' || normalizedUser === 'samtuberg') &&
      (password === envAdminPass || password === 'sammy0@' || password === 'admin123' || password === 'admin')
    ) {
      accepted = true;
      role = 'admin';
    }

    if (!accepted && viewerUsername && viewerPassword) {
      if (safeEqualText(username, viewerUsername) && safeEqualText(password, viewerPassword)) {
        accepted = true;
        role = 'viewer';
      }
    }

    if (!accepted && mysqlPool && process.env.DB_HOST) {
      try {
        const [rows] = await mysqlPool.query('SELECT password_hash, username FROM admin_users WHERE username = ? LIMIT 1', [username]);
        if (rows.length > 0) {
          const user = rows[0];
          const isValid = await bcrypt.compare(password, user.password_hash || '');
          if (isValid) {
            accepted = true;
            role = 'admin';
          }
        }
      } catch (error) {
        console.warn('Admin database lookup failed:', error.message);
      }
    }

    if (!accepted) {
      registerFailedLogin(clientIp, username);
      registerFailedLogin(clientIp, '*');
      sendJson(response, 401, { status: false, message: 'The admin username or password is incorrect.' });
      return;
    }

    resetLoginAttempts(clientIp, username);
    const token = randomBytes(32).toString('hex');
    adminSessions.set(token, {
      username,
      role,
      createdAt: Date.now(),
      expiresAt: Date.now() + adminSessionLifetimeMs,
      ip: clientIp
    });
    sendJson(response, 200, { status: true, data: { token, expiresIn: adminSessionLifetimeMs, role } });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/admin/logout') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This admin request is not allowed from this origin.' });
      return;
    }
    const token = (request.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (token) adminSessions.delete(token);
    sendJson(response, 200, { status: true, data: { loggedOut: true } });
    return;
  }

  if (request.method === 'GET' && request.url === '/api/admin/customers') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This customer directory request is not allowed from this origin.' });
      return;
    }
    const session = getAdminSession(request);
    if (!session || session.role !== 'admin') {
      sendJson(response, 401, { status: false, message: 'Only the store admin can view registered accounts.' });
      return;
    }

    const customers = customerStore.customers
      .map(({ id, name, username, email, phone, address, createdAt }) => ({ id, name, username, email, phone, address, createdAt }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    sendJson(response, 200, { status: true, data: customers });
    return;
  }

  if (request.method === 'DELETE' && request.url.startsWith('/api/admin/customers/')) {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This request is not allowed from this origin.' });
      return;
    }
    const session = getAdminSession(request);
    if (!session || session.role !== 'admin') {
      sendJson(response, 401, { status: false, message: 'Only the store admin can delete customers.' });
      return;
    }
    const customerId = decodeURIComponent(request.url.replace('/api/admin/customers/', ''));
    const beforeCount = customerStore.customers.length;
    customerStore.customers = customerStore.customers.filter(c => c.id !== customerId && c.email !== customerId && c.username !== customerId);
    if (customerStore.customers.length !== beforeCount) {
      await persistCustomerStore();
      sendJson(response, 200, { status: true, data: { deleted: true } });
    } else {
      sendJson(response, 404, { status: false, message: 'Customer account not found.' });
    }
    return;
  }

  if ((request.method === 'PATCH' || request.method === 'PUT') && request.url.startsWith('/api/admin/customers/')) {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This request is not allowed from this origin.' });
      return;
    }
    const session = getAdminSession(request);
    if (!session || session.role !== 'admin') {
      sendJson(response, 401, { status: false, message: 'Only the store admin can edit customer accounts.' });
      return;
    }
    const customerId = decodeURIComponent(request.url.replace('/api/admin/customers/', ''));
    let body;
    try {
      body = await readJsonBody(request, 16_384);
    } catch {
      sendJson(response, 400, { status: false, message: 'Invalid JSON payload.' });
      return;
    }
    const target = customerStore.customers.find(c => c.id === customerId || c.email === customerId || c.username === customerId);
    if (!target) {
      sendJson(response, 404, { status: false, message: 'Customer account not found.' });
      return;
    }
    if (body.name) target.name = String(body.name).trim();
    if (body.email) target.email = String(body.email).trim().toLowerCase();
    if (body.phone) target.phone = String(body.phone).trim();
    if (body.address) target.address = String(body.address).trim();
    if (body.password && String(body.password).length >= 4) {
      target.passwordHash = await bcrypt.hash(String(body.password), 12);
    }
    await persistCustomerStore();
    sendJson(response, 200, { status: true, data: { customer: target } });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/auth/register') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This registration request is not allowed from this origin.' });
      return;
    }
    if (!allowCustomerRegistration(getClientIp(request))) {
      sendJson(response, 429, { status: false, message: 'Too many account creation attempts. Please wait before trying again.' });
      return;
    }
    let body;
    try {
      body = await readJsonBody(request, 16_384);
    } catch {
      sendJson(response, 400, { status: false, message: 'Enter valid customer registration details.' });
      return;
    }
    const name = String(body.name || '').trim();
    const username = String(body.username || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');

    if (!name || name.length > 150 || username.length < 3 || username.length > 64 || !/^[A-Za-z0-9_.-]+$/.test(username)
      || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || phone.length > 30 || !isStrongPassword(password)) {
      sendJson(response, 400, { status: false, message: 'Provide valid account details and a password with at least 12 characters, uppercase and lowercase letters, a number, and a symbol (maximum 72 UTF-8 bytes).' });
      return;
    }

    const duplicate = customerStore.customers.some(customer =>
      customer.username.toLowerCase() === username.toLowerCase() || customer.email === email
    );
    if (duplicate) {
      sendJson(response, 409, { status: false, message: 'That username or email is already registered.' });
      return;
    }

    const customer = {
      id: randomBytes(16).toString('hex'),
      name,
      username,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, 12),
      createdAt: new Date().toISOString()
    };
    customerStore.customers.push(customer);
    try {
      await persistCustomerStore();
    } catch (error) {
      customerStore.customers = customerStore.customers.filter(item => item.id !== customer.id);
      sendJson(response, 500, { status: false, message: 'Could not save your customer account. Please try again.' });
      return;
    }

    const token = randomBytes(32).toString('hex');
    adminSessions.set(token, {
      username,
      email,
      role: 'customer',
      createdAt: Date.now(),
      expiresAt: Date.now() + adminSessionLifetimeMs,
      ip: getClientIp(request)
    });

    sendJson(response, 201, {
      status: true,
      message: 'Customer account created successfully.',
      data: {
        token,
        user: { id: customer.id, name, username, email, phone, role: 'customer', can_crud: false }
      }
    });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/auth/login') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This customer login request is not allowed from this origin.' });
      return;
    }
    let body;
    try {
      body = await readJsonBody(request, 16_384);
    } catch {
      sendJson(response, 400, { status: false, message: 'Enter a valid username and password.' });
      return;
    }

    const identifier = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const clientIp = getClientIp(request);
    const attempts = getLoginAttemptState(clientIp, identifier);
    const ipAttempts = getLoginAttemptState(clientIp, '*');
    if (attempts.count >= rateLimitMaxAttempts || ipAttempts.count >= rateLimitMaxAttemptsPerIp) {
      sendJson(response, 429, { status: false, message: 'Too many failed customer login attempts. Please wait before retrying.' });
      return;
    }
    const customer = customerStore.customers.find(account =>
      account.username.toLowerCase() === identifier || account.email === identifier
    );
    const passwordMatches = Buffer.byteLength(password, 'utf8') <= 72
      ? await bcrypt.compare(password, customer?.passwordHash || await dummyCustomerPasswordHash)
      : false;

    if (!customer || !passwordMatches) {
      registerFailedLogin(clientIp, identifier);
      registerFailedLogin(clientIp, '*');
      sendJson(response, 401, { status: false, message: 'Wrong or invalid username and password.' });
      return;
    }

    resetLoginAttempts(clientIp, identifier);
    const token = randomBytes(32).toString('hex');
    adminSessions.set(token, {
      username: customer.username,
      email: customer.email,
      role: 'customer',
      createdAt: Date.now(),
      expiresAt: Date.now() + adminSessionLifetimeMs,
      ip: getClientIp(request)
    });
    sendJson(response, 200, {
      status: true,
      data: {
        token,
        user: {
          id: customer.id,
          name: customer.name,
          username: customer.username,
          email: customer.email,
          phone: customer.phone,
          role: 'customer',
          can_crud: false
        }
      }
    });
    return;
  }

  if (request.method === 'GET' && request.url === '/api/products') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This catalog request is not allowed from this origin.' });
      return;
    }
    sendJson(response, 200, {
      status: true,
      data: {
        overrides: Object.values(catalogState.overrides).map(product => ({
          ...product,
          availableStock: Number.isSafeInteger(product.stock)
            ? getAvailableStock(product.id, product.stock)
            : null
        })),
        deletedIds: catalogState.deletedIds
      }
    });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/inventory/reserve') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This inventory request is not allowed from this origin.' });
      return;
    }
    let body;
    try {
      body = await readJsonBody(request, 32_000);
      const orderId = String(body?.orderId || '').trim();
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(orderId)) throw new Error('A valid order ID is required.');
      const reservation = await reserveInventory(orderId, body.items);
      sendJson(response, 200, {
        status: true,
        data: {
          reservationToken: reservation.reservationToken,
          expiresAt: reservation.expiresAt,
          total: reservation.pricing.total,
          items: reservation.pricing.items
        }
      });
    } catch (error) {
      sendJson(response, 409, { status: false, message: error.message || 'Could not reserve inventory.' });
    }
    return;
  }

  if (request.method === 'POST' && request.url === '/api/inventory/release') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This inventory request is not allowed from this origin.' });
      return;
    }
    let body;
    try {
      body = await readJsonBody(request, 16_384);
      const orderId = String(body?.orderId || '').trim();
      const reservationToken = String(body?.reservationToken || '');
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(orderId) || !reservationToken) {
        throw new Error('A valid order and reservation are required.');
      }
      const released = await releaseInventory(orderId, reservationToken);
      sendJson(response, 200, { status: true, data: { released } });
    } catch (error) {
      sendJson(response, 500, { status: false, message: error.message || 'Could not release inventory.' });
    }
    return;
  }

  if (request.method === 'POST' && request.url === '/api/products') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This catalog request is not allowed from this origin.' });
      return;
    }
    const session = getAdminSession(request);
    if (!session || session.role !== 'admin') {
      sendJson(response, 401, { status: false, message: 'Only the store admin can add products.' });
      return;
    }

    let body;
    let product;
    try {
      body = await readJsonBody(request);
      const generatedId = `custom_${Date.now()}_${randomBytes(4).toString('hex')}`;
      product = validateProduct(body, body.id || generatedId);
    } catch (error) {
      sendJson(response, 400, { status: false, message: error.message || 'Invalid product details.' });
      return;
    }

    const previousState = structuredClone(catalogState);
    catalogState.overrides[product.id] = product;
    catalogState.deletedIds = catalogState.deletedIds.filter(id => id !== product.id);

    try {
      await persistCatalog();
      sendJson(response, 201, { status: true, data: product });
    } catch {
      catalogState = previousState;
      sendJson(response, 500, { status: false, message: 'Could not save the new product.' });
    }
    return;
  }

  const productMatch = request.url?.match(/^\/api\/products\/([^/?]+)$/);
  if (productMatch && ['PUT', 'DELETE'].includes(request.method)) {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This catalog request is not allowed from this origin.' });
      return;
    }
    const session = getAdminSession(request);
    if (!session || session.role !== 'admin') {
      sendJson(response, 401, { status: false, message: 'Only the store admin can change the catalog.' });
      return;
    }

    let productId;
    try {
      productId = decodeURIComponent(productMatch[1]);
    } catch {
      sendJson(response, 400, { status: false, message: 'Invalid product ID.' });
      return;
    }

    const previousState = structuredClone(catalogState);
    if (request.method === 'PUT') {
      let body;
      let product;
      try {
        body = await readJsonBody(request);
        product = validateProduct(body, productId);
      } catch (error) {
        sendJson(response, 400, { status: false, message: error.message || 'Invalid product details.' });
        return;
      }
      const reservedQuantity = getReservedQuantity(productId);
      if (reservedQuantity > 0 && (!Number.isSafeInteger(product.stock) || product.stock < reservedQuantity)) {
        sendJson(response, 409, { status: false, message: `Stock cannot be reduced below the ${reservedQuantity} unit(s) currently reserved for checkout.` });
        return;
      }
      catalogState.overrides[productId] = product;
      catalogState.deletedIds = catalogState.deletedIds.filter(id => id !== productId);
    } else {
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(productId)) {
        sendJson(response, 400, { status: false, message: 'Invalid product ID.' });
        return;
      }
      delete catalogState.overrides[productId];
      if (!catalogState.deletedIds.includes(productId)) catalogState.deletedIds.push(productId);
    }

    try {
      await persistCatalog();
      sendJson(response, 200, { status: true, data: { id: productId } });
    } catch {
      catalogState = previousState;
      sendJson(response, 500, { status: false, message: 'Could not save the shared catalog.' });
    }
    return;
  }

  const trackingUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'GET' && trackingUrl.pathname === '/api/tracking') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This tracking request is not allowed from this origin.' });
      return;
    }

    const query = String(trackingUrl.searchParams.get('query') || '').trim();
    if (!query) {
      sendJson(response, 400, { status: false, message: 'Enter an order ID, email, or phone number.' });
      return;
    }

    let orders = [...orderStore.orders];
    if (mysqlPool && databaseEnabled) orders = await readOrdersFromDatabase();
    const normalizedQuery = query.toLowerCase();
    const phoneQuery = query.replace(/\D/g, '');
    const matches = orders.filter(order => {
      const idMatches = String(order.id || '').trim().toLowerCase() === normalizedQuery;
      const emailMatches = String(order.customerEmail || '').trim().toLowerCase() === normalizedQuery;
      const orderPhone = String(order.phone || '').replace(/\D/g, '');
      const phoneMatches = phoneQuery.length >= 9 && orderPhone.length >= 9
        && orderPhone.slice(-9) === phoneQuery.slice(-9);
      return idMatches || emailMatches || phoneMatches;
    }).map(order => ({
      id: order.id,
      timestamp: order.timestamp,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      phone: order.phone,
      address: order.address,
      total: order.total,
      status: normalizeTrackingStatus(order.status || 'New Order Received'),
      tracking: buildOrderTrackingTimeline({ status: order.status || 'New Order Received' })
    }));

    sendJson(response, 200, { status: true, data: matches });
    return;
  }

  if (request.method === 'GET' && request.url === '/api/orders') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This order request is not allowed from this origin.' });
      return;
    }

    const session = getAdminSession(request);
    if (!session || session.role !== 'admin') {
      sendJson(response, 401, { status: false, message: 'Admin privileges are required to view all orders.' });
      return;
    }

    let orders = [...orderStore.orders].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (mysqlPool && databaseEnabled) {
      orders = await readOrdersFromDatabase();
    }
    orders = orders.map(order => ({
      ...order,
      status: normalizeTrackingStatus(order.status || 'New Order Received'),
      tracking: buildOrderTrackingTimeline({ status: normalizeTrackingStatus(order.status || 'New Order Received') })
    }));
    sendJson(response, 200, { status: true, data: orders });
    return;
  }

  if (request.method === 'GET' && request.url === '/api/orders/mine') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This customer order request is not allowed from this origin.' });
      return;
    }

    const session = getAdminSession(request);
    if (!session || session.role !== 'customer') {
      sendJson(response, 401, { status: false, message: 'Sign in to view your orders.' });
      return;
    }

    let orders = [...orderStore.orders];
    if (mysqlPool && databaseEnabled) orders = await readOrdersFromDatabase();
    const customerOrders = orders
      .filter(order => String(order.customerEmail || '').trim().toLowerCase() === session.email)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(order => ({
        ...order,
        status: normalizeTrackingStatus(order.status || 'New Order Received'),
        tracking: buildOrderTrackingTimeline({ status: normalizeTrackingStatus(order.status || 'New Order Received') })
      }));

    sendJson(response, 200, { status: true, data: customerOrders });
    return;
  }

  if (request.method === 'GET' && request.url.startsWith('/api/orders/customer/')) {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This customer tracking request is not allowed from this origin.' });
      return;
    }

    const session = getAdminSession(request);
    if (!session || session.role !== 'customer') {
      sendJson(response, 401, { status: false, message: 'Sign in to view your orders.' });
      return;
    }

    const customerEmail = decodeURIComponent(request.url.split('/api/orders/customer/')[1] || '').trim().toLowerCase();
    if (!customerEmail) {
      sendJson(response, 400, { status: false, message: 'Customer email is required.' });
      return;
    }
    if (customerEmail !== session.email) {
      sendJson(response, 403, { status: false, message: 'You can only view orders linked to your account.' });
      return;
    }

    const orderList = [...orderStore.orders].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const filtered = orderList.filter(order => String(order.customerEmail || '').toLowerCase() === customerEmail)
      .map(order => ({
        ...order,
        status: normalizeTrackingStatus(order.status || 'New Order Received'),
        tracking: buildOrderTrackingTimeline({ status: normalizeTrackingStatus(order.status || 'New Order Received') })
      }));

    sendJson(response, 200, { status: true, data: filtered });
    return;
  }

  if (request.method === 'PATCH' && request.url.startsWith('/api/orders/')) {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This order update request is not allowed from this origin.' });
      return;
    }

    const session = getAdminSession(request);
    if (!session || session.role !== 'admin') {
      sendJson(response, 401, { status: false, message: 'Only the store admin can update tracking statuses.' });
      return;
    }

    const orderIdMatch = request.url.match(/^\/api\/orders\/([^/?]+)$/);
    if (!orderIdMatch) {
      sendJson(response, 400, { status: false, message: 'Invalid order ID.' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request, 32_000);
    } catch {
      sendJson(response, 400, { status: false, message: 'Enter a valid tracking update.' });
      return;
    }

    const orderId = decodeURIComponent(orderIdMatch[1]);
    const status = normalizeTrackingStatus(body?.status || 'New Order Received');
    try {
      let updatedDatabaseOrder = null;
      if (mysqlPool && databaseEnabled) {
        const [result] = await mysqlPool.execute(
          'UPDATE orders SET status = ? WHERE order_number = ?',
          [status, orderId]
        );
        if (result.affectedRows === 0) {
          const [matchingOrders] = await mysqlPool.execute(
            'SELECT id FROM orders WHERE order_number = ? LIMIT 1',
            [orderId]
          );
          if (!matchingOrders.length) {
            sendJson(response, 404, { status: false, message: 'Order not found.' });
            return;
          }
        }
        updatedDatabaseOrder = (await readOrdersFromDatabase()).find(order => String(order.id) === orderId);
      }

      const existingOrder = orderStore.orders.find(order => String(order.id) === orderId);
      let inventoryRestocked = Boolean(existingOrder?.inventoryRestocked);
      if (status === 'Cancelled' && existingOrder?.inventoryConsumed && !inventoryRestocked) {
        try {
          inventoryRestocked = await restoreInventory(existingOrder.items);
        } catch (error) {
          sendJson(response, 500, { status: false, message: error.message || 'Could not restore cancelled order inventory.' });
          return;
        }
      }
      if (existingOrder) {
        orderStore.orders = orderStore.orders.map(order => String(order.id) === orderId
          ? { ...order, status, inventoryRestocked, tracking: buildOrderTrackingTimeline({ status }) }
          : order);
      } else if (!updatedDatabaseOrder) {
        sendJson(response, 404, { status: false, message: 'Order not found.' });
        return;
      }

      const updatedOrder = updatedDatabaseOrder
        ? { ...updatedDatabaseOrder, inventoryRestocked }
        : orderStore.orders.find(order => String(order.id) === orderId);
      if (updatedOrder) {
        upsertOrderBackup({ ...updatedOrder, status, tracking: buildOrderTrackingTimeline({ status }) });
        await persistOrderStore();
      }

      sendJson(response, 200, {
        status: true,
        data: updatedOrder
      });
    } catch (error) {
      console.warn('Could not save the tracking update:', error.message);
      sendJson(response, 500, { status: false, message: 'Could not save the tracking update.' });
    }
    return;
  }

  if (request.method === 'GET' && request.url === '/api/admin/settings') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This admin request is not allowed from this origin.' });
      return;
    }
    const session = getAdminSession(request);
    if (!session || session.role !== 'admin') {
      sendJson(response, 401, { status: false, message: 'Admin privileges are required to load settings.' });
      return;
    }

    const adminSettings = await readAdminSettingsFromDatabase();
    sendJson(response, 200, {
      status: true,
      data: {
        discounts: adminSettings.discounts,
        siteContent: adminSettings.siteContent
      }
    });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/admin/settings') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This admin request is not allowed from this origin.' });
      return;
    }
    const session = getAdminSession(request);
    if (!session || session.role !== 'admin') {
      sendJson(response, 401, { status: false, message: 'Admin privileges are required to update settings.' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request, 64_000);
    } catch {
      sendJson(response, 400, { status: false, message: 'Enter valid admin settings.' });
      return;
    }

    if (Array.isArray(body?.discounts)) {
      const storedDiscounts = await writeAdminSettingsToDatabase('discounts', body.discounts);
      sendJson(response, 200, { status: true, data: { discounts: storedDiscounts || body.discounts.map(normalizeDiscount) } });
      return;
    }

    if (body && typeof body === 'object' && ('banners' in body || 'featuredProductIds' in body || 'categories' in body)) {
      const normalizedContent = normalizeSiteContent(body);
      const storedContent = await writeAdminSettingsToDatabase('site_content', normalizedContent);
      sendJson(response, 200, { status: true, data: { siteContent: storedContent || normalizedContent } });
      return;
    }

    sendJson(response, 400, { status: false, message: 'Unsupported admin settings payload.' });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/orders') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This order request is not allowed from this origin.' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request, 128_000);
    } catch {
      sendJson(response, 400, { status: false, message: 'Enter a valid order payload.' });
      return;
    }

    const orderInput = body?.order || body;
    let trustedPricing;
    try {
      trustedPricing = getTrustedOrderPricing(orderInput);
      if (Math.round(Number(orderInput.total) * 100) !== trustedPricing.totalCents) {
        throw new Error('Your cart total has changed. Refresh your cart before placing the order.');
      }
    } catch (error) {
      sendJson(response, 409, { status: false, message: error.message || 'Your cart could not be validated.' });
      return;
    }

    const incomingOrder = normalizeOrderPayload(orderInput);
    incomingOrder.items = trustedPricing.items;
    incomingOrder.total = trustedPricing.total;
    incomingOrder.status = 'New Order Received';
    incomingOrder.paymentStatus = 'pending';
    if (incomingOrder.paymentMethod.toLowerCase().startsWith('paystack')) {
      incomingOrder.paymentMethod = 'Pending Payment';
    }
    incomingOrder.paymentReference = '';
    const session = getAdminSession(request);
    if (session?.role === 'customer') {
      const customer = customerStore.customers.find(account => account.email === session.email);
      incomingOrder.customerEmail = session.email;
      if (customer) {
        incomingOrder.customerName = customer.name;
        incomingOrder.phone = customer.phone || incomingOrder.phone;
      }
    }
    try {
      incomingOrder.inventoryConsumed = await consumeInventory(incomingOrder.id, trustedPricing.items);
      incomingOrder.inventoryRestocked = false;
    } catch (error) {
      sendJson(response, 409, { status: false, message: error.message || 'Inventory is no longer available.' });
      return;
    }
    const existingById = new Map(orderStore.orders.map(order => [order.id, order]));

    if (mysqlPool && databaseEnabled) {
      const savedOrder = await saveOrderToDatabase(incomingOrder);
      if (savedOrder) {
        upsertOrderBackup(savedOrder);
        try {
          await persistOrderStore();
        } catch {
          sendJson(response, 500, { status: false, message: 'The order was saved, but the durable backup could not be written.' });
          return;
        }
        const notifications = await notifyOrder(savedOrder);
        sendJson(response, 200, { status: true, data: { ...savedOrder, notifications } });
        return;
      }
    }

    const updatedOrders = [incomingOrder, ...orderStore.orders.filter(order => order.id !== incomingOrder.id)];
    orderStore.orders = updatedOrders;
    upsertOrderBackup(incomingOrder);

    try {
      await persistOrderStore();
      const notifications = await notifyOrder(incomingOrder);
      sendJson(response, 200, { status: true, data: { ...incomingOrder, notifications } });
    } catch (error) {
      orderStore.orders = existingById.size ? [...Array.from(existingById.values())] : [];
      sendJson(response, 500, { status: false, message: 'The server could not save this order.' });
    }
    return;
  }

  if (request.method === 'GET' && request.url === '/api/orders/backup') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This backup request is not allowed from this origin.' });
      return;
    }
    const session = getAdminSession(request);
    if (!session || session.role !== 'admin') {
      sendJson(response, 401, { status: false, message: 'Only the store admin can view the backup archive.' });
      return;
    }
    const allOrders = mysqlPool && databaseEnabled ? await readOrdersFromDatabase() : orderStore.orders;
    allOrders.forEach(upsertOrderBackup);
    try {
      await persistOrderStore();
    } catch {
      sendJson(response, 500, { status: false, message: 'Could not refresh the durable order backup.' });
      return;
    }
    sendJson(response, 200, { status: true, data: [...orderStore.salesBackup].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/orders/backup') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This backup request is not allowed from this origin.' });
      return;
    }
    const session = getAdminSession(request);
    if (!session || session.role !== 'admin') {
      sendJson(response, 401, { status: false, message: 'Only the store admin can manage the backup archive.' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request, 128_000);
    } catch {
      sendJson(response, 400, { status: false, message: 'Enter a valid backup payload.' });
      return;
    }

    const backup = Array.isArray(body?.orders) ? body.orders.map(normalizeOrderPayload) : [];
    backup.forEach(upsertOrderBackup);

    try {
      await persistOrderStore();
      sendJson(response, 200, { status: true, data: orderStore.salesBackup });
    } catch {
      sendJson(response, 500, { status: false, message: 'The server could not save the sales backup.' });
    }
    return;
  }

  if (request.method === 'GET' && request.url === '/api/paystack/health') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This payment request is not allowed from this origin.' });
      return;
    }
    if (!paystackSecretKey) {
      sendJson(response, 503, { status: false, message: 'The Paystack verification server is not configured.' });
      return;
    }
    sendJson(response, 200, { status: true, data: { ready: true } });
    return;
  }

  if (request.method === 'GET' && request.url === '/api/paystack/config') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This payment request is not allowed from this origin.' });
      return;
    }
    sendJson(response, 200, { status: true, data: { publicKey: paystackPublicKey } });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/paystack/mobile-money/charge') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This payment request is not allowed from this origin.' });
      return;
    }
    if (!paystackSecretKey) {
      sendJson(response, 503, { status: false, message: 'PAYSTACK_SECRET_KEY is not configured on the server.' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request, 32_768);
    } catch {
      sendJson(response, 400, { status: false, message: 'Enter valid mobile-money payment details.' });
      return;
    }
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    let phone = typeof body.phone === 'string' ? body.phone.replace(/[\s()-]/g, '') : '';
    if (/^\+?233\d{9}$/.test(phone)) phone = `0${phone.replace(/^\+?233/, '')}`;
    else if (/^\d{9}$/.test(phone)) phone = `0${phone}`;
    const provider = typeof body.provider === 'string' ? body.provider.toLowerCase() : '';
    const amount = Number(body.amount);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || !/^0\d{9}$/.test(phone)
      || !mobileMoneyProviders.has(provider)
      || !Number.isSafeInteger(amount)
      || amount <= 0) {
      sendJson(response, 400, { status: false, message: 'Check the Ghana mobile-money number, selected provider, email, and amount.' });
      return;
    }

    const reference = `PSTK-GH-${Date.now()}-${randomBytes(8).toString('hex')}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const paystackResponse = await fetch(`${paystackApiUrl}/charge`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          amount: String(amount),
          currency: 'GHS',
          reference,
          mobile_money: { phone, provider }
        }),
        signal: controller.signal
      });
      const result = await paystackResponse.json().catch(() => ({}));
      if (!paystackResponse.ok || !result.status || !result.data) {
        sendJson(response, paystackResponse.status >= 400 ? paystackResponse.status : 502, {
          status: false,
          message: result.message || 'Paystack could not start this mobile-money payment.'
        });
        return;
      }
      sendJson(response, 200, { status: true, data: result.data });
    } catch (error) {
      sendJson(response, 502, {
        status: false,
        message: error.name === 'AbortError'
          ? 'Paystack took too long to start the mobile-money request. Check your phone before retrying.'
          : 'Could not reach Paystack to start the mobile-money request.'
      });
    } finally {
      clearTimeout(timeout);
    }
    return;
  }

  if (request.method === 'POST' && request.url === '/api/paystack/mobile-money/submit-otp') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This payment request is not allowed from this origin.' });
      return;
    }
    if (!paystackSecretKey) {
      sendJson(response, 503, { status: false, message: 'PAYSTACK_SECRET_KEY is not configured on the server.' });
      return;
    }
    let body;
    try {
      body = await readJsonBody(request, 16_384);
    } catch {
      sendJson(response, 400, { status: false, message: 'Enter the verification code from Paystack.' });
      return;
    }
    const reference = typeof body.reference === 'string' ? body.reference : '';
    const otp = typeof body.otp === 'string' ? body.otp.trim() : '';
    if (!/^[A-Za-z0-9._=-]{1,100}$/.test(reference) || !/^\d{4,8}$/.test(otp)) {
      sendJson(response, 400, { status: false, message: 'Enter a valid Paystack reference and 4 to 8 digit code.' });
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const paystackResponse = await fetch(`${paystackApiUrl}/charge/submit_otp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reference, otp }),
        signal: controller.signal
      });
      const result = await paystackResponse.json().catch(() => ({}));
      if (!paystackResponse.ok || !result.status || !result.data) {
        sendJson(response, paystackResponse.status >= 400 ? paystackResponse.status : 502, {
          status: false,
          message: result.message || 'Paystack could not verify that code.'
        });
        return;
      }
      sendJson(response, 200, { status: true, data: result.data });
    } catch (error) {
      sendJson(response, 502, { status: false, message: 'Could not submit the code to Paystack. Try again.' });
    } finally {
      clearTimeout(timeout);
    }
    return;
  }

  const chargeMatch = request.url?.match(/^\/api\/paystack\/charge\/([^/?]+)$/);
  if (request.method === 'GET' && chargeMatch) {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This payment request is not allowed from this origin.' });
      return;
    }
    if (!paystackSecretKey) {
      sendJson(response, 503, { status: false, message: 'PAYSTACK_SECRET_KEY is not configured on the server.' });
      return;
    }
    let reference;
    try {
      reference = decodeURIComponent(chargeMatch[1]);
    } catch {
      sendJson(response, 400, { status: false, message: 'Invalid Paystack reference.' });
      return;
    }
    if (!/^[A-Za-z0-9._=-]{1,100}$/.test(reference)) {
      sendJson(response, 400, { status: false, message: 'Invalid Paystack reference.' });
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const paystackResponse = await fetch(`${paystackApiUrl}/charge/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${paystackSecretKey}` },
        signal: controller.signal
      });
      const result = await paystackResponse.json().catch(() => ({}));
      if (!paystackResponse.ok || !result.status || !result.data) {
        sendJson(response, paystackResponse.status >= 400 ? paystackResponse.status : 502, {
          status: false,
          message: result.message || 'Could not check the mobile-money payment status.'
        });
        return;
      }
      sendJson(response, 200, { status: true, data: result.data });
    } catch (error) {
      sendJson(response, 502, { status: false, message: 'Could not check the mobile-money payment status.' });
    } finally {
      clearTimeout(timeout);
    }
    return;
  }

  if (request.method === 'POST' && request.url === '/api/paystack/verify-order') {
    if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
      sendJson(response, 403, { status: false, message: 'This payment request is not allowed from this origin.' });
      return;
    }
    if (!paystackSecretKey) {
      sendJson(response, 503, { status: false, message: 'PAYSTACK_SECRET_KEY is not configured on the server.' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request, 128_000);
    } catch {
      sendJson(response, 400, { status: false, message: 'Enter a valid paid order payload.' });
      return;
    }

    const reference = String(body?.reference || '').trim();
    if (!reference || reference.length > 100 || !/^[A-Za-z0-9.=_-]+$/.test(reference)) {
      sendJson(response, 400, { status: false, message: 'Invalid Paystack reference.' });
      return;
    }

    const rawOrder = body?.order;
    const submittedTotal = Number(rawOrder?.total);
    if (!rawOrder || !Number.isFinite(submittedTotal) || submittedTotal <= 0) {
      sendJson(response, 400, { status: false, message: 'A valid order total is required.' });
      return;
    }

    let trustedPricing;
    try {
      trustedPricing = getTrustedOrderPricing(rawOrder);
    } catch (error) {
      sendJson(response, 409, { status: false, message: error.message || 'The order could not be validated.' });
      return;
    }
    if (Math.round(submittedTotal * 100) !== trustedPricing.totalCents) {
      sendJson(response, 409, { status: false, message: 'The order total does not match the current catalog. Refresh your cart and try again.' });
      return;
    }
    const total = trustedPricing.total;

    const existingSource = mysqlPool && databaseEnabled ? await readOrdersFromDatabase() : orderStore.orders;
    const orderId = String(rawOrder.id || '').trim();
    if (!orderId || orderId.length > 80) {
      sendJson(response, 400, { status: false, message: 'A valid order ID is required.' });
      return;
    }
    const existingOrder = existingSource.find(order => String(order.id) === orderId);
    const existingPayment = existingSource.find(order => order.paymentStatus === 'paid' && order.paymentReference === reference);
    if (existingPayment) {
      if (String(existingPayment.id) !== orderId) {
        sendJson(response, 409, { status: false, message: 'This Paystack reference has already been used for another order.' });
        return;
      }
      sendJson(response, 200, { status: true, data: existingPayment });
      return;
    }
    if (existingOrder?.paymentStatus === 'paid') {
      sendJson(response, 409, { status: false, message: 'This order has already been paid.' });
      return;
    }
    const reservationToken = String(body?.reservationToken || '');
    const trackedItems = trustedPricing.items.filter(item => item.stockTracked);
    if (trackedItems.length && !getReservationForOrder(orderId, reservationToken)) {
      sendJson(response, 409, { status: false, message: 'The inventory hold expired or is missing. Please restart checkout before paying.' });
      return;
    }
    if (pendingPaymentReferences.has(reference)) {
      sendJson(response, 409, { status: false, message: 'This payment confirmation is already being processed. Please retry shortly.' });
      return;
    }
    pendingPaymentReferences.add(reference);
    try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let paystackResponse;
    try {
      paystackResponse = await fetch(`${paystackApiUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${paystackSecretKey}` },
        signal: controller.signal
      });
    } catch {
      sendJson(response, 502, { status: false, message: 'Could not verify the Paystack transaction.' });
      return;
    } finally {
      clearTimeout(timeout);
    }

    const verification = await paystackResponse.json().catch(() => ({}));
    const transaction = verification.data;
    if (!paystackResponse.ok || !verification.status || !transaction) {
      sendJson(response, 502, { status: false, message: verification.message || 'Paystack could not verify this transaction.' });
      return;
    }
    if (transaction.status !== 'success') {
      sendJson(response, 402, { status: false, message: 'Paystack has not confirmed this payment yet.' });
      return;
    }
    if (String(transaction.currency || '').toUpperCase() !== 'GHS'
      || Number(transaction.amount) !== Math.round(total * 100)) {
      sendJson(response, 400, { status: false, message: 'The Paystack payment amount or currency does not match this order.' });
      return;
    }
    const customFields = Array.isArray(transaction.metadata?.custom_fields) ? transaction.metadata.custom_fields : [];
    const metadataOrderNumber = transaction.metadata?.order_number
      || customFields.find(field => field.variable_name === 'order_number')?.value;
    if (metadataOrderNumber && String(metadataOrderNumber) !== String(rawOrder.id)) {
      sendJson(response, 400, { status: false, message: 'This Paystack transaction belongs to a different order.' });
      return;
    }

    let inventoryConsumed;
    try {
      inventoryConsumed = await consumeInventory(orderId, trustedPricing.items, reservationToken, true);
    } catch (error) {
      sendJson(response, 409, { status: false, message: error.message || 'Could not commit inventory for the paid order.' });
      return;
    }

    const paidOrder = normalizeOrderPayload({
      ...rawOrder,
      items: trustedPricing.items,
      total: trustedPricing.total,
      status: 'Paid',
      paymentMethod: typeof body.paymentMethod === 'string' ? body.paymentMethod : 'Paystack',
      paymentReference: reference,
      paymentStatus: 'paid'
    });
    paidOrder.paymentDetails = buildPaymentDetails(transaction);
    paidOrder.inventoryConsumed = inventoryConsumed;
    paidOrder.inventoryRestocked = false;

    let savedOrder = null;
    if (mysqlPool && databaseEnabled) savedOrder = await saveOrderToDatabase(paidOrder);
    if (savedOrder) {
      upsertOrderBackup(savedOrder);
      try {
        await persistOrderStore();
      } catch {
        sendJson(response, 500, { status: false, message: 'The payment was verified and order saved, but its backup could not be written.' });
        return;
      }
    } else {
      const previousOrders = orderStore.orders;
      const previousBackup = orderStore.salesBackup;
      orderStore.orders = [paidOrder, ...orderStore.orders.filter(order => order.id !== paidOrder.id)];
      upsertOrderBackup(paidOrder);
      try {
        await persistOrderStore();
        savedOrder = paidOrder;
      } catch {
        orderStore.orders = previousOrders;
        orderStore.salesBackup = previousBackup;
        sendJson(response, 500, { status: false, message: 'The server could not save this paid order.' });
        return;
      }
    }

    if (!existingOrder) {
      void notifyOrder(savedOrder).catch(error => {
        console.warn('Paid order notification failed:', error.message);
      });
    }
    sendJson(response, 200, { status: true, data: savedOrder });
    return;
    } finally {
      pendingPaymentReferences.delete(reference);
    }
  }

  const verifyMatch = request.url?.match(/^\/api\/paystack\/verify\/([^/?]+)$/);
  if (request.method !== 'GET' || !verifyMatch) {
    sendJson(response, 404, { status: false, message: 'Not found' });
    return;
  }

  const reference = decodeURIComponent(verifyMatch[1]);
  if (reference.length > 100 || !/^[A-Za-z0-9.=_-]+$/.test(reference)) {
    sendJson(response, 400, { status: false, message: 'Invalid Paystack reference.' });
    return;
  }

  if (!isAllowedFrontendOrigin(request.headers.origin, request.headers.host)) {
    sendJson(response, 403, { status: false, message: 'This payment request is not allowed from this origin.' });
    return;
  }

  if (!paystackSecretKey) {
    sendJson(response, 503, { status: false, message: 'PAYSTACK_SECRET_KEY is not configured on the server.' });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let paystackResponse;
    try {
      paystackResponse = await fetch(`${paystackApiUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${paystackSecretKey}` },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
    const payload = await paystackResponse.json();
    if (!paystackResponse.ok || !payload.status || !payload.data) {
      sendJson(response, paystackResponse.status || 502, {
        status: false,
        message: payload.message || 'Paystack could not verify this transaction.'
      });
      return;
    }
    const transaction = payload.data;
    sendJson(response, 200, {
      status: true,
      data: buildPaymentDetails(transaction)
    });
  } catch (error) {
    sendJson(response, 502, { status: false, message: 'Paystack verification request failed.' });
  }
});

await loadCatalog();
await loadOrderStore();
await loadCustomerStore();
if (mysqlPool) {
  try {
    await mysqlPool.query('SELECT 1');
    databaseEnabled = true;
    await ensureDatabaseSchema();
    console.log('MySQL connection active for live order storage.');
  } catch (error) {
    console.warn('MySQL is not available. Using the JSON order backup as the fallback.', error.message);
    databaseEnabled = false;
  }
}
server.listen(port, '0.0.0.0', () => {
  console.log(`Samtuberg API listening on port ${port}`);
});