import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPurchaseEmailMessage } from './email.js';

test('purchase email includes order, customer, and product information', () => {
  const payload = {
    id: 'ORD-123',
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    phone: '+1 555 987 6543',
    address: '123 Auto Street, Kumasi',
    items: [
      { name: 'Honda Civic Headlight', quantity: 1, price: 420 },
      { name: 'Toyota Corolla Foglight', quantity: 2, price: 240 }
    ],
    total: 660
  };

  const message = buildPurchaseEmailMessage(payload);

  assert.match(message, /New order received/i);
  assert.match(message, /ORD-123/);
  assert.match(message, /Jane Doe/);
  assert.match(message, /Honda Civic Headlight/);
  assert.match(message, /Toyota Corolla Foglight/);
  assert.match(message, /GH₵|\$/i);
});
