import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProductForAdmin,
  normalizeDiscount,
  normalizeSiteContent,
  isVerifiedPaidOrder,
  summarizeSales,
  normalizeTrackingStatus,
  buildOrderTrackingTimeline
} from './admin-helpers.mjs';

test('normalizeProductForAdmin keeps a valid product structure', () => {
  const product = normalizeProductForAdmin({
    name: 'Honda CR-V Front Bumper',
    category: 'body_parts',
    subCategory: 'bumpers',
    modelCompatibility: 'Honda CR-V',
    yearOfManufacture: '2024',
    price: 540,
    stock: 4,
    image: '/images/bumper.jpg'
  });

  assert.equal(product.name, 'Honda CR-V Front Bumper');
  assert.equal(product.category, 'body_parts');
  assert.equal(product.stock, 4);
  assert.equal(product.price, 540);
});

test('normalizeDiscount rejects invalid percentages and keeps active state', () => {
  const discount = normalizeDiscount({
    label: 'Weekend Deal',
    percent: 12,
    active: true
  });

  assert.equal(discount.label, 'Weekend Deal');
  assert.equal(discount.percent, 12);
  assert.equal(discount.active, true);

  assert.throws(() => normalizeDiscount({ label: 'Bad', percent: 120 }), /between 0 and 100/);
});

test('normalizeSiteContent merges default banner and featured items', () => {
  const content = normalizeSiteContent({
    featuredProductIds: ['p-1', 'p-2']
  });

  assert.ok(Array.isArray(content.banners));
  assert.equal(content.featuredProductIds.length, 2);
  assert.equal(content.categories.includes('body_parts'), true);
});

test('summarizeSales totals orders and averages the order value', () => {
  const summary = summarizeSales([
    { total: 200, paymentStatus: 'paid', paymentMethod: 'Paystack (card)', paymentReference: 'PAY-200' },
    { total: 300, paymentStatus: 'pending', paymentMethod: 'Pending Payment', paymentReference: '' },
    { total: 500, paymentStatus: 'paid', paymentMethod: 'Cash on Delivery', paymentReference: 'COD-500' },
    { total: 100, paymentStatus: 'paid', paymentMethod: 'Paystack (momo)', paymentReference: 'UNPAID-STB-100' }
  ]);

  assert.equal(summary.totalRevenue, 200);
  assert.equal(summary.averageOrderValue, 200);
  assert.equal(summary.orderCount, 1);
});

test('isVerifiedPaidOrder requires completed Paystack payment status and a reference', () => {
  assert.equal(isVerifiedPaidOrder({
    paymentStatus: 'paid',
    paymentMethod: 'Paystack (card)',
    paymentReference: 'PAY-1'
  }), true);
  assert.equal(isVerifiedPaidOrder({
    status: 'Paid',
    paymentMethod: 'Paystack (card)',
    paymentReference: 'PAY-2'
  }), false);
  assert.equal(isVerifiedPaidOrder({
    paymentStatus: 'paid',
    paymentMethod: 'Paystack (card)',
    paymentReference: 'UNPAID-STB-3'
  }), false);
});

test('normalizeTrackingStatus keeps statuses consistent for customers and admin tracking', () => {
  assert.equal(normalizeTrackingStatus('New Order (Invoice Created)'), 'New Order Received');
  assert.equal(normalizeTrackingStatus('Dispatched / In Transit'), 'In Transit');
  assert.equal(normalizeTrackingStatus('Processing & Fitment Check'), 'Processing');
  assert.equal(normalizeTrackingStatus('packed'), 'Packed');
  assert.equal(normalizeTrackingStatus('in-Transit'), 'In Transit');
  assert.equal(normalizeTrackingStatus('Delivered'), 'Delivered');
  assert.equal(normalizeTrackingStatus('random'), 'random');
});

test('buildOrderTrackingTimeline marks the current stage and completion progress', () => {
  const timeline = buildOrderTrackingTimeline({ status: 'In Transit' });
  assert.equal(timeline.status, 'In Transit');
  assert.equal(timeline.progress, 75);
  assert.equal(timeline.steps[0].completed, true);
  assert.equal(timeline.steps[5].completed, true);
  assert.equal(timeline.steps[6].current, true);
  assert.equal(timeline.steps[7].completed, false);
});

test('buildOrderTrackingTimeline marks every selectable order status as current', () => {
  for (const status of ['Paid', 'Out for Delivery', 'Cancelled', 'Returned']) {
    const timeline = buildOrderTrackingTimeline({ status });
    assert.equal(timeline.steps.find(step => step.status === status)?.current, true);
  }

  assert.equal(buildOrderTrackingTimeline({ status: 'Delivered' }).progress, 100);
  assert.equal(buildOrderTrackingTimeline({ status: 'Returned' }).progress, 100);
});
