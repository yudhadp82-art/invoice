import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc } from "firebase/firestore";
import * as dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTIONS = {
  PRODUCTS: 'products',
  CUSTOMERS: 'customers',
  PRICE_CATEGORIES: 'price_categories',
};

async function getAllFromStore(collectionName) {
  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function createInStore(collectionName, item) {
  const newItem = {
    ...item,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const colRef = collection(db, collectionName);
  const docRef = await addDoc(colRef, newItem);
  return { id: docRef.id, ...newItem };
}

async function updateInStore(collectionName, id, updates) {
  const docRef = doc(db, collectionName, id);
  const updatedData = { ...updates, updatedAt: new Date().toISOString() };
  await updateDoc(docRef, updatedData);
  return { id, ...updatedData };
}

async function run() {
  const CUSTOMER_NAME = "SPPG SINDANGJAYA 3";
  const CAT_NAME = "SPPG SINDANGJAYA 3 (Khusus)";

  console.log("Fetching existing customers...");
  const existingCustomers = await getAllFromStore(COLLECTIONS.CUSTOMERS);
  const existingCustomer = existingCustomers.find(c => c.name.toLowerCase() === CUSTOMER_NAME.toLowerCase());
  
  console.log("Fetching existing categories...");
  const categories = await getAllFromStore(COLLECTIONS.PRICE_CATEGORIES);
  let catId;
  
  if (existingCustomer) {
    console.log(`${CUSTOMER_NAME} already exists. Proceeding to update products.`);
    catId = existingCustomer.priceCategoryId;
  }
  
  if (!catId) {
    let existingCat = categories.find(c => c.name === CAT_NAME);
    if (!existingCat) {
      console.log(`Creating new category: ${CAT_NAME}`);
      existingCat = await createInStore(COLLECTIONS.PRICE_CATEGORIES, { name: CAT_NAME });
    }
    catId = existingCat.id;
  }

  if (!existingCustomer) {
    console.log(`Creating new customer: ${CUSTOMER_NAME}`);
    await createInStore(COLLECTIONS.CUSTOMERS, {
      name: CUSTOMER_NAME,
      company: "SPPG",
      phone: "",
      email: "",
      address: "Sindangjaya 3",
      priceCategoryId: catId
    });
  }

  const SINDANGJAYA3_PRICES = [
    { name: "bawang bombay", price: 35000, unit: "kg" },
    { name: "bawang daun", price: 11000, unit: "kg" },
    { name: "bawang merah kupas", price: 50000, unit: "kg" },
    { name: "bawang putih kupas", price: 37000, unit: "kg" },
    { name: "brokoli", price: 18000, unit: "kg" },
    { name: "buncis", price: 14000, unit: "kg" },
    { name: "caisim", price: 12000, unit: "kg" },
    { name: "Daun Jeruk", price: 50000, unit: "kg" },
    { name: "Edaname", price: 20000, unit: "kg" },
    { name: "jagung manis", price: 15000, unit: "kg" },
    { name: "jamur kuping", price: 26000, unit: "kg" },
    { name: "Jagung muda tanpa topi", price: 20000, unit: "kg" },
    { name: "jahe", price: 32000, unit: "kg" },
    { name: "kacang panjang", price: 13000, unit: "kg" },
    { name: "kacang polong", price: 55000, unit: "kg" },
    { name: "kapri muda", price: 44000, unit: "kg" },
    { name: "kembang kol", price: 26000, unit: "kg" },
    { name: "kol", price: 13000, unit: "kg" },
    { name: "kunyit", price: 19000, unit: "kg" },
    { name: "lengkuas", price: 17500, unit: "kg" },
    { name: "pakcoy", price: 13000, unit: "kg" },
    { name: "baby pakcoy", price: 14000, unit: "kg" },
    { name: "sawi putih", price: 13000, unit: "kg" },
    { name: "selada keriting", price: 18000, unit: "kg" },
    { name: "seledri", price: 12000, unit: "kg" },
    { name: "sereh", price: 17000, unit: "kg" },
    { name: "timun", price: 12000, unit: "kg" },
    { name: "tomat", price: 15000, unit: "kg" },
    { name: "wortel", price: 18000, unit: "kg" },
    { name: "kayu manis", price: 12000, unit: "kg" },
    { name: "mix vegetable", price: 25000, unit: "kg" },
    { name: "regal", price: 1000, unit: "pcs" },
    { name: "minyak goreng", price: 360000, unit: "jrigen" },
    { name: "sania 18ltr", price: 0, unit: "jrigen" },
    { name: "Spagheti", price: 24500, unit: "kg" },
    { name: "mie telur 640gr", price: 12000, unit: "640gr" },
    { name: "mie telur 2kg", price: 35500, unit: "2kg" },
    { name: "minyak wijen", price: 50000, unit: "botol" },
    { name: "terigu", price: 13000, unit: "kg" },
    { name: "tahu putih", price: 500, unit: "pcs" },
    { name: "tahu coklat", price: 500, unit: "pcs" },
    { name: "garam halus", price: 80000, unit: "bal" },
    { name: "kecap inggris", price: 42000, unit: "botol" },
    { name: "kecap manis", price: 190000, unit: "jrigen" },
    { name: "tepung panir", price: 15500, unit: "kg" },
    { name: "maizena @maizenaku", price: 23000, unit: "kg" },
    { name: "gula pasir", price: 19000, unit: "pack" },
    { name: "kecap asin", price: 25000, unit: "botol" },
    { name: "cuka", price: 18000, unit: "botol" },
    { name: "tepung tapioka", price: 7000, unit: "bag" },
    { name: "Bumbu rasa ayam kokita", price: 100000, unit: "kg" },
    { name: "merica", price: 200000, unit: "kg" },
    { name: "palmia royal butter", price: 12000, unit: "pcs" },
    { name: "saos tomat kokita", price: 130000, unit: "jrigen" },
    { name: "saos cabe kokita", price: 160000, unit: "jrigen" },
    { name: "saus teriyaki saori", price: 65000, unit: "botol" },
    { name: "mayonaise", price: 35000, unit: "kg" },
    { name: "sauce tiram saori", price: 60000, unit: "botol" },
    { name: "plastix 90x120cm", price: 12000, unit: "pack" },
    { name: "plastik uk 28", price: 12000, unit: "50 lbr" },
    { name: "masker standar", price: 40000, unit: "pack" },
    { name: "masker hijab", price: 43000, unit: "pack" },
    { name: "handglove karet", price: 80000, unit: "pack" },
    { name: "handglove", price: 70000, unit: "pack" },
    { name: "hairnet", price: 25000, unit: "pack" },
    { name: "sunlight", price: 12000, unit: "600ml" },
    { name: "mamalemon", price: 11000, unit: "680ml" },
    { name: "asam kandis", price: 70000, unit: "kg" },
    { name: "pasta tomat", price: 265000, unit: "kg" },
    { name: "oregano", price: 27000, unit: "8gr" },
    { name: "bay leaves", price: 25000, unit: "8gr" },
    { name: "sauce tomat @delmonte", price: 100000, unit: "jrigen" },
    { name: "sauce sambal @delmonte", price: 120000, unit: "jrigen" },
    { name: "soda kue", price: 7000, unit: "pcs" },
    { name: "lemon", price: 20000, unit: "kg" },
    { name: "biji wijen", price: 50000, unit: "kg" },
    { name: "kecap manis @bango", price: 190000, unit: "btl" },
    { name: "royco ayam @1kg", price: 45000, unit: "pack" },
    { name: "royco sapi @1kg", price: 45000, unit: "pack" },
    { name: "baby pakcoy baru", price: 16000, unit: "kg" },
    { name: "kecap ikan", price: 50000, unit: "btl" },
    { name: "terigu @segitiga", price: 13000, unit: "kg" },
    { name: "Kurma", price: 330000, unit: "kg" },
    { name: "Keju wincheez", price: 0, unit: "pcs" },
    { name: "Minyakita 2ltr/dus", price: 234000, unit: "Dus" },
    { name: "dimsum", price: 850, unit: "pcs" },
    { name: "bolen pisang", price: 3000, unit: "pcs" }
  ];

  console.log("Fetching existing products...");
  const allProducts = await getAllFromStore(COLLECTIONS.PRODUCTS);

  console.log(`Processing ${SINDANGJAYA3_PRICES.length} items...`);
  for (const item of SINDANGJAYA3_PRICES) {
    if (item.price === 0) continue;

    const existingProduct = allProducts.find(
      p => p.name.toLowerCase() === item.name.toLowerCase() || 
           (p.sku && p.sku.toLowerCase() === item.name.toLowerCase())
    );

    if (existingProduct) {
      const updatedCatPrices = { ...(existingProduct.categoryPrices || {}) };
      
      // Only update if price changed to avoid unnecessary writes
      if (updatedCatPrices[catId] !== item.price) {
        updatedCatPrices[catId] = item.price;
        await updateInStore(COLLECTIONS.PRODUCTS, existingProduct.id, { categoryPrices: updatedCatPrices });
        console.log(`Updated price for ${item.name} to ${item.price}`);
      } else {
        console.log(`Unchanged price for ${item.name}`);
      }
    } else {
      const newSku = item.name.substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      await createInStore(COLLECTIONS.PRODUCTS, {
        name: item.name,
        sku: newSku,
        category: 'Sayuran / Bahan Pokok', // default fallback
        purchaseCost: Math.floor(item.price * 0.8),
        sellPrice: item.price,
        stock: 0,
        unit: item.unit || 'kg',
        categoryPrices: { [catId]: item.price }
      });
      console.log(`Created new product: ${item.name}`);
    }
  }

  console.log(`${CUSTOMER_NAME} seeding completed via Node!`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
