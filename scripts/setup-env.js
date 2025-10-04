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

// Cargar variables de entorno
const envVars = loadEnvFile();

// Crear archivo de configuración para Angular
const configContent = `// Auto-generated file - do not edit manually
// This file is generated from .env variables

export const environmentVars = ${JSON.stringify(envVars, null, 2)};
`;

const configPath = path.join(__dirname, '..', 'src', 'app', 'firebase', 'env-vars.ts');
fs.writeFileSync(configPath, configContent);
