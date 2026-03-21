// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBv_tsdTCYd23lsTkbqhAdgFsTg-DPaQn0",
  authDomain: "invoice-a2974.firebaseapp.com",
  projectId: "invoice-a2974",
  storageBucket: "invoice-a2974.firebasestorage.app",
  messagingSenderId: "1061267861266",
  appId: "1:1061267861266:web:ece2315625749ccde5cdcb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
