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
}

// Función para obtener variables de entorno
function getEnvVar(key: string, defaultValue: string = ''): string {
  return envVars[key] || defaultValue;
}

/**
 * Firebase configuration loaded from environment variables.
 *
 * This configuration object reads Firebase credentials from environment variables
 * to avoid hardcoding sensitive information in the codebase. It requires a .env file
 * with the necessary Firebase configuration values.
 *
 * Security:
 * - No hardcoded credentials
 * - Reads from environment variables
 * - Requires .env file for local development
 * - Supports fallback to empty strings if variables are missing
 *
 * Required Environment Variables:
 * - FIREBASE_API_KEY: Firebase API key
 * - FIREBASE_AUTH_DOMAIN: Firebase authentication domain
 * - FIREBASE_PROJECT_ID: Firebase project ID
 * - FIREBASE_STORAGE_BUCKET: Firebase storage bucket
 * - FIREBASE_MESSAGING_SENDER_ID: Firebase messaging sender ID
 * - FIREBASE_APP_ID: Firebase application ID
 * - FIREBASE_MEASUREMENT_ID: Firebase measurement ID (optional)
 *
 * Usage:
 * This configuration is imported and used in firebase.init.ts to initialize
 * the Firebase application.
 *
 * Relations:
 * - firebase.init.ts: Uses this configuration to initialize Firebase
 * - .env file: Source of environment variables
 *
 * @constant
 * @type FirebaseOptions
 */
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
