import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBp5HymkayN_C0eZgv7-90s2J-HnBCkLnk",
  authDomain: "freitags-liga.firebaseapp.com",
  projectId: "freitags-liga",
  storageBucket: "freitags-liga.firebasestorage.app",
  messagingSenderId: "107556650268",
  appId: "1:107556650268:web:5c0b52beb54e58606f5a29",
  measurementId: "G-X8C2ZJ3XB5"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);