import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyArgP57PJCb1lmMyL9ITjjZT4e19KTSlxU",
  authDomain: "creditlens-e82ad.firebaseapp.com",
  projectId: "creditlens-e82ad",
  storageBucket: "creditlens-e82ad.firebasestorage.app",
  messagingSenderId: "190145994443",
  appId: "1:190145994443:web:e3d928be50beb76675854e",
  measurementId: "G-HZ3LTTRGCC"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
