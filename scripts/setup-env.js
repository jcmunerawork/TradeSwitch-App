// Script para configurar variables de entorno para Angular
const fs = require('fs');
const path = require('path');

// Función para leer archivo .env
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('No .env file found. Using default Firebase configuration.');
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return envVars;
}

// Cargar variables de entorno desde .env
const envVars = loadEnvFile();

// También leer variables de process.env (para Vercel/Render)
// Estas variables tienen prioridad sobre .env
// Valor por defecto para desarrollo local
const defaultBackendUrl = 'http://localhost:3000';

const processEnvVars = {
  STREAMS_BACKEND_URL: process.env.STREAMS_BACKEND_URL || defaultBackendUrl,
  // Agregar otras variables de entorno que necesites aquí
};

// Combinar variables (process.env tiene prioridad sobre .env)
// Si no está en process.env ni en .env, usar el valor por defecto
const allEnvVars = {
  STREAMS_BACKEND_URL: processEnvVars.STREAMS_BACKEND_URL || envVars.STREAMS_BACKEND_URL || defaultBackendUrl,
  ...envVars,
  ...processEnvVars
};

// Crear archivo de configuración para Angular
const configContent = `// Auto-generated file - do not edit manually
// This file is generated from .env variables and process.env

export const environmentVars = ${JSON.stringify(allEnvVars, null, 2)};
`;

const configPath = path.join(__dirname, '..', 'src', 'app', 'firebase', 'env-vars.ts');
fs.writeFileSync(configPath, configContent);

// Crear script para inyectar variables en window.__ENV__ (para el navegador)
const browserEnvScript = `// Auto-generated file - do not edit manually
// This script injects environment variables into window.__ENV__ for browser access

(function() {
  if (typeof window !== 'undefined') {
    window.__ENV__ = window.__ENV__ || {};
    ${Object.entries(allEnvVars)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `window.__ENV__['${key}'] = ${JSON.stringify(value)};`)
      .join('\n    ')}
  }
})();
`;

const browserEnvPath = path.join(__dirname, '..', 'src', 'assets', 'env-config.js');
// Asegurar que el directorio existe
const assetsDir = path.dirname(browserEnvPath);
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}
fs.writeFileSync(browserEnvPath, browserEnvScript);

console.log('✅ Environment variables configured');
console.log('   - Firebase config:', configPath);
console.log('   - Browser env script:', browserEnvPath);
if (allEnvVars.STREAMS_BACKEND_URL) {
  console.log(`   - STREAMS_BACKEND_URL: ${allEnvVars.STREAMS_BACKEND_URL}`);
}
