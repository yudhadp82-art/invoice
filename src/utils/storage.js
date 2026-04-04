import { supabase } from './supabase';

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
  EMPLOYEES: 'employees',
  SUPPORTING_MATERIAL_ITEMS: 'supporting_material_items',
  PURCHASE_NOTES: 'purchase_notes',
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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ CRITICAL: Supabase credentials missing. Check your .env file!');
      throw new Error('Supabase credentials missing');
    }

    const { data, error, count } = await supabase
      .from(collectionName)
      .select('*', { count: 'exact' });
    
    if (error) {
      console.error(`❌ Supabase error fetching ${collectionName}:`, error.message, error.code);
      throw error;
    }

    if (!data || data.length === 0) {
      if (count && count > 0) {
        console.error(`🚨 CRITICAL: Database has ${count} rows in ${collectionName}, but Client received 0. This is likely an RLS (Row Level Security) policy issue.`);
        throw new Error(`Permission Denied (RLS): Database has ${count} rows but access is restricted.`);
      }
      console.warn(`⚠️ Supabase returned 0 rows for ${collectionName}. Table is empty.`);
    }

    return (data || []).map(item => {
      // Prioritize direct columns, but merge with 'data' field if it exists
      // This handles both flat-table and JSONB-wrapped patterns
      const mapped = { 
        id: item.id, 
        ...(item.data || {}),
        ...Object.keys(item).reduce((acc, key) => {
          if (key !== 'data' && key !== 'id') acc[key] = item[key];
          return acc;
        }, {})
      };

      // Legacy normalization for purchases (old table)
      if (collectionName === COLLECTIONS.PURCHASES && mapped.supplier && !mapped.supplierName) {
        mapped.supplierName = mapped.supplier;
      }
      return mapped;
    });
  } catch (error) {
    console.error(`Error getting all from ${collectionName}:`, error);
    throw error;
  }
}

async function getByIdFromStore(collectionName, id) {
  try {
    const { data, error } = await supabase
      .from(collectionName)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data ? { id: data.id, ...data.data } : null;
  } catch (error) {
    console.error(`Error getting ${id} from ${collectionName}:`, error);
    return null;
  }
}

async function createInStore(collectionName, item) {
  try {
    const id = item.id || crypto.randomUUID();
    const now = new Date().toISOString();
    
    const dataPayload = {
      ...item,
      createdAt: item.createdAt || now,
      updatedAt: now,
    };
    // Hapus id dari dataPayload agar tidak duplikat dengan kolom id
    delete dataPayload.id;

    const { error } = await supabase
      .from(collectionName)
      .insert({
        id: id,
        data: dataPayload,
        created_at: dataPayload.createdAt,
        updated_at: dataPayload.updatedAt
      });

    if (error) throw error;
    
    const savedItem = { id, ...dataPayload };
    notifyMutation('create', collectionName, { id, item: savedItem });
    return savedItem;
  } catch (error) {
    console.error(`Error creating in ${collectionName}:`, error);
    return null;
  }
}

async function updateInStore(collectionName, id, updates) {
  try {
    // Ambil data lama untuk Undo
    const previousItem = await getByIdFromStore(collectionName, id);
    
    const now = new Date().toISOString();
    const updatedData = {
      ...previousItem,
      ...updates,
      updatedAt: now
    };
    const idToSave = updatedData.id;
    delete updatedData.id;

    const { error } = await supabase
      .from(collectionName)
      .update({
        data: updatedData,
        updated_at: now
      })
      .eq('id', id);

    if (error) throw error;

    const result = { id, ...updatedData };
    notifyMutation('update', collectionName, { id, previous: { id, ...previousItem }, updates: result });
    return result;
  } catch (error) {
    console.error(`Error updating ${id} in ${collectionName}:`, error);
    return null;
  }
}

async function removeInStore(collectionName, id) {
  try {
    const previousItem = await getByIdFromStore(collectionName, id);
    
    const { error } = await supabase
      .from(collectionName)
      .delete()
      .eq('id', id);

    if (error) throw error;

    notifyMutation('delete', collectionName, { id, previous: { id, ...previousItem } });
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

export const PurchaseNotes = {
  getAll: async () => {
    try {
      const [newNotes, oldPurchases] = await Promise.all([
        getAllFromStore(COLLECTIONS.PURCHASE_NOTES),
        getAllFromStore(COLLECTIONS.PURCHASES)
      ]);
      // Consolidate both collections to ensure no data is missing
      const consolidated = [...newNotes];
      oldPurchases.forEach(old => {
        if (!consolidated.find(n => n.id === old.id)) {
          // Normalize old purchase to match new purchase note structure
          const normalized = { ...old };
          if (old.supplier && !old.supplierName) normalized.supplierName = old.supplier;
          consolidated.push(normalized);
        }
      });
      console.log(`✅ Loaded ${consolidated.length} total purchase records (${newNotes.length} notes, ${oldPurchases.length} legacy).`);
      return consolidated;
    } catch (err) {
      console.error("Failed PurchaseNotes.getAll:", err);
      throw err;
    }
  },
  getById: async (id) => {
    const note = await getByIdFromStore(COLLECTIONS.PURCHASE_NOTES, id);
    if (note) return note;
    return getByIdFromStore(COLLECTIONS.PURCHASES, id);
  },
  create: (item) => createInStore(COLLECTIONS.PURCHASE_NOTES, item),
  update: async (id, updates) => {
    const note = await getByIdFromStore(COLLECTIONS.PURCHASE_NOTES, id);
    if (note) return updateInStore(COLLECTIONS.PURCHASE_NOTES, id, updates);
    
    const oldNote = await getByIdFromStore(COLLECTIONS.PURCHASES, id);
    if (oldNote) return updateInStore(COLLECTIONS.PURCHASES, id, updates);
    
    return null;
  },
  delete: async (id) => {
    const note = await getByIdFromStore(COLLECTIONS.PURCHASE_NOTES, id);
    if (note) return removeInStore(COLLECTIONS.PURCHASE_NOTES, id);
    
    const oldNote = await getByIdFromStore(COLLECTIONS.PURCHASES, id);
    if (oldNote) return removeInStore(COLLECTIONS.PURCHASES, id);
    
    return false;
  },
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

export const Employees = {
  getAll: () => getAllFromStore(COLLECTIONS.EMPLOYEES),
  getById: (id) => getByIdFromStore(COLLECTIONS.EMPLOYEES, id),
  create: (item) => createInStore(COLLECTIONS.EMPLOYEES, item),
  update: (id, updates) => updateInStore(COLLECTIONS.EMPLOYEES, id, updates),
  delete: (id) => removeInStore(COLLECTIONS.EMPLOYEES, id),
};

export const SupportingMaterialItems = {
  getAll: () => getAllFromStore(COLLECTIONS.SUPPORTING_MATERIAL_ITEMS),
  getById: (id) => getByIdFromStore(COLLECTIONS.SUPPORTING_MATERIAL_ITEMS, id),
  create: (item) => createInStore(COLLECTIONS.SUPPORTING_MATERIAL_ITEMS, item),
  update: (id, updates) => updateInStore(COLLECTIONS.SUPPORTING_MATERIAL_ITEMS, id, updates),
  delete: (id) => removeInStore(COLLECTIONS.SUPPORTING_MATERIAL_ITEMS, id),
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
  try {
    const cats = await PriceCategories.getAll();
    if (cats.length === 0) {
    await PriceCategories.create({ id: 'cat-retail', name: 'Retail (Default)' });
    await PriceCategories.create({ id: 'cat-grosir', name: 'Grosir' });
    await PriceCategories.create({ id: 'cat-vip', name: 'VIP' });
  }

  const demoProducts = [
    { name: 'Bawang Merah Brebes', sku: 'BMB-01', category: 'Bumbu', purchaseCost: 25000, sellPrice: 35000, stock: 50, unit: 'kg', categoryPrices: { 'cat-grosir': 32000, 'cat-vip': 30000 } },
    { name: 'Bawang Putih Kating', sku: 'BPK-01', category: 'Bumbu', purchaseCost: 32000, sellPrice: 42000, stock: 30, unit: 'kg', categoryPrices: { 'cat-grosir': 38000, 'cat-vip': 36000 } },
    { name: 'Cabe Rawit Merah', sku: 'CRM-01', category: 'Sayuran', purchaseCost: 65000, sellPrice: 80000, stock: 15, unit: 'kg', categoryPrices: { 'cat-grosir': 75000, 'cat-vip': 72000 } },
    { name: 'Kunyit Bubuk Murni', sku: 'KYB-01', category: 'Rempah', purchaseCost: 45000, sellPrice: 60000, stock: 100, unit: 'pack', categoryPrices: { 'cat-grosir': 55000, 'cat-vip': 52000 } },
    { name: 'Sawi Hijau / Caisim', sku: 'SWH-01', category: 'Sayuran', purchaseCost: 4000, sellPrice: 7000, stock: 120, unit: 'ikat', categoryPrices: { 'cat-grosir': 6000, 'cat-vip': 5500 } },
  ];

  const demoCustomers = [
    { name: 'Budi Santoso', company: 'Toko Segar Jaya', phone: '08123456789', email: 'budi@segarjaya.com', address: 'Jl. Pasar Baru No.10', priceCategoryId: 'cat-retail' },
    { name: 'Siti Aminah', company: 'Warung Barokah', phone: '08987654321', email: 'siti@barokah.com', address: 'Jl. Melati No. 5', priceCategoryId: 'cat-grosir' },
    { name: 'Rumah Makan Padang Saiyo', company: '', phone: '08112233445', email: 'rm.saiyo@email.com', address: 'Komp. Ruko Indah Blok A', priceCategoryId: 'cat-vip', group: 'S5' },
  ];

  const demoSuppliers = [
    { name: 'Agus Petani', company: 'Kelompok Tani Bersama', phone: '085511223344', email: 'agus.tani@email.com', address: 'Desa Sukamaju Lama' },
    { name: 'PT Bumbu Nusantara', company: 'PT Bumbu Nusantara', phone: '02199887766', email: 'sales@bumbunusa.co.id', address: 'Kawasan Industri Cikarang' },
  ];

  const prods = await Products.getAll();
  if (prods.length === 0) {
    for (const p of demoProducts) await Products.create(p);
  }

  const custs = await Customers.getAll();
  if (custs.length === 0) {
    for (const c of demoCustomers) await Customers.create(c);
  }

  const supps = await Suppliers.getAll();
  if (supps.length === 0) {
    for (const s of demoSuppliers) await Suppliers.create(s);
  }

  const materialItems = [
    { name: 'Wortel', unit: 'kg', defaultPrice: 12000, stock: 0, availableInS2: true, availableInS5: true },
    { name: 'Buncis', unit: 'kg', defaultPrice: 15000, stock: 0, availableInS2: true, availableInS5: true },
    { name: 'Jagung', unit: 'kg', defaultPrice: 8000, stock: 0, availableInS2: true, availableInS5: true },
    { name: 'Plastik PE 5kg', unit: 'pack', defaultPrice: 25000, stock: 0, availableInS2: true, availableInS5: true },
    { name: 'Label Stiker', unit: 'pcs', defaultPrice: 500, stock: 0, availableInS2: true, availableInS5: true },
  ];

  const materials = await SupportingMaterialItems.getAll();
  if (materials.length === 0) {
    for (const m of materialItems) await SupportingMaterialItems.create(m);
  }

  // Seed one sample purchase note if empty
  const pNotes = await PurchaseNotes.getAll();
  if (pNotes.length === 0) {
    const allm = await SupportingMaterialItems.getAll();
    const wortel = allm.find(m => m.name === 'Wortel');
    if (wortel) {
      await PurchaseNotes.create({
        date: new Date().toISOString().slice(0, 10),
        supplierName: 'Agus Petani',
        items: [{
          materialId: wortel.id,
          materialName: wortel.name,
          unit: wortel.unit,
          qtyNota: 50,
          pricePerUnit: 11000,
          totalCost: 550000,
          splits: {
            s5: { qty: 30, shrinkage: 0, netQty: 30 },
            s2: { qty: 20, shrinkage: 0, netQty: 20 },
            s3: { qty: 0, shrinkage: 0, netQty: 0 }
          }
        }],
        grandTotal: 550000,
        notes: 'Demo: Pembelian awal wortel'
      });
    }
  }
  } catch (err) {
    console.error('Failed to run seedDemoData (possibly connection issue):', err);
  }
}

// Fungsi Eksekusi Undo
export async function executeUndo(mutation) {
  const { action, collection, id, previous } = mutation;
  try {
    if (action === 'delete') {
      // Restore kembali data yang dihapus
      const now = new Date().toISOString();
      const dataPayload = { ...previous };
      delete dataPayload.id;
      
      await supabase.from(collection).insert({
        id: id,
        data: dataPayload,
        created_at: dataPayload.createdAt || now,
        updated_at: now
      });
    } else if (action === 'update') {
      // Balikkan ke data sebelumnya
      const now = new Date().toISOString();
      const dataPayload = { ...previous };
      delete dataPayload.id;

      await supabase.from(collection).update({
        data: dataPayload,
        updated_at: now
      }).eq('id', id);
    } else if (action === 'create') {
      // Hapus data yang ditambahkan
      await supabase.from(collection).delete().eq('id', id);
    }
    // Dispatch reload layout/pages
    window.dispatchEvent(new Event('app-data-mutation'));
    return true;
  } catch (error) {
    console.error(`Error executing undo for ${action} in ${collection}:`, error);
    return false;
  }
}
