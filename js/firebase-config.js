import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCLC6aCJ01BqVA8uwIq1gregteLnKaOIso",
  authDomain: "sys-peralatan-makmal-comp.firebaseapp.com",
  projectId: "sys-peralatan-makmal-comp",
  storageBucket: "sys-peralatan-makmal-comp.firebasestorage.app",
  messagingSenderId: "512686076992",
  appId: "1:512686076992:web:86db765f3be7b0c8f41ba5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);