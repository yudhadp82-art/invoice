require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

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

async function deleteAll() {
  const colRef = collection(db, 'products');
  const snapshot = await getDocs(colRef);
  console.log(`Found ${snapshot.size} products to delete.`);
  
  let count = 0;
  for (const d of snapshot.docs) {
      await deleteDoc(doc(db, 'products', d.id));
      count++;
      console.log(`Deleted product: ${d.id}`);
  }
  
  console.log(`Successfully deleted ${count} products.`);
}

deleteAll().catch(console.error);
