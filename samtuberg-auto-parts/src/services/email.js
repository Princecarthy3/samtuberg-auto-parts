export const ORDER_EMAIL = 'samtuberg34@gmail.com';

const FORM_ID = 'xzbqjknp';
const FORM_ENDPOINT = `https://formspree.io/f/${FORM_ID}`;

export function buildPurchaseEmailMessage(order) {
  const safeCurrency = (value) => {
    const numericValue = Number(value) || 0;
    return `GH₵ ${numericValue.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const itemLines = (order.items || []).map((item, idx) => {
    const quantity = Number(item.qty || item.quantity || 1);
    const price = Number(item.price || 0);
    const total = quantity * price;
    const fitment = item.fit ? ` [Fitment: ${item.fit} ${item.year ? `(${item.year})` : ''}]` : (item.year ? ` [Model Year: ${item.year}]` : '');
    return `  ${idx + 1}. ${item.name}${fitment}\n     Quantity: ${quantity} unit(s) @ ${safeCurrency(price)} = ${safeCurrency(total)}`;
  }).join('\n\n');

  return [
    '======================================================================',
    '🚨 SAMTUBERG AUTO PARTS & CARS — OFFICIAL PURCHASE & RECEIPT CONFIRMATION',
    '======================================================================',
    '',
    `RECEIPT / ORDER #:  ${order.id || order.orderNumber}`,
    `DATE & TIME:        ${order.timestamp ? new Date(order.timestamp).toLocaleString('en-GB') : new Date().toLocaleString('en-GB')}`,
    `PAYMENT STATUS:     ${(order.paymentStatus || '').toUpperCase() === 'PAID' || order.status === 'Paid' ? '✅ PAID & CONFIRMED' : '⏳ PENDING CONFIRMATION / COD'}`,
    `PAYMENT CHANNEL:    ${order.paymentMethod || 'Paystack Official Checkout'}`,
    `TRANSACTION REF:    ${order.paymentReference || 'N/A'}`,
    '',
    '----------------------------------------------------------------------',
    'CUSTOMER INFORMATION',
    '----------------------------------------------------------------------',
    `Customer Name:      ${order.customerName || 'Valued Customer'}`,
    `Email Address:      ${order.customerEmail || 'Not provided'}`,
    `Phone Number:       ${order.phone || 'Not provided'}`,
    `Delivery Address:   ${order.address || 'Accra / Kumasi / Nationwide Ghana'}`,
    `City / Region:      ${order.city || 'Ghana'}`,
    '',
    '----------------------------------------------------------------------',
    'PURCHASED PRODUCTS & ITEMS BREAKDOWN',
    '----------------------------------------------------------------------',
    itemLines || '  No item details provided.',
    '',
    '----------------------------------------------------------------------',
    `GRAND TOTAL PAID / DUE: ${safeCurrency(order.total || 0)}`,
    '----------------------------------------------------------------------',
    '',
    'DISPATCH INSTRUCTIONS FOR STORE MANAGER (samtuberg34@gmail.com):',
    '1. Verify vehicle compatibility and physical part condition in store inventory.',
    '2. Call/WhatsApp customer at ' + (order.phone || 'the provided number') + ' to confirm delivery address.',
    '3. Update courier tracking status in the Samtuberg Admin Portal to "In Transit".',
    '',
    'Thank you for managing Samtuberg Auto Parts & Cars Company Limited.',
    'Location: Abrepo, opposite Kovak Hill International School, Kumasi, Ghana.'
  ].join('\n');
}

export async function sendToShop({ subject, body, replyTo = '', fields = {} }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const payload = {
      ...fields,
      subject,
      message: body,
      _subject: subject,
      recipient: ORDER_EMAIL,
      store_manager: ORDER_EMAIL,
      ...(replyTo ? { email: replyTo, _replyto: replyTo } : { email: ORDER_EMAIL, _replyto: ORDER_EMAIL })
    };

    const response = await fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false || result.success === false) {
      return {
        delivered: false,
        reason: result.errors?.map(error => error.message).join(' ')
          || `Email service returned HTTP ${response.status}.`
      };
    }
    return { delivered: true };
  } catch (error) {
    return {
      delivered: false,
      reason: error.name === 'AbortError' ? 'Email service timed out.' : 'Could not reach the email service.'
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendPurchaseOrderEmail(order) {
  const isPaid = (order.paymentStatus || '').toLowerCase() === 'paid' || order.status === 'Paid';
  const subject = `${isPaid ? '💰 PAID RECEIPT' : '🚨 NEW ORDER'}: ${order.id || order.orderNumber} — GH₵ ${(order.total || 0).toLocaleString()} (${order.customerName || 'Customer'})`;
  const result = await sendToShop({
    subject,
    body: buildPurchaseEmailMessage(order),
    replyTo: order.customerEmail || ORDER_EMAIL,
    fields: {
      order_id: order.id || order.orderNumber,
      customer_name: order.customerName || 'Customer',
      customer_email: order.customerEmail || 'Not provided',
      phone: order.phone || '',
      address: order.address || '',
      city: order.city || '',
      payment_status: isPaid ? 'Paid' : 'Pending',
      payment_method: order.paymentMethod || 'Paystack',
      payment_reference: order.paymentReference || 'N/A',
      order_total: `GH₵ ${(order.total || 0).toLocaleString()}`,
      items: (order.items || []).map(item => `${item.name} (x${item.qty || item.quantity || 1})`).join(', ')
    }
  });

  return result;
}

export async function sendPaymentReceivedEmail(order, paymentMethod = 'Paystack', reference = '') {
  const subject = `💰 CONFIRMED PAYMENT & OFFICIAL RECEIPT: ${order.id} — GH₵ ${(order.total || 0).toLocaleString()} (${paymentMethod})`;
  const body = buildPurchaseEmailMessage({
    ...order,
    paymentMethod,
    paymentReference: reference,
    paymentStatus: 'paid',
    status: 'Paid'
  });

  return await sendToShop({
    subject,
    body,
    replyTo: order.customerEmail || ORDER_EMAIL,
    fields: {
      event: 'payment_completed',
      receipt_id: order.id,
      order_id: order.id,
      amount_paid: `GH₵ ${(order.total || 0).toLocaleString()}`,
      method: paymentMethod,
      reference,
      customer: order.customerName,
      phone: order.phone,
      delivery_address: order.address,
      status: 'Paid'
    }
  });
}

export async function sendOrderTrackingUpdateEmail(order, newStatus, locationNote = '') {
  const subject = `🚚 ORDER UPDATE [${newStatus}]: ${order.id} — Samtuberg Auto Parts`;
  const body = [
    '====================================================',
    '🚚 SAMTUBERG AUTO PARTS — LIVE ORDER TRACKING UPDATE',
    '====================================================',
    '',
    `Order ID:         ${order.id}`,
    `Customer Name:    ${order.customerName}`,
    `Updated Status:   ${newStatus}`,
    `Current Location: ${locationNote || order.trackingLocation || 'In Transit'}`,
    `Destination:      ${order.address || 'Ghana Delivery'}`,
    `Updated At:       ${new Date().toLocaleString()}`,
    '',
    'This update has been logged into the live customer portal and tracking feed.'
  ].join('\n');

  return await sendToShop({
    subject,
    body,
    replyTo: order.customerEmail,
    fields: {
      event: 'tracking_updated',
      order_id: order.id,
      customer: order.customerName,
      status: newStatus,
      location: locationNote
    }
  });
}