import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBaEWIKzLxSH9uZ6d8Jxnr1VvmDIaasjuU',
  authDomain: 'trade-manager-9499d.firebaseapp.com',
  projectId: 'trade-manager-9499d',
  storageBucket: 'trade-manager-9499d.firebasestorage.app',
  messagingSenderId: '887779721667',
  appId: '1:887779721667:web:2c2cea8e489342c1543d76',
  measurementId: 'G-E0DHR27NS9',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
