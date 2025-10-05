// Configuración de Firebase desde variables de entorno
// Este archivo NO contiene credenciales hardcodeadas
// Las credenciales deben estar en el archivo .env

// Importar variables de entorno generadas automáticamente
let envVars: Record<string, string> = {};
try {
  const { environmentVars } = require('./env-vars');
  envVars = environmentVars || {};
} catch (error) {
  // Si no existe el archivo env-vars.ts, usar valores por defecto
  console.log('No environment variables file found, using defaults');
}

// Función para obtener variables de entorno
function getEnvVar(key: string, defaultValue: string = ''): string {
  return envVars[key] || defaultValue;
}

// Configuración de Firebase que lee desde variables de entorno
// REQUIERE archivo .env con las credenciales
export const firebaseConfig = {
  apiKey: getEnvVar('FIREBASE_API_KEY'),
  authDomain: getEnvVar('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('FIREBASE_APP_ID'),
  measurementId: getEnvVar('FIREBASE_MEASUREMENT_ID'),
};
