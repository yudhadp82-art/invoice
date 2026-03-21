// LocalStorage CRUD helpers for all entities

const KEYS = {
  PRODUCTS: 'invoicepro_products',
  CUSTOMERS: 'invoicepro_customers',
  INVOICES: 'invoicepro_invoices',
  DELIVERY_NOTES: 'invoicepro_delivery_notes',
  PURCHASES: 'invoicepro_purchases',
  PRICE_CATEGORIES: 'invoicepro_price_categories',
  SUPPLIERS: 'invoicepro_suppliers',
  TELEGRAM_ORDERS: 'invoicepro_telegram_orders',
  TELEGRAM_OFFSET: 'invoicepro_telegram_offset',
  HPP_REPORTS: 'invoicepro_hpp_reports',
};

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getAll(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveAll(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function getById(key, id) {
  const items = getAll(key);
  return items.find(item => item.id === id) || null;
}

function create(key, item) {
  const items = getAll(key);
  const newItem = {
    ...item,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  items.push(newItem);
  saveAll(key, items);
  return newItem;
}

function update(key, id, updates) {
  const items = getAll(key);
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return null;
  items[index] = {
    ...items[index],
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  saveAll(key, items);
  return items[index];
}

function remove(key, id) {
  const items = getAll(key);
  const filtered = items.filter(item => item.id !== id);
  saveAll(key, filtered);
  return filtered;
}

// Products
export const Products = {
  getAll: () => getAll(KEYS.PRODUCTS),
  getById: (id) => getById(KEYS.PRODUCTS, id),
  create: (product) => create(KEYS.PRODUCTS, product),
  update: (id, updates) => update(KEYS.PRODUCTS, id, updates),
  delete: (id) => remove(KEYS.PRODUCTS, id),
};

// Customers
export const Customers = {
  getAll: () => getAll(KEYS.CUSTOMERS),
  getById: (id) => getById(KEYS.CUSTOMERS, id),
  create: (customer) => create(KEYS.CUSTOMERS, customer),
  update: (id, updates) => update(KEYS.CUSTOMERS, id, updates),
  delete: (id) => remove(KEYS.CUSTOMERS, id),
};

// Suppliers
export const Suppliers = {
  getAll: () => getAll(KEYS.SUPPLIERS),
  getById: (id) => getById(KEYS.SUPPLIERS, id),
  create: (supplier) => create(KEYS.SUPPLIERS, supplier),
  update: (id, updates) => update(KEYS.SUPPLIERS, id, updates),
  delete: (id) => remove(KEYS.SUPPLIERS, id),
};

// Invoices
export const Invoices = {
  getAll: () => getAll(KEYS.INVOICES),
  getById: (id) => getById(KEYS.INVOICES, id),
  create: (invoice) => create(KEYS.INVOICES, invoice),
  update: (id, updates) => update(KEYS.INVOICES, id, updates),
  delete: (id) => remove(KEYS.INVOICES, id),
};

// Delivery Notes (Surat Jalan)
export const DeliveryNotes = {
  getAll: () => getAll(KEYS.DELIVERY_NOTES),
  getById: (id) => getById(KEYS.DELIVERY_NOTES, id),
  create: (note) => create(KEYS.DELIVERY_NOTES, note),
  update: (id, updates) => update(KEYS.DELIVERY_NOTES, id, updates),
  delete: (id) => remove(KEYS.DELIVERY_NOTES, id),
};

// Purchases
export const Purchases = {
  getAll: () => getAll(KEYS.PURCHASES),
  getById: (id) => getById(KEYS.PURCHASES, id),
  create: (purchase) => create(KEYS.PURCHASES, purchase),
  update: (id, updates) => update(KEYS.PURCHASES, id, updates),
  delete: (id) => remove(KEYS.PURCHASES, id),
};

// Price Categories
export const PriceCategories = {
  getAll: () => getAll(KEYS.PRICE_CATEGORIES),
  getById: (id) => getById(KEYS.PRICE_CATEGORIES, id),
  create: (category) => create(KEYS.PRICE_CATEGORIES, category),
  update: (id, updates) => update(KEYS.PRICE_CATEGORIES, id, updates),
  delete: (id) => remove(KEYS.PRICE_CATEGORIES, id),
};

// HPP Reports (Harga Pokok Penjualan)
export const HppReports = {
  getAll: () => getAll(KEYS.HPP_REPORTS),
  getById: (id) => getById(KEYS.HPP_REPORTS, id),
  getByInvoiceId: (invoiceId) => getAll(KEYS.HPP_REPORTS).find(r => r.invoiceId === invoiceId) || null,
  create: (report) => create(KEYS.HPP_REPORTS, report),
  update: (id, updates) => update(KEYS.HPP_REPORTS, id, updates),
  delete: (id) => remove(KEYS.HPP_REPORTS, id),
};

// Telegram Orders
export const TelegramOrders = {
  getAll: () => getAll(KEYS.TELEGRAM_ORDERS),
  getById: (id) => getById(KEYS.TELEGRAM_ORDERS, id),
  create: (order) => create(KEYS.TELEGRAM_ORDERS, order),
  update: (id, updates) => update(KEYS.TELEGRAM_ORDERS, id, updates),
  delete: (id) => remove(KEYS.TELEGRAM_ORDERS, id),
  getOffset: () => {
    const val = localStorage.getItem(KEYS.TELEGRAM_OFFSET) || '0';
    return Number(val);
  },
  setOffset: (val) => {
    localStorage.setItem(KEYS.TELEGRAM_OFFSET, String(val));
  }
};

// Seed demo data
export function seedDemoData() {
  if (getAll(KEYS.PRICE_CATEGORIES).length === 0) {
    create(KEYS.PRICE_CATEGORIES, { id: 'cat-retail', name: 'Retail (Default)' });
    create(KEYS.PRICE_CATEGORIES, { id: 'cat-grosir', name: 'Grosir' });
    create(KEYS.PRICE_CATEGORIES, { id: 'cat-vip', name: 'VIP' });
  }

  if (getAll(KEYS.PRODUCTS).length > 0) return;

  const products = [
    { name: 'Bawang Merah Brebes', sku: 'BMB-01', category: 'Bumbu', purchaseCost: 25000, sellPrice: 35000, stock: 50, unit: 'kg', categoryPrices: { 'cat-grosir': 32000, 'cat-vip': 30000 } },
    { name: 'Bawang Putih Kating', sku: 'BPK-01', category: 'Bumbu', purchaseCost: 32000, sellPrice: 42000, stock: 30, unit: 'kg', categoryPrices: { 'cat-grosir': 38000, 'cat-vip': 36000 } },
    { name: 'Cabe Rawit Merah', sku: 'CRM-01', category: 'Sayuran', purchaseCost: 65000, sellPrice: 80000, stock: 15, unit: 'kg', categoryPrices: { 'cat-grosir': 75000, 'cat-vip': 72000 } },
    { name: 'Kunyit Bubuk Murni', sku: 'KYB-01', category: 'Rempah', purchaseCost: 45000, sellPrice: 60000, stock: 100, unit: 'pack', categoryPrices: { 'cat-grosir': 55000, 'cat-vip': 52000 } },
    { name: 'Sawi Hijau / Caisim', sku: 'SWH-01', category: 'Sayuran', purchaseCost: 4000, sellPrice: 7000, stock: 120, unit: 'ikat', categoryPrices: { 'cat-grosir': 6000, 'cat-vip': 5500 } },
  ];

  const customers = [
    { name: 'Budi Santoso', company: 'Toko Segar Jaya', phone: '08123456789', email: 'budi@segarjaya.com', address: 'Jl. Pasar Baru No.10', priceCategoryId: 'cat-retail' },
    { name: 'Siti Aminah', company: 'Warung Barokah', phone: '08987654321', email: 'siti@barokah.com', address: 'Jl. Melati No. 5', priceCategoryId: 'cat-grosir' },
    { name: 'Rumah Makan Padang Saiyo', company: '', phone: '08112233445', email: 'rm.saiyo@email.com', address: 'Komp. Ruko Indah Blok A', priceCategoryId: 'cat-vip' },
  ];

  const suppliers = [
    { name: 'Agus Petani', company: 'Kelompok Tani Bersama', phone: '085511223344', email: 'agus.tani@email.com', address: 'Desa Sukamaju Lama' },
    { name: 'PT Bumbu Nusantara', company: 'PT Bumbu Nusantara', phone: '02199887766', email: 'sales@bumbunusa.co.id', address: 'Kawasan Industri Cikarang' },
  ];

  products.forEach(p => Products.create(p));
  customers.forEach(c => Customers.create(c));
  suppliers.forEach(s => Suppliers.create(s));
}
