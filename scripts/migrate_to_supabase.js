import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const COLLECTIONS = [
  'products', 'customers', 'invoices', 'delivery_notes', 
  'purchases', 'price_categories', 'suppliers', 
  'telegram_orders', 'hpp_reports', 'production_materials', 
  'salary_costs', 'production_needs', 'employees', 
  'supporting_material_items', 'purchase_notes'
];

async function migrate() {
  console.log("Starting migration...");

  for (const colName of COLLECTIONS) {
    console.log(`Migrating collection: ${colName}...`);
    try {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data(),
        created_at: doc.data().createdAt || new Date().toISOString(),
        updated_at: doc.data().updatedAt || new Date().toISOString()
      }));

      if (docs.length === 0) {
        console.log(`  No data found in ${colName}. Skipping.`);
        continue;
      }

      // Upsert to Supabase
      const { error } = await supabase
        .from(colName)
        .upsert(docs);

      if (error) {
        console.error(`  Error upserting ${colName}:`, error.message);
      } else {
        console.log(`  Successfully migrated ${docs.length} items to ${colName}.`);
      }
    } catch (err) {
      console.error(`  Failed to migrate ${colName}:`, err.message);
    }
  }

  console.log("Migration finished.");
}

migrate();
