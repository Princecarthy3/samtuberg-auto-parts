export const DEFAULT_SITE_CONTENT = {
  banners: [{
    id: 'main',
    eyebrow: 'Genuine Body Parts • Trusted Used Cars',
    title: 'STRIP IT.\nSWAP IT.\nROAD READY.',
    subtitle: 'Samtuberg deals mainly in quality auto body parts and ready-to-drive used cars.',
    ctaPrimary: 'Browse Auto Parts',
    ctaSecondary: 'View Cars'
  }],
  categories: ['body_parts', 'cars', 'headlights', 'taillights', 'bumpers', 'mirrors', 'grilles', 'foglights'],
  featuredProductIds: []
};

export function normalizeProductForAdmin(product = {}) {
  const name = String(product.name || '').trim();
  const category = String(product.category || 'body_parts').trim();
  const modelCompatibility = String(product.modelCompatibility || product.fit || 'Universal Fit').trim();
  const yearOfManufacture = String(product.yearOfManufacture || product.year || '2024').trim();
  const price = Number(product.price ?? 0);
  const stock = Number(product.stock ?? product.quantity ?? 1);
  const image = String(product.image || '/images/placeholder.jpg').trim();

  if (!name) throw new Error('Product name is required.');
  if (!['body_parts', 'cars'].includes(category)) throw new Error('Invalid product category.');
  if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be greater than zero.');
  if (!Number.isFinite(stock) || stock < 0) throw new Error('Stock must be zero or more.');

  return {
    id: product.id || `prod-${Date.now()}`,
    name,
    category,
    subCategory: String(product.subCategory || product.category || 'bumpers').trim(),
    modelCompatibility,
    yearOfManufacture,
    price,
    stock,
    quantity: stock,
    image,
    description: String(product.description || '').trim(),
    isVehicle: Boolean(product.isVehicle || category === 'cars'),
    featured: Boolean(product.featured),
    discount: Number(product.discount || 0),
    manufactureType: String(product.manufactureType || 'OEM Grade Genuine').trim(),
    specs: product.specs || { Fitment: modelCompatibility }
  };
}

export function normalizeDiscount(discount = {}) {
  const label = String(discount.label || 'Discount').trim();
  const percent = Number(discount.percent ?? 0);
  const active = Boolean(discount.active);

  if (!label) throw new Error('Discount label is required.');
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('Discount percentage must be between 0 and 100.');
  }

  return {
    id: discount.id || `discount-${Date.now()}`,
    label,
    percent,
    active
  };
}

export function normalizeSiteContent(content = {}) {
  const merged = {
    ...DEFAULT_SITE_CONTENT,
    ...(content || {})
  };

  const banners = Array.isArray(content?.banners) && content.banners.length
    ? content.banners
    : DEFAULT_SITE_CONTENT.banners;

  const categories = Array.isArray(content?.categories) && content.categories.length
    ? content.categories
    : DEFAULT_SITE_CONTENT.categories;

  const featuredProductIds = Array.isArray(content?.featuredProductIds)
    ? [...new Set(content.featuredProductIds.map(String))]
    : DEFAULT_SITE_CONTENT.featuredProductIds;

  return {
    ...merged,
    banners,
    categories,
    featuredProductIds
  };
}

export function isVerifiedPaidOrder(order = {}) {
  const paymentStatus = String(order.paymentStatus || '').toLowerCase();
  const paymentMethod = String(order.paymentMethod || '').toLowerCase();
  const reference = String(order.paymentReference || '').trim();

  return paymentStatus === 'paid'
    && paymentMethod.startsWith('paystack')
    && Boolean(reference)
    && !reference.toUpperCase().startsWith('UNPAID-');
}

export function summarizeSales(orders = []) {
  const paidOrders = Array.isArray(orders) ? orders.filter(isVerifiedPaidOrder) : [];
  const totalRevenue = paidOrders.reduce((sum, order) => {
    const total = Number(order.total);
    return sum + (Number.isFinite(total) && total > 0 ? total : 0);
  }, 0);
  const orderCount = paidOrders.length;
  const averageOrderValue = orderCount ? Number((totalRevenue / orderCount).toFixed(2)) : 0;

  return {
    totalRevenue,
    orderCount,
    averageOrderValue
  };
}

export function normalizeTrackingStatus(status = 'New Order Received') {
  const value = String(status || 'New Order Received').trim();
  const normalized = value.toLowerCase().replace(/[_-]+/g, ' ');

  const map = {
    'new order received': 'New Order Received',
    'new order (invoice created)': 'New Order Received',
    'new order invoice created': 'New Order Received',
    'new order': 'New Order Received',
    pending: 'Pending',
    'pending payment': 'Pending',
    confirmed: 'Confirmed',
    paid: 'Paid',
    processing: 'Processing',
    'processing & fitment check': 'Processing',
    'processing and fitment check': 'Processing',
    packed: 'Packed',
    'in transit': 'In Transit',
    'in-transit': 'In Transit',
    'dispatched / in transit': 'In Transit',
    'dispatched in transit': 'In Transit',
    dispatched: 'In Transit',
    shipped: 'In Transit',
    'out for delivery': 'Out for Delivery',
    outfordelivery: 'Out for Delivery',
    'delivered to customer': 'Delivered',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    returned: 'Returned',
    return: 'Returned'
  };

  if (Object.prototype.hasOwnProperty.call(map, normalized)) {
    return map[normalized];
  }

  if (!value) {
    return 'New Order Received';
  }

  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned || 'New Order Received';
}

export function buildOrderTrackingTimeline(order = {}) {
  const status = normalizeTrackingStatus(order.status || 'New Order Received');
  const stages = [
    { key: 'received', status: 'New Order Received', label: 'Order Received' },
    { key: 'pending', status: 'Pending', label: 'Pending' },
    { key: 'confirmed', status: 'Confirmed', label: 'Confirmed' },
    { key: 'paid', status: 'Paid', label: 'Paid' },
    { key: 'processing', status: 'Processing', label: 'Processing' },
    { key: 'packed', status: 'Packed', label: 'Packed' },
    { key: 'transit', status: 'In Transit', label: 'In Transit' },
    { key: 'delivery', status: 'Out for Delivery', label: 'Out for Delivery' },
    { key: 'done', status: 'Delivered', label: 'Delivered to Customer' },
    { key: 'cancelled', status: 'Cancelled', label: 'Cancelled' },
    { key: 'returned', status: 'Returned', label: 'Returned' }
  ];

  const currentIndex = Math.max(0, stages.findIndex(step => step.status === status));
  const deliveredIndex = stages.findIndex(step => step.status === 'Delivered');
  const progress = Math.min(100, Math.round((currentIndex / deliveredIndex) * 100));

  return {
    status,
    progress,
    steps: stages.map((step, index) => ({
      ...step,
      index,
      title: step.label,
      current: index === currentIndex,
      completed: index < currentIndex
    }))
  };
}
