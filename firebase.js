// Plik: firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
// Importujemy wszystkie potrzebne funkcje bazy danych
import {
  getDatabase,
  ref,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyDT-ik5Zp3yDJ-sQ8Bdk_SiaWIV-h-_LwE",
  authDomain: "family-tree-ad4b9.firebaseapp.com",
  databaseURL: "https://family-tree-ad4b9-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "family-tree-ad4b9",
  storageBucket: "family-tree-ad4b9.firebasestorage.app",
  messagingSenderId: "597301966346",
  appId: "1:597301966346:web:6f7e096c4f4d52b4b711f3",
  measurementId: "G-DTT0TQTF74"
};

const app = initializeApp(firebaseConfig);

(async () => {
  try {
    if (await isSupported() && location.protocol === "https:") {
      getAnalytics(app);
      console.log("📈 Google Analytics zainicjalizowany");
    }
  } catch (e) {
    console.warn("⚠️ Nie można uruchomić Google Analytics:", e.message);
  }
})();

const database = getDatabase(app);

// Eksportujemy wszystko, co będzie potrzebne w main.js
export {
  database,
  ref,
  set,
  onValue
};

