const DEFAULT_TEST_KEY = 'pk_test_5374cf88fc2e19a9bc95a8b081437d67f830a38c';

export function getPaystackApiBase() {
  const configured = (import.meta.env?.VITE_PAYSTACK_API_BASE || window?.PAYSTACK_API_BASE || '').replace(/\/+$/, '');
  if (configured) return configured;

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(host)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);

  if (protocol === 'http:' && isLocal) {
    return `${protocol}//${host}:8787`;
  }

  return '';
}

export function normalizeGhanaPhone(value = '') {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  if (/^233\d{9}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^0\d{9}$/.test(digits)) return digits;
  if (/^\d{9}$/.test(digits)) return `0${digits}`;
  return '';
}

export function isValidPaystackKey(key = '') {
  return /^pk_(live|test)_[A-Za-z0-9]+$/.test(String(key || '').trim());
}

export async function fetchPaystackConfig() {
  const apiBase = getPaystackApiBase();
  if (!apiBase) {
    throw new Error('Paystack verification server is not configured. Set VITE_PAYSTACK_API_BASE or PAYSTACK_API_BASE.');
  }

  const healthResponse = await fetch(`${apiBase}/api/paystack/health`, {
    headers: { Accept: 'application/json' }
  });
  const healthResult = await healthResponse.json().catch(() => ({}));
  if (!healthResponse.ok || healthResult.status === false) {
    throw new Error(healthResult.message || 'Paystack verification is not available right now.');
  }

  const configResponse = await fetch(`${apiBase}/api/paystack/config`, {
    headers: { Accept: 'application/json' }
  });
  const configResult = await configResponse.json().catch(() => ({}));
  if (!configResponse.ok || configResult.status === false) {
    throw new Error(configResult.message || 'The Paystack public key could not be loaded.');
  }

  const publicKey = String(configResult.data?.publicKey || '').trim() || DEFAULT_TEST_KEY;
  if (!isValidPaystackKey(publicKey)) {
    throw new Error('The Paystack public key is missing or invalid.');
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('paystack_public_key', publicKey);
  }

  return { apiBase, publicKey };
}

export async function verifyPaystackReference(apiBase, reference, expectedAmount, currency = 'GHS') {
  if (!apiBase || !reference) {
    throw new Error('Paystack verification is unavailable.');
  }

  const response = await fetch(`${apiBase}/api/paystack/verify/${encodeURIComponent(reference)}`, {
    headers: { Accept: 'application/json' }
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.status === false) {
    throw new Error(result.message || 'Paystack could not confirm this payment.');
  }

  const transaction = result.data || {};
  if (transaction.status !== 'success') {
    throw new Error('Paystack has not confirmed this payment yet.');
  }

  const rawAmount = Number(transaction.amount || 0);
  const normalizedAmount = Math.round(rawAmount / 100);
  if (Number(expectedAmount) > 0 && normalizedAmount !== Number(expectedAmount)) {
    throw new Error('Paystack amount does not match this order total.');
  }

  if (currency && String(transaction.currency || '').toUpperCase() !== String(currency).toUpperCase()) {
    throw new Error('Paystack currency does not match this order.');
  }

  return transaction;
}
