import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

async function getAvailablePort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}

test('customer accounts require registered credentials and persist hashed passwords', async () => {
  const port = await getAvailablePort();
  const origin = `http://localhost:${port}`;
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'samtuberg-customer-auth-'));
  const storeFile = path.join(temporaryDirectory, 'customers.json');
  const orderStoreFile = path.join(temporaryDirectory, 'orders.json');
  const environment = {
    ...process.env,
    PORT: String(port),
    CUSTOMER_STORE_FILE: storeFile,
    ORDER_STORE_FILE: orderStoreFile,
    DISABLE_ORDER_EMAIL: 'true',
    FRONTEND_ORIGIN: origin,
    TRUST_PROXY: 'true',
    CATALOG_ADMIN_USERNAME: 'auth-test-admin',
    CATALOG_ADMIN_PASSWORD: 'Auth-Test-Admin-Secret-47!'
  };
  for (const key of ['DB_HOST', 'MYSQL_HOST', 'DB_USER', 'MYSQL_USER', 'MYSQL_USERNAME']) environment[key] = '';

  const server = spawn(process.execPath, [path.join(rootDir, 'server.mjs')], {
    cwd: rootDir,
    env: environment,
    stdio: 'ignore'
  });
  const request = (route, body, clientIp = '') => fetch(`${origin}${route}`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...(clientIp ? { 'X-Forwarded-For': clientIp } : {}) },
    body: JSON.stringify(body)
  });
  const get = (route, token = '') => fetch(`${origin}${route}`, {
    headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });

  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`API server exited with ${server.exitCode}`);
      try {
        const response = await fetch(`${origin}/api/products`, { headers: { Origin: origin } });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, 'API server did not become ready');

    const account = {
      name: 'Test Customer',
      username: 'test-customer',
      email: 'test-customer@example.com',
      phone: '0241234567',
      password: 'Customer-Secret-1!'
    };
    const weakRegistration = await request('/api/auth/register', { ...account, username: 'weak-customer', email: 'weak@example.com', password: 'short' });
    assert.equal(weakRegistration.status, 400);
    const simpleRegistration = await request('/api/auth/register', { ...account, username: 'simple-customer', email: 'simple@example.com', password: 'lowercase-password' });
    assert.equal(simpleRegistration.status, 400);
    const registration = await request('/api/auth/register', account);
    assert.equal(registration.status, 201);
    const created = await registration.json();
    assert.equal(created.data.user.username, account.username);
    assert.ok(created.data.token);
    assert.match(created.data.token, /^[a-f0-9]{64}$/);

    const savedAccounts = await readFile(storeFile, 'utf8');
    assert.doesNotMatch(savedAccounts, new RegExp(account.password));

    const unknownUser = await request('/api/auth/login', { username: 'not-registered', password: account.password });
    assert.equal(unknownUser.status, 401);
    const wrongPassword = await request('/api/auth/login', { username: account.username, password: 'wrong-password' });
    assert.equal(wrongPassword.status, 401);
    const validUsername = await request('/api/auth/login', { username: account.username, password: account.password });
    assert.equal(validUsername.status, 200);
    const validEmail = await request('/api/auth/login', { username: account.email, password: account.password });
    assert.equal(validEmail.status, 200);

    const secondAccount = {
      name: 'Another Customer',
      username: 'another-customer',
      email: 'another-customer@example.com',
      phone: '0241234568',
      password: 'Another-Customer-Secret-2!'
    };
    const secondRegistration = await request('/api/auth/register', secondAccount);
    assert.equal(secondRegistration.status, 201);
    const secondCreated = await secondRegistration.json();

    assert.equal((await get('/api/orders/mine')).status, 401);
    const submittedOrder = await fetch(`${origin}/api/orders`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: `Bearer ${created.data.token}` },
      body: JSON.stringify({
        id: 'TEST-OWNED-ORDER',
        customerName: 'Impersonated Name',
        customerEmail: secondAccount.email,
        total: 25,
        items: [{ id: 'p01', name: 'Front Bumper Shell', price: 1450, quantity: 1 }],
        total: 1450
      })
    });
    assert.equal(submittedOrder.status, 200);
    const savedOrder = await submittedOrder.json();
    assert.equal(savedOrder.data.customerEmail, account.email);
    assert.equal(savedOrder.data.customerName, account.name);

    const ownOrders = await get('/api/orders/mine', created.data.token);
    assert.equal(ownOrders.status, 200);
    assert.deepEqual((await ownOrders.json()).data.map(order => order.id), ['TEST-OWNED-ORDER']);
    const otherOrders = await get('/api/orders/mine', secondCreated.data.token);
    assert.equal(otherOrders.status, 200);
    assert.deepEqual((await otherOrders.json()).data, []);
    assert.equal((await get('/api/orders')).status, 401);
    assert.equal((await get(`/api/orders/customer/${encodeURIComponent(secondAccount.email)}`, created.data.token)).status, 403);
    assert.equal((await get('/api/admin/customers')).status, 401);

    const adminLogin = await request('/api/admin/login', {
      username: 'auth-test-admin',
      password: 'Auth-Test-Admin-Secret-47!'
    });
    const adminSession = await adminLogin.json();
    assert.equal(adminLogin.status, 200);
    const registeredCustomers = await get('/api/admin/customers', adminSession.data.token);
    const registeredCustomerList = await registeredCustomers.json();
    assert.equal(registeredCustomers.status, 200);
    assert.deepEqual(registeredCustomerList.data.map(customer => customer.username).sort(), [account.username, secondAccount.username].sort());
    assert.equal(Object.hasOwn(registeredCustomerList.data[0], 'passwordHash'), false);

    const duplicateAccount = await request('/api/auth/register', { ...account, email: 'another@example.com' });
    assert.equal(duplicateAccount.status, 409);
    const registrationRateLimited = await request('/api/auth/register', { ...account, username: 'sixth-customer', email: 'sixth@example.com' });
    assert.equal(registrationRateLimited.status, 429);
    const removedDemo = await request('/api/admin/login', { username: 'viewer', password: 'viewer123' });
    assert.equal(removedDemo.status, 401);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const rateLimitedLogin = await fetch(`${origin}/api/admin/login`, {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          'X-Forwarded-For': '198.51.100.1'
        },
        body: JSON.stringify({ username: 'rate-limit-test', password: 'wrong-password' })
      });
      assert.equal(rateLimitedLogin.status, 401);
    }
    const spoofedIpAttempt = await fetch(`${origin}/api/admin/login`, {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.1'
      },
      body: JSON.stringify({ username: 'rate-limit-test', password: 'wrong-password' })
    });
    assert.equal(spoofedIpAttempt.status, 429);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const customerLoginAttempt = await request('/api/auth/login', {
        username: 'customer-rate-limit-test',
        password: 'Wrong-Customer-Pass-1!'
      });
      assert.equal(customerLoginAttempt.status, 401);
    }
    const customerRateLimited = await request('/api/auth/login', {
      username: 'customer-rate-limit-test',
      password: 'Wrong-Customer-Pass-1!'
    });
    assert.equal(customerRateLimited.status, 429);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const rotatingUsernameAttempt = await request('/api/admin/login', {
        username: `rotating-user-${attempt}`,
        password: 'Wrong-Customer-Pass-1!'
      }, '203.0.113.42');
      assert.equal(rotatingUsernameAttempt.status, 401);
    }
    const ipRateLimited = await request('/api/auth/login', {
      username: 'another-rotated-user',
      password: 'Wrong-Customer-Pass-1!'
    }, '203.0.113.42');
    assert.equal(ipRateLimited.status, 429);
  } finally {
    server.kill();
    await new Promise(resolve => server.once('exit', resolve));
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});