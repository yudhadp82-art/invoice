import { db } from './firebase';
import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const COLLECTIONS = {
  PRODUCTS: 'products',
  CUSTOMERS: 'customers',
  INVOICES: 'invoices',
  DELIVERY_NOTES: 'delivery_notes',
  PURCHASES: 'purchases',
  PRICE_CATEGORIES: 'price_categories',
  SUPPLIERS: 'suppliers',
  TELEGRAM_ORDERS: 'telegram_orders',
  HPP_REPORTS: 'hpp_reports',
  PRODUCTION_MATERIALS: 'production_materials',
  SALARY_COSTS: 'salary_costs',
  PRODUCTION_NEEDS: 'production_needs',
};

// Event listener untuk Undo
const mutationListeners = [];
export function addMutationListener(fn) { mutationListeners.push(fn); }
export function removeMutationListener(fn) {
  const i = mutationListeners.indexOf(fn);
  if (i > -1) mutationListeners.splice(i, 1);
}
function notifyMutation(action, collectionName, payload) {
  mutationListeners.forEach(fn => fn({ action, collection: collectionName, ...payload }));
  // Dispatch global custom event agar layout/pages bisa reload jika ada update
  window.dispatchEvent(new Event('app-data-mutation'));
}

async function getAllFromStore(collectionName) {
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error getting all from ${collectionName}:`, error);
    return [];
  }
}

async function getByIdFromStore(collectionName, id) {
  try {
    const docRef = doc(db, collectionName, id);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  } catch (error) {
    console.error(`Error getting ${id} from ${collectionName}:`, error);
    return null;
  }
}

async function createInStore(collectionName, item) {
  try {
    const newItem = {
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    let savedItem = null;
    if (item.id) {
      const docRef = doc(db, collectionName, item.id);
      await setDoc(docRef, newItem);
      savedItem = { ...newItem, id: item.id };
    } else {
      const colRef = collection(db, collectionName);
      const docRef = await addDoc(colRef, newItem);
      savedItem = { id: docRef.id, ...newItem };
    }
    
    notifyMutation('create', collectionName, { id: savedItem.id, item: savedItem });
    return savedItem;
  } catch (error) {
    console.error(`Error creating in ${collectionName}:`, error);
    return null;
  }
}

async function updateInStore(collectionName, id, updates) {
  try {
    const docRef = doc(db, collectionName, id);
    const snap = await getDoc(docRef);
    const previous = snap.exists() ? snap.data() : null; // Simpan untuk Undo

    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await updateDoc(docRef, updatedData);

    notifyMutation('update', collectionName, { id, previous: { id, ...previous }, updates: updatedData });
    return { id, ...updatedData };
  } catch (error) {
    console.error(`Error updating ${id} in ${collectionName}:`, error);
    return null;
  }
}

async function removeInStore(collectionName, id) {
  try {
    const docRef = doc(db, collectionName, id);
    const snap = await getDoc(docRef);
    const previous = snap.exists() ? snap.data() : null; // Simpan untuk Restore

    await deleteDoc(docRef);

    notifyMutation('delete', collectionName, { id, previous: { id, ...previous } });
    return true;
  } catch (error) {
    console.error(`Error deleting ${id} in ${collectionName}:`, error);
    return false;
  }
}

export const Products = {
  getAll: () => getAllFromStore(COLLECTIONS.PRODUCTS),
  getById: (id) => getByIdFromStore(COLLECTIONS.PRODUCTS, id),
  create: (item) => createInStore(COLLECTIONS.PRODUCTS, item),
  update: (id, updates) => updateInStore(COLLECTIONS.PRODUCTS, id, updates),
  delete: (id) => removeInStore(COLLECTIONS.PRODUCTS, id),
};

export const Customers = {
  getAll: () => getAllFromStore(COLLECTIONS.CUSTOMERS),
  getById: (id) => getByIdFromStore(COLLECTIONS.CUSTOMERS, id),
  create: (item) => createInStore(COLLECTIONS.CUSTOMERS, item),
  update: (id, updates) => updateInStore(COLLECTIONS.CUSTOMERS, id, updates),
  delete: (id) => removeInStore(COLLECTIONS.CUSTOMERS, id),
};

export const Suppliers = {
  getAll: () => getAllFromStore(COLLECTIONS.SUPPLIERS),
  getById: (id) => getByIdFromStore(COLLECTIONS.SUPPLIERS, id),
  create: (item) => createInStore(COLLECTIONS.SUPPLIERS, item),
  update: (id, updates) => updateInStore(COLLECTIONS.SUPPLIERS, id, updates),
  delete: (id) => removeInStore(COLLECTIONS.SUPPLIERS, id),
};

export const Invoices = {
  getAll: () => getAllFromStore(COLLECTIONS.INVOICES),
  getById: (id) => getByIdFromStore(COLLECTIONS.INVOICES, id),
  create: (item) => createInStore(COLLECTIONS.INVOICES, item),
  update: (id, updates) => updateInStore(COLLECTIONS.INVOICES, id, updates),
  delete: (id) => removeInStore(COLLECTIONS.INVOICES, id),
};

export const DeliveryNotes = {
  getAll: () => getAllFromStore(COLLECTIONS.DELIVERY_NOTES),
  getById: (id) => getByIdFromStore(COLLECTIONS.DELIVERY_NOTES, id),
  create: (item) => createInStore(COLLECTIONS.DELIVERY_NOTES, item),
  update: (id, updates) => updateInStore(COLLECTIONS.DELIVERY_NOTES, id, updates),
  delete: (id) => removeInStore(COLLECTIONS.DELIVERY_NOTES, id),
};

export const Purchases = {
  getAll: () => getAllFromStore(COLLECTIONS.PURCHASES),
  getById: (id) => getByIdFromStore(COLLECTIONS.PURCHASES, id),
  create: (item) => createInStore(COLLECTIONS.PURCHASES, item),
  update: (id, updates) => updateInStore(COLLECTIONS.PURCHASES, id, updates),
  delete: (id) => removeInStore(COLLECTIONS.PURCHASES, id),
};

export const PriceCategories = {
  getAll: () => getAllFromStore(COLLECTIONS.PRICE_CATEGORIES),
  getById: (id) => getByIdFromStore(COLLECTIONS.PRICE_CATEGORIES, id),
  create: (item) => createInStore(COLLECTIONS.PRICE_CATEGORIES, item),
  update: (id, updates) => updateInStore(COLLECTIONS.PRICE_CATEGORIES, id, updates),
  delete: (id) => removeInStore(COLLECTIONS.PRICE_CATEGORIES, id),
};

export const HppReports = {
  getAll: () => getAllFromStore(COLLECTIONS.HPP_REPORTS),
  getById: (id) => getByIdFromStore(COLLECTIONS.HPP_REPORTS, id),
  getByInvoiceId: async (invoiceId) => {
    const all = await getAllFromStore(COLLECTIONS.HPP_REPORTS);
    return all.find(r => r.invoiceId === invoiceId) || null;
  },
  create: (item) => createInStore(COLLECTIONS.HPP_REPORTS, item),
  update: (id, updates) => updateInStore(COLLECTIONS.HPP_REPORTS, id, updates),
  delete: (id) => removeInStore(COLLECTIONS.HPP_REPORTS, id),
};

export const ProductionMaterials = {
  getAll: () => getAllFromStore(COLLECTIONS.PRODUCTION_MATERIALS),
  getById: (id) => getByIdFromStore(COLLECTIONS.PRODUCTION_MATERIALS, id),
  create: (item) => createInStore(COLLECTIONS.PRODUCTION_MATERIALS, item),
  update: (id, updates) => updateInStore(COLLECTIONS.PRODUCTION_MATERIALS, id, updates),
  delete: (id) => removeInStore(COLLECTIONS.PRODUCTION_MATERIALS, id),
};

export const SalaryCosts = {
  getAll: () => getAllFromStore(COLLECTIONS.SALARY_COSTS),
  getById: (id) => getByIdFromStore(COLLECTIONS.SALARY_COSTS, id),
  create: (item) => createInStore(COLLECTIONS.SALARY_COSTS, item),
  update: (id, updates) => updateInStore(COLLECTIONS.SALARY_COSTS, id, updates),
  delete: (id) => removeInStore(COLLECTIONS.SALARY_COSTS, id),
};

export const ProductionNeeds = {
  getAll: () => getAllFromStore(COLLECTIONS.PRODUCTION_NEEDS),
  getById: (id) => getByIdFromStore(COLLECTIONS.PRODUCTION_NEEDS, id),
  create: (item) => createInStore(COLLECTIONS.PRODUCTION_NEEDS, item),
  update: (id, updates) => updateInStore(COLLECTIONS.PRODUCTION_NEEDS, id, updates),
  delete: (id) => removeInStore(COLLECTIONS.PRODUCTION_NEEDS, id),
};

export const TelegramOrders = {
  getAll: () => getAllFromStore(COLLECTIONS.TELEGRAM_ORDERS),
  getById: (id) => getByIdFromStore(COLLECTIONS.TELEGRAM_ORDERS, id),
  create: (item) => createInStore(COLLECTIONS.TELEGRAM_ORDERS, item),
  update: (id, updates) => updateInStore(COLLECTIONS.TELEGRAM_ORDERS, id, updates),
  delete: (id) => removeInStore(COLLECTIONS.TELEGRAM_ORDERS, id),
  getOffset: async () => {
    // Keep offset in local storage as it's specifically for this bot instance
    const val = localStorage.getItem('invoicepro_telegram_offset') || '0';
    return Number(val);
  },
  setOffset: async (val) => {
    localStorage.setItem('invoicepro_telegram_offset', String(val));
  }
};

export async function seedDemoData() {
  const cats = await PriceCategories.getAll();
  if (cats.length === 0) {
    await PriceCategories.create({ id: 'cat-retail', name: 'Retail (Default)' });
    await PriceCategories.create({ id: 'cat-grosir', name: 'Grosir' });
    await PriceCategories.create({ id: 'cat-vip', name: 'VIP' });
  }

  const prods = await Products.getAll();
  if (prods.length > 0) return;

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

  for (const p of products) await Products.create(p);
  for (const c of customers) await Customers.create(c);
  for (const s of suppliers) await Suppliers.create(s);
}

// Fungsi Eksekusi Undo
export async function executeUndo(mutation) {
  const { action, collection, id, previous, item } = mutation;
  try {
    if (action === 'delete') {
      // Restore kembali data yang dihapus
      const docRef = doc(db, collection, id);
      await setDoc(docRef, previous);
    } else if (action === 'update') {
      // Balikkan ke data sebelumnya
      const docRef = doc(db, collection, id);
      await setDoc(docRef, previous);
    } else if (action === 'create') {
      // Hapus data yang ditambahkan
      const docRef = doc(db, collection, id);
      await deleteDoc(docRef);
    }
    // Dispatch reload layout/pages
    window.dispatchEvent(new Event('app-data-mutation'));
    return true;
  } catch (error) {
    console.error(`Error executing undo for ${action} in ${collection}:`, error);
    return false;
  }
}
