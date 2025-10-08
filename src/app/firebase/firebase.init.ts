/*import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import * as dotenv from 'dotenv';

// Leer configuración desde .env (formato JSON)
// Cargar variables de entorno
/*dotenv.config();


const getFirebaseConfig = () => {
  try {
    // Leer desde variables de entorno que contienen JSON
    const firebaseConfigJson = process.env['FIREBASE_CONFIG_JSON'];
    
    if (firebaseConfigJson) {
      // Parsear el JSON desde la variable de entorno
      const config = JSON.parse(firebaseConfigJson);
      return {
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
        measurementId: config.measurementId
      };
    }
    
    // Fallback: leer variables individuales
    return {
      apiKey: process.env['FIREBASE_API_KEY'],
      authDomain: process.env['FIREBASE_AUTH_DOMAIN'],
      projectId: process.env['FIREBASE_PROJECT_ID'],
      storageBucket: process.env['FIREBASE_STORAGE_BUCKET'],
      messagingSenderId: process.env['FIREBASE_MESSAGING_SENDER_ID'],
      appId: process.env['FIREBASE_APP_ID'],
      measurementId: process.env['FIREBASE_MEASUREMENT_ID']
    };
  } catch (error) {
    console.error('Error loading Firebase config from environment:', error);
    throw new Error('Firebase configuration not found in environment variables');
  }
};

const firebaseConfig = getFirebaseConfig();

// Verificar si ya existe una app de Firebase para evitar duplicación
let firebaseApp;
if (getApps().length === 0) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0];
}

export { firebaseApp };*/

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
export const auth = getAuth(firebaseApp);*/

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import * as dotenv from 'dotenv';

// Leer configuración desde .env (formato JSON)
// Cargar variables de entorno
/*dotenv.config();


const getFirebaseConfig = () => {
  try {
    // Leer desde variables de entorno que contienen JSON
    const firebaseConfigJson = process.env['FIREBASE_CONFIG_JSON'];
    
    if (firebaseConfigJson) {
      // Parsear el JSON desde la variable de entorno
      const config = JSON.parse(firebaseConfigJson);
      return {
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
        measurementId: config.measurementId
      };
    }
    
    // Fallback: leer variables individuales
    return {
      apiKey: process.env['FIREBASE_API_KEY'],
      authDomain: process.env['FIREBASE_AUTH_DOMAIN'],
      projectId: process.env['FIREBASE_PROJECT_ID'],
      storageBucket: process.env['FIREBASE_STORAGE_BUCKET'],
      messagingSenderId: process.env['FIREBASE_MESSAGING_SENDER_ID'],
      appId: process.env['FIREBASE_APP_ID'],
      measurementId: process.env['FIREBASE_MEASUREMENT_ID']
    };
  } catch (error) {
    console.error('Error loading Firebase config from environment:', error);
    throw new Error('Firebase configuration not found in environment variables');
  }
};

const firebaseConfig = getFirebaseConfig();

// Verificar si ya existe una app de Firebase para evitar duplicación
let firebaseApp;
if (getApps().length === 0) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0];
}

export { firebaseApp };*/

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