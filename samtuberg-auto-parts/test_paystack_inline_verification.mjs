import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const testSecret = 'unit-test-paystack-secret';
const frontendOrigin = 'http://localhost:4173';
const secondFrontendOrigin = 'https://store.example.test';
const references = [];
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'samtuberg-shared-catalog-'));
const catalogFile = path.join(temporaryDirectory, 'catalog.json');
const orderStoreFile = path.join(temporaryDirectory, 'orders.json');
const mockPaystack = createServer(async (request, response) => {
  let rawBody = '';
  for await (const chunk of request) rawBody += chunk;
  const requestBody = rawBody ? JSON.parse(rawBody) : {};
  references.push({
    url: request.url,
    authorization: request.headers.authorization,
    body: requestBody
  });
  response.writeHead(200, { 'Content-Type': 'application/json' });
  if (request.method === 'POST' && request.url === '/charge') {
    response.end(JSON.stringify({
      status: true,
      message: 'Charge attempted',
      data: {
        reference: requestBody.reference,
        status: 'pending',
        amount: requestBody.amount,
        currency: 'GHS',
        display_text: 'Approve the payment request on your phone.'
      }
    }));
  } else if (request.method === 'POST' && request.url === '/charge/submit_otp') {
    response.end(JSON.stringify({
      status: true,
      data: { reference: requestBody.reference, status: 'success', amount: 145000, currency: 'GHS' }
    }));
  } else if (request.method === 'GET' && request.url.startsWith('/charge/')) {
    response.end(JSON.stringify({
      status: true,
      data: { reference: request.url.split('/').at(-1), status: 'success', amount: 145000, currency: 'GHS' }
    }));
  } else {
    const reference = request.url.split('/').at(-1);
    response.end(JSON.stringify({
      status: true,
      data: {
        reference,
        status: 'success',
        amount: reference === 'AMOUNT-MISMATCH-REF' ? 150000 : reference === 'TRACKED-STOCK-PAYMENT-REF' ? 240000 : 145000,
        currency: 'GHS',
        channel: 'card',
        paid_at: '2026-10-03T00:00:00.000Z',
        gateway_response: 'Successful',
        fees: 2500,
        authorization: {
          bank: 'Test Bank',
          brand: 'Visa',
          last4: '4242',
          card_type: 'visa debit'
        }
      }
    }));
  }
});

await new Promise(resolve => mockPaystack.listen(0, '127.0.0.1', resolve));
const mockAddress = mockPaystack.address();
const apiPort = 19000 + Math.floor(Math.random() * 1000);
const paymentServer = spawn(process.execPath, ['server.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(apiPort),
    PAYSTACK_SECRET_KEY: testSecret,
    VITE_PAYSTACK_PUBLIC_KEY: 'pk_test_publickey123',
    PAYSTACK_API_URL: `http://127.0.0.1:${mockAddress.port}`,
    FRONTEND_ORIGINS: `${frontendOrigin}, ${secondFrontendOrigin}`,
    CATALOG_ADMIN_USERNAME: 'catalog-admin-test',
    CATALOG_ADMIN_PASSWORD: 'catalog-admin-test-password',
    CATALOG_FILE: catalogFile,
    ORDER_STORE_FILE: orderStoreFile,
    DISABLE_ORDER_EMAIL: 'true'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
paymentServer.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
paymentServer.stderr.on('data', chunk => { serverOutput += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (serverOutput.includes(`listening on port ${apiPort}`)) return;
    if (paymentServer.exitCode !== null) throw new Error(`Payment server exited: ${serverOutput}`);
    await delay(100);
  }
  throw new Error(`Payment server failed to start: ${serverOutput}`);
}

try {
  await waitForServer();

  const healthResponse = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/health`, {
    headers: { Origin: secondFrontendOrigin }
  });
  assert.equal(healthResponse.status, 200);
  assert.equal(healthResponse.headers.get('access-control-allow-origin'), secondFrontendOrigin);
  assert.deepEqual((await healthResponse.json()).data, { ready: true });

  const patchPreflight = await fetch(`http://127.0.0.1:${apiPort}/api/orders/STB-PREFLIGHT-TEST`, {
    method: 'OPTIONS',
    headers: {
      Origin: frontendOrigin,
      'Access-Control-Request-Method': 'PATCH',
      'Access-Control-Request-Headers': 'authorization, content-type'
    }
  });
  assert.equal(patchPreflight.status, 204);
  assert.match(patchPreflight.headers.get('access-control-allow-methods') || '', /PATCH/);
  assert.equal(patchPreflight.headers.get('access-control-allow-origin'), frontendOrigin);

  const configResponse = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/config`, {
    headers: { Origin: frontendOrigin }
  });
  assert.equal(configResponse.status, 200);
  assert.deepEqual((await configResponse.json()).data, { publicKey: 'pk_test_publickey123' });

  const mobileMoneyChargeResponse = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/mobile-money/charge`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@example.com', amount: 145000, phone: '+233 55 123 4567', provider: 'mtn' })
  });
  const mobileMoneyCharge = await mobileMoneyChargeResponse.json();
  assert.equal(mobileMoneyChargeResponse.status, 200);
  assert.equal(mobileMoneyCharge.data.status, 'pending');
  const initializedCharge = references.find(request => request.url === '/charge');
  assert.deepEqual(initializedCharge.body.mobile_money, { phone: '0551234567', provider: 'mtn' });
  assert.equal(initializedCharge.body.amount, '145000');
  assert.equal(initializedCharge.body.currency, 'GHS');

  const invalidProviderResponse = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/mobile-money/charge`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@example.com', amount: 145000, phone: '0551234567', provider: 'unknown' })
  });
  assert.equal(invalidProviderResponse.status, 400);

  const chargeStatusResponse = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/charge/${mobileMoneyCharge.data.reference}`, {
    headers: { Origin: frontendOrigin }
  });
  assert.equal(chargeStatusResponse.status, 200);
  assert.equal((await chargeStatusResponse.json()).data.status, 'success');

  const otpResponse = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/mobile-money/submit-otp`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference: mobileMoneyCharge.data.reference, otp: '123456' })
  });
  assert.equal(otpResponse.status, 200);
  assert.equal((await otpResponse.json()).data.status, 'success');

  const emptyCatalogResponse = await fetch(`http://127.0.0.1:${apiPort}/api/products`, {
    headers: { Origin: frontendOrigin }
  });
  assert.deepEqual((await emptyCatalogResponse.json()).data, { overrides: [], deletedIds: [] });

  const xamppOriginResponse = await fetch(`http://127.0.0.1:${apiPort}/api/products`, {
    headers: { Origin: 'http://127.0.0.1' }
  });
  assert.equal(xamppOriginResponse.status, 200);
  assert.equal(xamppOriginResponse.headers.get('access-control-allow-origin'), 'http://127.0.0.1');

  const unauthorizedWrite = await fetch(`http://127.0.0.1:${apiPort}/api/products/p01`, {
    method: 'PUT',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(unauthorizedWrite.status, 401);

  const loginResponse = await fetch(`http://127.0.0.1:${apiPort}/api/admin/login`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'catalog-admin-test', password: 'catalog-admin-test-password' })
  });
  const loginResult = await loginResponse.json();
  assert.equal(loginResponse.status, 200);
  const adminHeaders = { Origin: frontendOrigin, Authorization: `Bearer ${loginResult.data.token}`, 'Content-Type': 'application/json' };

  const newProduct = {
    id: 'custom_shared_test',
    type: 'part',
    category: 'bodykits',
    subCategory: 'bodykits',
    name: 'Shared Body Kit',
    fit: 'Toyota Test',
    year: '2024',
    price: 1200,
    image: '/images/autoparts/image1.png',
    description: 'Shared product description',
    manufactureType: 'OEM grade',
    isCustom: true
  };
  const createResponse = await fetch(`http://127.0.0.1:${apiPort}/api/products/${newProduct.id}`, {
    method: 'PUT', headers: adminHeaders, body: JSON.stringify(newProduct)
  });
  assert.equal(createResponse.status, 200);

  const shellProduct = { ...newProduct, id: 'custom-shell-category', name: 'Test Shell', category: 'Shells & Panels' };
  const shellProductResponse = await fetch(`http://127.0.0.1:${apiPort}/api/products/${shellProduct.id}`, {
    method: 'PUT', headers: adminHeaders, body: JSON.stringify(shellProduct)
  });
  assert.equal(shellProductResponse.status, 200);
  const customCategoryProduct = { ...newProduct, id: 'custom-interior-trim', name: 'Interior Trim', category: 'interior-trim' };
  const customCategoryResponse = await fetch(`http://127.0.0.1:${apiPort}/api/products/${customCategoryProduct.id}`, {
    method: 'PUT', headers: adminHeaders, body: JSON.stringify(customCategoryProduct)
  });
  assert.equal(customCategoryResponse.status, 200);

  const updatedBaselineProduct = { ...newProduct, id: 'p02', name: 'Updated Baseline Bumper', category: 'bumpers', price: 1700, isCustom: false };
  const updateResponse = await fetch(`http://127.0.0.1:${apiPort}/api/products/p02`, {
    method: 'PUT', headers: adminHeaders, body: JSON.stringify(updatedBaselineProduct)
  });
  assert.equal(updateResponse.status, 200);

  const deleteResponse = await fetch(`http://127.0.0.1:${apiPort}/api/products/${newProduct.id}`, {
    method: 'DELETE', headers: { Origin: frontendOrigin, Authorization: adminHeaders.Authorization }
  });
  assert.equal(deleteResponse.status, 200);

  const sharedCatalogResponse = await fetch(`http://127.0.0.1:${apiPort}/api/products`, {
    headers: { Origin: secondFrontendOrigin }
  });
  const sharedCatalog = (await sharedCatalogResponse.json()).data;
  assert.equal(sharedCatalog.overrides.find(product => product.id === 'p02').price, 1700);
  assert.equal(sharedCatalog.overrides.find(product => product.id === 'p02').description, 'Shared product description');
  assert.equal(sharedCatalog.overrides.find(product => product.id === shellProduct.id).category, 'shells');
  assert.equal(sharedCatalog.overrides.find(product => product.id === customCategoryProduct.id).category, 'interior-trim');
  assert.equal(sharedCatalog.deletedIds.includes(newProduct.id), true);

  const updatedCatalogOrder = {
    id: 'STB-UPDATED-CATALOG-PRICE',
    customerName: 'Catalog Price Test',
    customerEmail: 'catalog-price@example.com',
    items: [{ id: 'p02', name: 'Ignored client name', price: 1700, quantity: 1 }],
    total: 1700
  };
  const updatedPriceOrderResponse = await fetch(`http://127.0.0.1:${apiPort}/api/orders`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedCatalogOrder)
  });
  const updatedPriceOrder = await updatedPriceOrderResponse.json();
  assert.equal(updatedPriceOrderResponse.status, 200);
  assert.equal(updatedPriceOrder.data.items[0].name, 'Updated Baseline Bumper');
  assert.equal(updatedPriceOrder.data.items[0].price, 1700);

  const staleCatalogPriceResponse = await fetch(`http://127.0.0.1:${apiPort}/api/orders`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...updatedCatalogOrder,
      id: 'STB-STALE-CATALOG-PRICE',
      items: [{ ...updatedCatalogOrder.items[0], price: 2100 }],
      total: 2100
    })
  });
  assert.equal(staleCatalogPriceResponse.status, 409);

  const inventoryProduct = { ...newProduct, id: 'custom-inventory-test', name: 'Tracked Inventory Test Part', stock: 2 };
  const inventoryProductResponse = await fetch(`http://127.0.0.1:${apiPort}/api/products/${inventoryProduct.id}`, {
    method: 'PUT', headers: adminHeaders, body: JSON.stringify(inventoryProduct)
  });
  assert.equal(inventoryProductResponse.status, 200);

  const inventoryItems = [{ id: inventoryProduct.id, price: inventoryProduct.price, quantity: 2 }];
  const firstReservationResponse = await fetch(`http://127.0.0.1:${apiPort}/api/inventory/reserve`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: 'STB-INVENTORY-HOLD', items: inventoryItems })
  });
  const firstReservation = await firstReservationResponse.json();
  assert.equal(firstReservationResponse.status, 200);
  assert.ok(firstReservation.data.reservationToken);
  const reservedCatalog = await fetch(`http://127.0.0.1:${apiPort}/api/products`, { headers: { Origin: frontendOrigin } });
  assert.equal((await reservedCatalog.json()).data.overrides.find(product => product.id === inventoryProduct.id).availableStock, 0);

  const competingReservation = await fetch(`http://127.0.0.1:${apiPort}/api/inventory/reserve`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: 'STB-INVENTORY-COMPETING', items: [{ ...inventoryItems[0], quantity: 1 }] })
  });
  assert.equal(competingReservation.status, 409);

  const reduceReservedStock = await fetch(`http://127.0.0.1:${apiPort}/api/products/${inventoryProduct.id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ ...inventoryProduct, stock: 1 })
  });
  assert.equal(reduceReservedStock.status, 409);

  const releaseReservation = await fetch(`http://127.0.0.1:${apiPort}/api/inventory/release`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: 'STB-INVENTORY-HOLD', reservationToken: firstReservation.data.reservationToken })
  });
  assert.equal(releaseReservation.status, 200);

  const codInventoryOrder = {
    id: 'STB-INVENTORY-COD',
    customerName: 'Inventory Test',
    customerEmail: 'inventory@example.com',
    items: [{ id: inventoryProduct.id, name: inventoryProduct.name, price: inventoryProduct.price, quantity: 1 }],
    total: inventoryProduct.price
  };
  const codInventoryResponse = await fetch(`http://127.0.0.1:${apiPort}/api/orders`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify(codInventoryOrder)
  });
  assert.equal(codInventoryResponse.status, 200);
  assert.equal((await codInventoryResponse.json()).data.inventoryConsumed, true);

  const cancelCodInventoryResponse = await fetch(`http://127.0.0.1:${apiPort}/api/orders/${codInventoryOrder.id}`, {
    method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ status: 'Cancelled' })
  });
  assert.equal(cancelCodInventoryResponse.status, 200);
  const restockedCatalogResponse = await fetch(`http://127.0.0.1:${apiPort}/api/products`, { headers: { Origin: frontendOrigin } });
  assert.equal((await restockedCatalogResponse.json()).data.overrides.find(product => product.id === inventoryProduct.id).availableStock, 2);

  const paymentOrderId = 'STB-TRACKED-INVENTORY-PAYMENT';
  const paymentReservationResponse = await fetch(`http://127.0.0.1:${apiPort}/api/inventory/reserve`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: paymentOrderId, items: inventoryItems })
  });
  const paymentReservation = await paymentReservationResponse.json();
  assert.equal(paymentReservationResponse.status, 200);
  const trackedPaymentOrder = {
    id: paymentOrderId,
    customerName: 'Inventory Payment Test',
    customerEmail: 'inventory-payment@example.com',
    items: [{ id: inventoryProduct.id, name: inventoryProduct.name, price: inventoryProduct.price, quantity: 2 }],
    total: inventoryProduct.price * 2
  };
  const trackedPaymentResponse = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/verify-order`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reference: 'TRACKED-STOCK-PAYMENT-REF',
      paymentMethod: 'Paystack (card)',
      reservationToken: paymentReservation.data.reservationToken,
      order: trackedPaymentOrder
    })
  });
  assert.equal(trackedPaymentResponse.status, 200);
  const soldOutCatalogResponse = await fetch(`http://127.0.0.1:${apiPort}/api/products`, { headers: { Origin: frontendOrigin } });
  assert.equal((await soldOutCatalogResponse.json()).data.overrides.find(product => product.id === inventoryProduct.id).availableStock, 0);

  const storedCatalog = JSON.parse(await readFile(catalogFile, 'utf8'));
  assert.equal(storedCatalog.overrides.p02.name, 'Updated Baseline Bumper');
  assert.equal(storedCatalog.deletedIds.includes(newProduct.id), true);

  const logoutResponse = await fetch(`http://127.0.0.1:${apiPort}/api/admin/logout`, {
    method: 'POST', headers: { Origin: frontendOrigin, Authorization: adminHeaders.Authorization }
  });
  assert.equal(logoutResponse.status, 200);
  const revokedWrite = await fetch(`http://127.0.0.1:${apiPort}/api/products/p01`, {
    method: 'PUT', headers: adminHeaders, body: JSON.stringify(updatedBaselineProduct)
  });
  assert.equal(revokedWrite.status, 401);

  const response = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/verify/INLINE-TEST-REF`, {
    headers: { Origin: frontendOrigin }
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), frontendOrigin);
  assert.equal(result.data.reference, 'INLINE-TEST-REF');
  assert.equal(result.data.status, 'success');
  assert.equal(result.data.amount, 145000);
  assert.equal(result.data.channel, 'card');
  assert.equal(result.data.cardLast4, '4242');
  assert.equal(references.find(item => item.url === '/transaction/verify/INLINE-TEST-REF').authorization, `Bearer ${testSecret}`);

  const paidOrder = {
    id: 'STB-PAYMENT-VERIFY-TEST',
    customerName: 'Test Customer',
    customerEmail: 'buyer@example.com',
    phone: '0241234567',
    address: 'Accra, Ghana',
    items: [{ id: 'p01', name: 'Test part', price: 1450, quantity: 1 }],
    total: 1450
  };
  const unverifiedOrderResponse = await fetch(`http://127.0.0.1:${apiPort}/api/orders`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...paidOrder,
      id: 'STB-UNVERIFIED-TEST',
      status: 'Paid',
      paymentMethod: 'Paystack',
      paymentReference: 'FAKE-REF',
      paymentDetails: { status: 'success', gatewayResponse: 'Client-forged confirmation' }
    })
  });
  const unverifiedOrder = await unverifiedOrderResponse.json();
  assert.equal(unverifiedOrder.data.status, 'New Order Received');
  assert.equal(unverifiedOrder.data.paymentStatus, 'pending');
  assert.equal(unverifiedOrder.data.paymentDetails, undefined);

  const tamperedPriceOrder = await fetch(`http://127.0.0.1:${apiPort}/api/orders`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...paidOrder, id: 'STB-TAMPERED-PRICE', total: 1, items: [{ ...paidOrder.items[0], price: 1 }] })
  });
  assert.equal(tamperedPriceOrder.status, 409);

  const concurrentOrderResults = await Promise.all(Array.from({ length: 12 }, (_, index) => fetch(`http://127.0.0.1:${apiPort}/api/orders`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...paidOrder,
      id: `STB-CONCURRENT-${index}`,
      customerEmail: `concurrent-${index}@example.com`
    })
  })));
  assert.equal(concurrentOrderResults.every(response => response.status === 200), true);
  const concurrentOrderBackup = JSON.parse(await readFile(orderStoreFile, 'utf8'));
  assert.equal(concurrentOrderBackup.orders.filter(order => order.id.startsWith('STB-CONCURRENT-')).length, 12);
  assert.equal(concurrentOrderBackup.salesBackup.filter(order => order.id.startsWith('STB-CONCURRENT-')).length, 12);

  const confirmedPayment = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/verify-order`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference: 'VERIFIED-ORDER-REF', paymentMethod: 'Paystack (card)', order: paidOrder })
  });
  const confirmedResult = await confirmedPayment.json();
  assert.equal(confirmedPayment.status, 200);
  assert.equal(confirmedResult.data.status, 'Paid');
  assert.equal(confirmedResult.data.paymentReference, 'VERIFIED-ORDER-REF');
  assert.deepEqual(confirmedResult.data.paymentDetails, {
    reference: 'VERIFIED-ORDER-REF',
    status: 'success',
    amount: 145000,
    amountMinor: 145000,
    currency: 'GHS',
    channel: 'card',
    paidAt: '2026-10-03T00:00:00.000Z',
    gatewayResponse: 'Successful',
    feesMinor: 2500,
    provider: 'Test Bank',
    cardBrand: 'Visa',
    cardLast4: '4242',
    cardType: 'visa debit'
  });
  const persistedPaidOrder = JSON.parse(await readFile(orderStoreFile, 'utf8')).orders
    .find(order => order.id === paidOrder.id);
  assert.deepEqual(persistedPaidOrder.paymentDetails, confirmedResult.data.paymentDetails);

  const paymentRetry = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/verify-order`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference: 'VERIFIED-ORDER-REF', paymentMethod: 'Paystack (card)', order: paidOrder })
  });
  const paymentRetryResult = await paymentRetry.json();
  assert.equal(paymentRetry.status, 200);
  assert.equal(paymentRetryResult.data.id, paidOrder.id);

  const replayedReference = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/verify-order`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reference: 'VERIFIED-ORDER-REF',
      order: { ...paidOrder, id: 'STB-REFERENCE-REUSE-TEST' }
    })
  });
  assert.equal(replayedReference.status, 409);

  const tamperedPaymentTotal = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/verify-order`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reference: 'TAMPERED-TOTAL-REF',
      order: { ...paidOrder, id: 'STB-TAMPERED-PAYMENT', total: 1, items: [{ ...paidOrder.items[0], price: 1 }] }
    })
  });
  assert.equal(tamperedPaymentTotal.status, 409);

  const trackByOrderId = await fetch(`http://127.0.0.1:${apiPort}/api/tracking?query=${encodeURIComponent(paidOrder.id)}`, {
    headers: { Origin: frontendOrigin }
  });
  const orderTracking = await trackByOrderId.json();
  assert.equal(trackByOrderId.status, 200);
  assert.equal(orderTracking.data.length, 1);
  assert.equal(orderTracking.data[0].status, 'Paid');
  assert.equal(orderTracking.data[0].tracking.steps.find(step => step.status === 'Paid').current, true);

  const adminLogin = await fetch(`http://127.0.0.1:${apiPort}/api/admin/login`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'catalog-admin-test', password: 'catalog-admin-test-password' })
  });
  const adminLoginResult = await adminLogin.json();
  const statusUpdate = await fetch(`http://127.0.0.1:${apiPort}/api/orders/${paidOrder.id}`, {
    method: 'PATCH',
    headers: { Origin: frontendOrigin, Authorization: `Bearer ${adminLoginResult.data.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'In Transit' })
  });
  assert.equal(statusUpdate.status, 200);
  const updatedTracking = await fetch(`http://127.0.0.1:${apiPort}/api/tracking?query=${encodeURIComponent(paidOrder.id)}`, {
    headers: { Origin: frontendOrigin }
  });
  const updatedTrackingResult = await updatedTracking.json();
  assert.equal(updatedTrackingResult.data[0].status, 'In Transit');
  assert.equal(updatedTrackingResult.data[0].tracking.steps.find(step => step.status === 'In Transit').current, true);

  const privateBackup = await fetch(`http://127.0.0.1:${apiPort}/api/orders/backup`, {
    headers: { Origin: frontendOrigin }
  });
  assert.equal(privateBackup.status, 401);
  const sharedBackup = await fetch(`http://127.0.0.1:${apiPort}/api/orders/backup`, {
    headers: { Origin: frontendOrigin, Authorization: `Bearer ${adminLoginResult.data.token}` }
  });
  const sharedBackupResult = await sharedBackup.json();
  assert.equal(sharedBackup.status, 200);
  assert.equal(sharedBackupResult.data.find(order => order.id === paidOrder.id)?.status, 'In Transit');
  const diskBackup = JSON.parse(await readFile(orderStoreFile, 'utf8'));
  assert.equal(diskBackup.salesBackup.find(order => order.id === paidOrder.id)?.status, 'In Transit');

  const trackByPhone = await fetch(`http://127.0.0.1:${apiPort}/api/tracking?query=${encodeURIComponent('+233 24 123 4567')}`, {
    headers: { Origin: secondFrontendOrigin }
  });
  assert.equal((await trackByPhone.json()).data[0].id, paidOrder.id);

  const rejectedPayment = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/verify-order`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference: 'AMOUNT-MISMATCH-REF', order: { ...paidOrder, id: 'STB-UNPAID-TEST' } })
  });
  assert.equal(rejectedPayment.status, 400);
  const unpaidTracking = await fetch(`http://127.0.0.1:${apiPort}/api/tracking?query=STB-UNPAID-TEST`, {
    headers: { Origin: frontendOrigin }
  });
  assert.deepEqual((await unpaidTracking.json()).data, []);

  const blockedOriginResponse = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/verify/BLOCKED-REF`, {
    headers: { Origin: 'https://untrusted.example' }
  });
  assert.equal(blockedOriginResponse.status, 403);

  const removedDirectCharge = await fetch(`http://127.0.0.1:${apiPort}/api/paystack/charge/mobile-money`, {
    method: 'POST',
    headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@example.com', amount: 145000, phone: '0241234567', provider: 'mtn' })
  });
  assert.equal(removedDirectCharge.status, 404);
  assert.equal(references.some(item => item.url === '/charge/mobile-money'), false);

  console.log('Paystack Inline verification tests passed.');
} finally {
  paymentServer.kill();
  await new Promise(resolve => mockPaystack.close(resolve));
  await rm(temporaryDirectory, { recursive: true, force: true });
}