// Script para probar Streams API con Node.js
// Instalar: npm install socket.io-client
// Ejecutar: node test-streams-api.js

// const { io } = require('socket.io-client');
const https = require('https');

// CONFIGURACIÓN - Reemplaza con tus valores
// const DEVELOPER_API_KEY = 'tl-7xUz3A0a2aAReLuGnaU%kmaF';
// URL del Streams API (WebSocket) - según documentación: wss://api-dev.tradelocker.com/streams-api/socket.io
// NOTA: Socket.IO maneja automáticamente el protocolo, usar https:// (no wss://)
// const STREAMS_API_URL = 'https://api-dev.tradelocker.com';
// URL del Backend API (REST) - para obtener tokens y información de cuentas
// const BACKEND_API_URL = 'https://demo.tradelocker.com/backend-api';

// Nueva URL para prueba temporal
const BACKEND_API_URL = 'https://stg.tradelocker.com/backend-api';

// Credenciales para obtener tokens (reemplaza con tus valores)
const USER_EMAIL = 'test@thefundedpicks.com';
const USER_PASSWORD = 'Xj"vz"pm9EAf';
const SERVER = 'TFUNDS';

// Almacenar tokens de todas las cuentas
// let accountTokens = [];
// let subscribedAccounts = new Set();
// let messageCount = 0;
// let syncEndReceived = false;

// Verificar si el JWT token está expirado
// function isTokenExpired(token) {
//   try {
//     const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
//     const exp = payload.exp * 1000; // Convertir a milisegundos
//     const now = Date.now();
//     const isExpired = now > exp;
//     if (isExpired) {
//       console.warn('⚠️  JWT Token EXPIRADO!');
//       console.warn('Expiró el:', new Date(exp).toISOString());
//       console.warn('Hora actual:', new Date(now).toISOString());
//     } else {
//       console.log('✅ JWT Token válido hasta:', new Date(exp).toISOString());
//     }
//     return isExpired;
//   } catch (e) {
//     console.warn('⚠️  No se pudo verificar expiración del token');
//     return false;
//   }
// }

// ============================================
// MÉTODO TEMPORAL PARA PRUEBA DEL NUEVO ENDPOINT
// ============================================
async function testNewEndpoint() {
  return new Promise((resolve, reject) => {
    // Body de la petición
    const body = {
      email: USER_EMAIL,
      password: USER_PASSWORD,
      server: SERVER
    };
    
    const postData = JSON.stringify(body);
    
    // URL completa del nuevo endpoint
    const fullUrl = `${BACKEND_API_URL}/auth/jwt/accounts/tokens`;
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🧪 PRUEBA TEMPORAL - NUEVO ENDPOINT');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n📤 Enviando petición de autenticación...');
    console.log('   URL:', fullUrl);
    console.log('   Método: POST');
    console.log('   Body:', JSON.stringify(body, null, 2));

    // Extraer hostname y path de la URL completa
    const url = new URL(fullUrl);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('\n📋 Detalles de la petición HTTP:');
    console.log('   Hostname:', options.hostname);
    console.log('   Path:', options.path);
    console.log('   Method:', options.method);
    console.log('   Headers:', JSON.stringify(options.headers, null, 2));

    const req = https.request(options, (res) => {
      let data = '';

      console.log('\n📥 Respuesta recibida:');
      console.log('   Status Code:', res.statusCode);
      console.log('   Status Message:', res.statusMessage);
      console.log('   Headers:', JSON.stringify(res.headers, null, 2));

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('📦 DATOS RAW RECIBIDOS:');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('   Longitud:', data.length, 'caracteres');
        console.log('   Contenido raw:', data);
        
        try {
          // Intentar parsear como JSON
          const response = JSON.parse(data);
          
          console.log('\n═══════════════════════════════════════════════════════════════');
          console.log('📋 RESPUESTA PARSEADA (JSON):');
          console.log('═══════════════════════════════════════════════════════════════');
          console.log(JSON.stringify(response, null, 2));
          
          // Verificar código de estado HTTP
          if (res.statusCode < 200 || res.statusCode >= 300) {
            console.log('\n❌ Error HTTP:', res.statusCode);
            console.log('   Mensaje:', response.message || 'Sin mensaje');
            reject(new Error(response.message || `HTTP ${res.statusCode}`));
            return;
          }

          console.log('\n✅ Petición exitosa (HTTP', res.statusCode + ')');
          
          // Mostrar todos los campos de la respuesta
          console.log('\n📊 ESTRUCTURA DE LA RESPUESTA:');
          console.log('   Tipo:', Array.isArray(response) ? 'Array' : typeof response);
          console.log('   Claves principales:', Object.keys(response));
          
          // Si tiene data, mostrar su estructura
          if (response.data) {
            console.log('\n   📦 Campo "data":');
            console.log('      Tipo:', Array.isArray(response.data) ? 'Array' : typeof response.data);
            if (Array.isArray(response.data)) {
              console.log('      Longitud:', response.data.length);
              if (response.data.length > 0) {
                console.log('      Estructura del primer elemento:', Object.keys(response.data[0]));
              }
            } else {
              console.log('      Claves:', Object.keys(response.data));
            }
          }
          
          // Mostrar todos los valores
          console.log('\n📋 TODOS LOS VALORES DE LA RESPUESTA:');
          if (response.accessToken) {
            console.log('   accessToken:', response.accessToken);
          }
          if (response.refreshToken) {
            console.log('   refreshToken:', response.refreshToken);
          }
          if (response.expireDate) {
            console.log('   expireDate:', response.expireDate);
          }
          if (response.accountId) {
            console.log('   accountId:', response.accountId);
          }
          if (response.data) {
            if (Array.isArray(response.data)) {
              response.data.forEach((item, index) => {
                console.log(`\n   data[${index}]:`);
                Object.keys(item).forEach(key => {
                  if (key === 'accessToken') {
                    console.log(`      ${key}:`, item[key]);
                  } else {
                    console.log(`      ${key}:`, item[key]);
                  }
                });
              });
            } else {
              console.log('\n   data (objeto):');
              Object.keys(response.data).forEach(key => {
                if (key === 'accessToken') {
                  console.log(`      ${key}:`, response.data[key]);
                } else {
                  console.log(`      ${key}:`, response.data[key]);
                }
              });
            }
          }
          
          console.log('\n═══════════════════════════════════════════════════════════════');
          console.log('✅ PRUEBA COMPLETADA');
          console.log('═══════════════════════════════════════════════════════════════\n');
          
          resolve(response);
        } catch (e) {
          console.error('\n❌ Error parseando respuesta como JSON:', e.message);
          console.error('   La respuesta no es un JSON válido');
          console.error('   Contenido raw:', data);
          reject(e);
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ Error en la petición HTTP:');
      console.error('   Tipo:', error.code);
      console.error('   Mensaje:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Función original comentada
// async function getJWTToken() {
//   return new Promise((resolve, reject) => {
//     // ... código comentado ...
//   });
// }

// Función para obtener token JWT del backend API (para usar con /all-accounts)
// Este token tiene audience 'tradelocker-api-traders' (diferente al de streams)
/*
async function getBackendAPIToken() {
  return new Promise((resolve, reject) => {
    const body = {
      email: USER_EMAIL,
      password: USER_PASSWORD,
      server: SERVER
    };
    
    const postData = JSON.stringify(body);
    
    console.log('\n📤 Obteniendo token JWT para Backend API...');
    console.log('   URL:', `${BACKEND_API_URL}/auth/jwt/token`);
    console.log('   Body:', JSON.stringify(body, null, 2));

    const url = new URL(BACKEND_API_URL);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + '/auth/jwt/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const errorResponse = JSON.parse(data);
            console.error(`❌ Error HTTP ${res.statusCode}:`, errorResponse);
            reject(new Error(errorResponse.message || `HTTP ${res.statusCode}`));
            return;
          }

          const response = JSON.parse(data);
          console.log(`\n✅ Token JWT para Backend API obtenido exitosamente (HTTP ${res.statusCode})`);
          
          if (response.accessToken) {
            console.log('   Access Token (primeros 50 chars):', response.accessToken.substring(0, 50) + '...');
            resolve(response.accessToken);
          } else {
            reject(new Error('No se recibió accessToken en la respuesta'));
          }
        } catch (e) {
          console.error('❌ Error parseando respuesta:', e);
          console.error('Respuesta raw:', data);
          reject(e);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Error en petición:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}
*/

// Función para obtener información de todas las cuentas usando el token JWT del backend API
/*
async function getAllAccounts(backendAPIToken) {
  return new Promise((resolve, reject) => {
    console.log('\n📤 Obteniendo información de todas las cuentas...');
    console.log('   URL:', `${BACKEND_API_URL}/auth/jwt/all-accounts`);
    
    // Extraer hostname y path de BACKEND_API_URL
    const url = new URL(BACKEND_API_URL);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + '/auth/jwt/all-accounts',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${backendAPIToken}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          // Verificar código de estado HTTP
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const errorResponse = JSON.parse(data);
            console.error(`❌ Error HTTP ${res.statusCode}:`, errorResponse);
            reject(new Error(errorResponse.message || `HTTP ${res.statusCode}`));
            return;
          }

          const response = JSON.parse(data);
          console.log(`\n✅ Información de cuentas obtenida exitosamente (HTTP ${res.statusCode})`);
          
          // La respuesta puede ser un array de cuentas o un objeto con un array
          let accounts = [];
          if (Array.isArray(response)) {
            accounts = response;
          } else if (response.data && Array.isArray(response.data)) {
            accounts = response.data;
          } else if (response.accounts && Array.isArray(response.accounts)) {
            accounts = response.accounts;
          } else {
            // Si es un solo objeto, convertirlo a array
            accounts = [response];
          }
          
          console.log(`   Cuentas encontradas: ${accounts.length}`);
          
          // Procesar cada cuenta y extraer id, status, currency
          const processedAccounts = accounts.map((account, index) => {
            const accountInfo = {
              id: account.id || account.accountId || null,
              status: account.status || 'ACTIVE', // Status de la cuenta (ACTIVE, INACTIVE, etc.)
              currency: account.currency || 'USD', // Currency de la cuenta
              // Mantener otros datos útiles
              accountId: account.accountId || account.id,
              accountName: account.accountName || account.name || null,
              brandId: account.brandId || SERVER
            };
            
            console.log(`   Cuenta ${index + 1}:`);
            console.log(`     ID: ${accountInfo.id}`);
            console.log(`     Status: ${accountInfo.status}`);
            console.log(`     Currency: ${accountInfo.currency}`);
            if (accountInfo.accountName) {
              console.log(`     Nombre: ${accountInfo.accountName}`);
            }
            
            return accountInfo;
          });
          
          resolve(processedAccounts);
        } catch (e) {
          console.error('❌ Error parseando respuesta:', e);
          console.error('Respuesta raw:', data);
          reject(e);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Error en petición:', error);
      reject(error);
    });

    req.end();
  });
}
*/

// Función para formatear mensajes de forma clara
/*
function formatMessage(message) {
  const timestamp = new Date().toLocaleTimeString('es-ES');
  const separator = '═'.repeat(80);
  
  console.log(`\n${separator}`);
  console.log(`📨 [${timestamp}] Mensaje recibido`);
  console.log(separator);

  switch (message.type) {
    case 'AccountStatus':
      console.log('📊 TIPO: Estado de Cuenta (AccountStatus)');
      console.log(`   Cuenta: ${message.accountId || 'N/A'}`);
      console.log(`   Moneda: ${message.currency || 'N/A'}`);
      console.log(`   Balance: ${message.balance || '0'}`);
      console.log(`   Balance sin crédito: ${message.balanceWithoutCredit || '0'}`);
      console.log(`   Equity: ${message.equity || '0'}`);
      console.log(`   Margen Disponible: ${message.marginAvailable || '0'}`);
      console.log(`   Margen Usado: ${message.marginUsed || '0'}`);
      console.log(`   Balance Bloqueado: ${message.blockedBalance || '0'}`);
      console.log(`   Crédito: ${message.credit || '0'}`);
      if (message.brandId) console.log(`   Brand ID: ${message.brandId}`);
      if (message.userId) console.log(`   User ID: ${message.userId}`);
      break;

    case 'Position':
      console.log('📈 TIPO: Posición Abierta (Position)');
      console.log(`   Cuenta: ${message.accountId || 'N/A'}`);
      console.log(`   Position ID: ${message.positionId || 'N/A'}`);
      console.log(`   Instrumento: ${message.instrument || 'N/A'}`);
      console.log(`   Lados: ${message.side || 'N/A'} (${message.side === 'BUY' ? 'COMPRA' : 'VENTA'})`);
      console.log(`   Lots: ${message.lots || '0'}`);
      if (message.lotSize) console.log(`   Tamaño de Lote: ${message.lotSize}`);
      if (message.units) console.log(`   Unidades: ${message.units}`);
      console.log(`   Precio de Apertura: ${message.openPrice || '0'}`);
      console.log(`   Fecha/Hora Apertura: ${message.openDateTime || 'N/A'}`);
      console.log(`   Order ID Apertura: ${message.openOrderId || 'N/A'}`);
      if (message.stopLossOrderId) console.log(`   Stop Loss Order ID: ${message.stopLossOrderId}`);
      if (message.takeProfitOrderId) console.log(`   Take Profit Order ID: ${message.takeProfitOrderId}`);
      console.log(`   Margen de Mantenimiento: ${message.maintMargin || '0'}`);
      if (message.brandId) console.log(`   Brand ID: ${message.brandId}`);
      if (message.userId) console.log(`   User ID: ${message.userId}`);
      break;

    case 'ClosePosition':
      console.log('🔒 TIPO: Posición Cerrada (ClosePosition)');
      console.log(`   Cuenta: ${message.accountId || 'N/A'}`);
      console.log(`   Position ID: ${message.positionId || 'N/A'}`);
      if (message.closePrice) console.log(`   Precio de Cierre: ${message.closePrice}`);
      console.log(`   Fecha/Hora Cierre: ${message.closeDateTime || 'N/A'}`);
      if (message.brandId) console.log(`   Brand ID: ${message.brandId}`);
      if (message.userId) console.log(`   User ID: ${message.userId}`);
      break;

    case 'OpenOrder':
      console.log('📋 TIPO: Orden Abierta (OpenOrder)');
      console.log(`   Cuenta: ${message.accountId || 'N/A'}`);
      console.log(`   Order ID: ${message.orderId || 'N/A'}`);
      console.log(`   Instrumento: ${message.instrument || 'N/A'}`);
      console.log(`   Cantidad: ${message.amount || '0'}`);
      if (message.lotSize) console.log(`   Tamaño de Lote: ${message.lotSize}`);
      console.log(`   Lado: ${message.side || 'N/A'} (${message.side === 'BUY' ? 'COMPRA' : 'VENTA'})`);
      if (message.price) console.log(`   Precio: ${message.price}`);
      console.log(`   Estado: ${message.status || 'N/A'}`);
      if (message.status === 'PENDING') console.log('   ⏳ Orden PENDIENTE');
      if (message.status === 'EXECUTED') console.log('   ✅ Orden EJECUTADA');
      if (message.status === 'CANCELLED') console.log('   ❌ Orden CANCELADA');
      if (message.brandId) console.log(`   Brand ID: ${message.brandId}`);
      if (message.userId) console.log(`   User ID: ${message.userId}`);
      break;

    case 'Property':
      if (message.name === 'SyncEnd') {
        console.log('✅ TIPO: Sincronización Completada (Property: SyncEnd)');
        console.log('   ⚠️  La sincronización inicial ha terminado.');
        console.log('   📡 A partir de ahora solo recibirás actualizaciones en tiempo real.');
        console.log(`\n📊 Resumen: ${subscribedAccounts.size} cuenta(s) suscrita(s)`);
        subscribedAccounts.forEach(acc => console.log(`   - ${acc}`));
      } else {
        console.log('🔧 TIPO: Propiedad (Property)');
        console.log(`   Nombre: ${message.name || 'N/A'}`);
      }
      break;

    default:
      console.log(`❓ TIPO: ${message.type || 'Desconocido'}`);
      console.log('   Datos completos:', JSON.stringify(message, null, 2));
  }

  console.log(separator);
}
*/

// ============================================
// CÓDIGO COMENTADO - SOCKET.IO Y SUSCRIPCIONES
// ============================================
/*
console.log('🔧 Configuración:');
console.log('API Key:', DEVELOPER_API_KEY);
console.log('Streams API URL:', STREAMS_API_URL);
console.log('Backend API URL:', BACKEND_API_URL);
console.log('Usuario:', USER_EMAIL);
console.log('Servidor:', SERVER);
console.log('');

// Crear conexión Socket.IO con namespace /streams-api
// Según la documentación:
// - Namespace: /streams-api (se incluye en la URL)
// - Handshake path: /streams-api/socket.io
// - Transport: websocket
// - IMPORTANTE: developer-api-key debe ir en headers HTTP durante el handshake
// NOTA: Socket.IO maneja automáticamente el protocolo (https -> wss)
const socket = io(`${STREAMS_API_URL}/streams-api`, {
  path: '/streams-api/socket.io',
  transports: ['websocket'],
  forceNew: true,
  reconnection: true, // Habilitar reconexión automática
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  // extraHeaders es la forma correcta de enviar headers HTTP personalizados
  // Estos headers se envían durante el handshake HTTP inicial
  extraHeaders: {
    'developer-api-key': DEVELOPER_API_KEY
  }
});

// ============================================
// EVENTOS DE CONEXIÓN SOCKET.IO
// ============================================

// Evento 'connect' - cuando se establece la conexión
socket.on('connect', async () => {
  console.log('\n✅ [SOCKET.IO] Conectado a Streams API');
  console.log('   Socket ID:', socket.id);
  console.log('   Transport:', socket.io.engine.transport.name);
  console.log('   Connected:', socket.connected);
  
  // Obtener tokens JWT, luego información de cuentas y suscribirse
  try {
    // Paso 1: Obtener tokens JWT (uno por cada cuenta)
    const tokensArray = await getJWTToken();
    if (!tokensArray || tokensArray.length === 0) {
      console.log('⚠️  No se pudieron obtener tokens. Verifica las credenciales.');
      return;
    }
    
    console.log(`\n📋 ${tokensArray.length} token(s) obtenido(s) para Streams API`);
    
    // Paso 2: Obtener token del Backend API (diferente al de Streams)
    // Este token tiene audience 'tradelocker-api-traders' y se usa para /all-accounts
    const backendAPIToken = await getBackendAPIToken();
    
    // Paso 3: Obtener información de todas las cuentas usando el token del Backend API
    const accountsInfo = await getAllAccounts(backendAPIToken);
    
    if (!accountsInfo || accountsInfo.length === 0) {
      console.log('⚠️  No se encontraron cuentas. Verifica las credenciales.');
      return;
    }
    
    // Paso 4: Combinar tokens con información de cuentas
    // Mapear cada token con su cuenta correspondiente por accountId
    console.log('\n🔗 Combinando tokens con información de cuentas...');
    accountTokens = tokensArray.map((tokenData, idx) => {
      console.log(`\n   Token ${idx + 1}:`);
      console.log(`     Token accountId: ${tokenData.accountId || 'N/A'}`);
      
      // Buscar la cuenta correspondiente por accountId
      const account = accountsInfo.find(acc => 
        acc.accountId === tokenData.accountId || 
        acc.id === tokenData.accountId ||
        acc.accountId === tokenData.accountId?.toString() ||
        acc.id === tokenData.accountId?.toString()
      ) || accountsInfo[0]; // Fallback a la primera cuenta si no se encuentra
      
      if (!account) {
        console.error(`     ⚠️  No se encontró cuenta correspondiente para token ${idx + 1}`);
        return null;
      }
      
      console.log(`     Cuenta encontrada:`);
      console.log(`       ID: ${account.id}`);
      console.log(`       Account ID: ${account.accountId}`);
      console.log(`       Currency: ${account.currency}`);
      console.log(`       Status: ${account.status}`);
      
      const combined = {
        accessToken: tokenData.accessToken,
        accountId: tokenData.accountId || account.accountId || account.id,
        accountIdNumeric: account.id, // ID numérico para el mensaje de suscripción
        currency: account.currency,
        status: account.status,
        accountName: account.accountName,
        brandId: account.brandId || tokenData.brandId || SERVER,
        expireDate: tokenData.expireDate
      };
      
      console.log(`     ✅ Datos combinados:`);
      console.log(`       Account ID (string): ${combined.accountId}`);
      console.log(`       Account ID (numérico): ${combined.accountIdNumeric}`);
      console.log(`       Currency: ${combined.currency}`);
      console.log(`       Status: ${combined.status}`);
      
      return combined;
    }).filter(item => item !== null); // Filtrar nulls si hubo errores
    
    console.log(`\n✅ ${accountTokens.length} cuenta(s) preparada(s) para suscripción`);
    
    // Paso 5: Suscribirse a todas las cuentas
    subscribeToAllAccounts();
  } catch (error) {
    console.error('❌ Error en el proceso de autenticación:', error.message || error);
    console.log('⚠️  Verifica las credenciales en la configuración del script.');
  }
});

// Evento 'disconnect' - cuando se pierde la conexión
socket.on('disconnect', (reason) => {
  console.log('\n❌ [SOCKET.IO] Desconectado de Streams API');
  console.log('   Razón:', reason);
  if (reason === 'io server disconnect') {
    console.log('   El servidor forzó la desconexión');
  } else if (reason === 'io client disconnect') {
    console.log('   El cliente forzó la desconexión');
  } else if (reason === 'ping timeout') {
    console.log('   Timeout de ping - el servidor no respondió');
  } else if (reason === 'transport close') {
    console.log('   La conexión de transporte se cerró');
  } else if (reason === 'transport error') {
    console.log('   Error en el transporte');
  }
});

// Evento 'connect_error' - cuando hay un error al conectar
socket.on('connect_error', (error) => {
  console.error('\n❌ [SOCKET.IO] Error de conexión:', error.message);
  console.error('   Tipo:', error.type);
  console.error('   Descripción:', error.description);
  console.error('   Context:', error.context);
  if (error.message) {
    console.error('   Mensaje completo:', JSON.stringify(error, null, 2));
  }
  
  // Si el error menciona API key, verificar que se esté enviando
  if (error.message && error.message.toLowerCase().includes('api')) {
    console.error('\n⚠️  Posible problema con developer-api-key');
    console.error('   Verifica que el header se esté enviando correctamente');
    console.error('   API Key configurada:', DEVELOPER_API_KEY);
  }
});

// Escuchar el evento 'connection' que puede traer errores de autenticación
socket.on('connection', (message) => {
  console.log('\n🔌 Mensaje de conexión recibido:');
  console.log(JSON.stringify(message, null, 2));
  
  // Si hay un error de API key, no intentar suscribirse
  if (message && message.status === 'error') {
    if (message.code && message.code.includes('developer')) {
      hasAuthError = true; // Marcar que hubo error de autenticación
      console.error('\n❌ ERROR: API Key no encontrada o inválida');
      console.error('Código:', message.code);
      console.error('Mensaje:', message.message);
      console.error('\n💡 Posibles soluciones:');
      console.error('1. Verifica que el API key sea correcto: ' + DEVELOPER_API_KEY);
      console.error('2. Verifica que el API key sea válido para el entorno de desarrollo');
      console.error('3. El API key debe estar activo y asociado a tu cuenta de desarrollador');
      console.error('4. Contacta con TradeLocker para verificar el estado de tu API key');
      console.error('\n⚠️  No se intentará suscribirse debido al error de autenticación');
      socket.disconnect(); // Desconectar ya que no hay autenticación válida
      return; // No continuar con la suscripción
    }
  }
});

// ============================================
// CONFIGURAR TODOS LOS LISTENERS ANTES DE SUSCRIBIRSE
// ============================================
// IMPORTANTE: Según la documentación de Socket.IO, los listeners deben estar
// configurados ANTES de enviar mensajes para no perder eventos

// Escuchar mensajes del stream
// Según la documentación: "RECEIVE stream - Socket.IO event `stream` - Subscribe to this event to receive all updates for accounts"
socket.on('stream', (message) => {
  // Verificar si es un mensaje de suscripción (AccountSubscribeAction) - estos no se deben procesar
  if (message && (message.action === 'SUBSCRIBE' || message.action === 'UNSUBSCRIBE')) {
    console.log(`\n⚠️  [DEBUG] Mensaje de acción recibido (no debería llegar aquí):`, message);
    return;
  }
  
  // Verificar que el mensaje tenga un tipo válido
  if (!message || !message.type) {
    console.log(`\n⚠️  [DEBUG] Mensaje sin tipo recibido:`, JSON.stringify(message, null, 2));
    return;
  }
  
  messageCount++;
  
  // Durante la sincronización inicial, recibimos todos los datos actuales
  // "When the account subscription connection is first established, the API sends a stream 
  // of messages containing the current state of the user's accounts, positions, and open orders."
  if (!syncEndReceived) {
    console.log(`\n🔔 [SYNC] Mensaje #${messageCount} recibido durante sincronización inicial`);
  } else {
    console.log(`\n🔔 [REALTIME] Mensaje #${messageCount} recibido (actualización en tiempo real)`);
  }
  
  // Verificar si es un mensaje de sincronización
  // "Once all the initial data has been sent, you will receive a special message type: Property name: SyncEnd"
  if (message.type === 'Property' && message.name === 'SyncEnd') {
    syncEndReceived = true;
    console.log('\n🎯 ✅ Sincronización inicial completada');
    console.log('   📡 A partir de ahora solo recibirás actualizaciones en tiempo real');
    console.log(`   📊 Total de mensajes recibidos durante sincronización: ${messageCount}`);
    console.log(`\n📊 Resumen: ${subscribedAccounts.size} cuenta(s) suscrita(s)`);
    subscribedAccounts.forEach(acc => console.log(`   - ${acc}`));
  }
  
  formatMessage(message);
});

// Escuchar todos los eventos para debug (excepto 'stream' que ya está manejado)
socket.onAny((eventName, ...args) => {
  // No loguear 'stream' aquí porque ya se maneja arriba con más detalle
  if (eventName !== 'stream') {
    console.log(`\n📡 [EVENT] Evento recibido: ${eventName}`);
    if (args.length > 0) {
      console.log('   Datos:', JSON.stringify(args, null, 2));
    }
  }
});

// Este listener ya está arriba para manejar errores de autenticación

// Escuchar mensajes de estado
socket.on('status', (message) => {
  const timestamp = new Date().toLocaleTimeString('es-ES');
  console.log(`\n📊 [${timestamp}] Status:`, JSON.stringify(message, null, 2));
});

// Escuchar respuestas de suscripción (evento 'subscriptions')
// Según la documentación, puede haber mensajes SubscriptionsStatusMessage
socket.on('subscriptions', (message) => {
  const timestamp = new Date().toLocaleTimeString('es-ES');
  console.log(`\n📥 [${timestamp}] [EVENT subscriptions] Respuesta de Suscripción recibida:`);
  console.log(`   Estado: ${message?.status || 'N/A'}`);
  console.log(`   Código: ${message?.code || 'N/A'}`);
  console.log(`   Mensaje: ${message?.message || 'N/A'}`);
  if (message?.remainingRequests !== undefined) {
    console.log(`   Solicitudes restantes: ${message.remainingRequests}`);
  }
  if (message && message.status === 'ok') {
    // Agregar a cuentas suscritas si no está ya
    const accountId = message.message?.match(/account\s+([^\s]+)/i)?.[1] || 'UNKNOWN';
    subscribedAccounts.add(accountId);
  }
});

// Variable para rastrear si hubo error de autenticación
let hasAuthError = false;

// Función para suscribirse a todas las cuentas
function subscribeToAllAccounts() {
  if (hasAuthError) {
    console.log('\n⚠️  Saltando suscripción debido a error de autenticación');
    return;
  }

  if (accountTokens.length === 0) {
    console.error('\n❌ No hay tokens disponibles para suscribirse');
    return;
  }

  console.log(`\n📤 Suscribiéndose a ${accountTokens.length} cuenta(s)...`);
  
  // Suscribirse a cada cuenta con un pequeño delay entre cada una
  accountTokens.forEach((tokenData, index) => {
    setTimeout(() => {
      const token = tokenData.accessToken;
      const accountId = tokenData.accountId || 'UNKNOWN';
      const accountIdNumeric = tokenData.accountIdNumeric;
      const currency = tokenData.currency || 'USD';
      const accountStatus = tokenData.status || 'ACTIVE'; // Status real de la cuenta (ACTIVE, INACTIVE, etc.)
      
      // Verificar si el token está expirado
      if (isTokenExpired(token)) {
        console.error(`\n⚠️  Token expirado para cuenta ${accountId}, saltando...`);
        return;
      }

      // Construir mensaje de suscripción con parámetros requeridos
      // Según la documentación: "Subscribe to the account using the JWT, the account ID, and the Brand ID"
      // Mínimo requerido: action, token, type, id, currency
      if (!accountIdNumeric || !currency) {
        console.error(`❌ Faltan parámetros requeridos para cuenta ${accountId}:`);
        console.error(`   ID: ${accountIdNumeric || 'FALTANTE'}`);
        console.error(`   Currency: ${currency || 'FALTANTE'}`);
        return;
      }
      
      // Construir mensaje de suscripción según la documentación de Streams API
      // IMPORTANTE: El formato debe ser exacto según la documentación
      const subscribeMessage = {
        action: 'SUBSCRIBE', // Acción requerida
        token: token, // JWT token requerido (del endpoint /auth/jwt/accounts/tokens)
        type: 'AccountStatus', // Tipo de stream al que nos suscribimos (requerido)
        accountId: accountIdNumeric,  // Account ID numérico (requerido) - debe ser el ID numérico de la cuenta
        currency: currency,    // Currency (requerido) - ej: "USD", "EUR", etc.
        brandId: "TFUNDS", // Brand ID (Server name) - opcional pero recomendado
      };
      
      // Log detallado del mensaje que se enviará
      console.log(`\n📋 [DEBUG] Detalles de la suscripción para cuenta ${accountId}:`);
      console.log(`   Account ID (string): ${accountId}`);
      console.log(`   Account ID (numérico): ${accountIdNumeric}`);
      console.log(`   Currency: ${currency}`);
      console.log(`   Status: ${accountStatus}`);
      console.log(`   Brand ID: ${tokenData.brandId || SERVER}`);
      
      console.log(`\n📤 [SOCKET.IO] Suscribiéndose a cuenta ${index + 1}/${accountTokens.length}: ${accountId}`);
      console.log('   Socket conectado:', socket.connected);
      console.log('   Socket ID:', socket.id);
      console.log('   Transport:', socket.io?.engine?.transport?.name || 'N/A');
      console.log('\n📨 Mensaje de suscripción completo:');
      console.log(JSON.stringify(subscribeMessage, null, 2));
      console.log('\n🔑 Token JWT:');
      console.log('   Primeros 100 chars:', token.substring(0, 100) + '...');
      console.log('   Longitud total:', token.length, 'caracteres');
      
      // Verificar que el token no esté vacío
      if (!token || token.length < 50) {
        console.error(`❌ Token JWT inválido o muy corto para cuenta ${accountId}`);
        return;
      }
      
      // Verificar que el socket esté conectado antes de enviar
      if (!socket.connected) {
        console.error(`❌ Socket no está conectado, no se puede suscribir a cuenta ${accountId}`);
        console.error('   Esperando reconexión...');
        return;
      }
      
      // Verificar que el listener de 'stream' esté configurado
      const hasStreamListener = socket.hasListeners('stream');
      console.log('   Listener de "stream" configurado:', hasStreamListener);
      if (!hasStreamListener) {
        console.error('   ⚠️  ADVERTENCIA: No hay listener configurado para el evento "stream"');
      }
      
      // Según la documentación de Socket.IO, usar socket.timeout() para ACK con timeout
      // https://socket.io/docs/v4/tutorial/api-overview/#acknowledgements
      console.log(`\n📤 [SOCKET.IO] Enviando mensaje de suscripción usando socket.emit() con ACK...`);
      
      // Convertir el mensaje a JSON string antes de enviarlo
      const subscribeMessageJSON = JSON.stringify(subscribeMessage);
      console.log('\n📦 Mensaje convertido a JSON string:');
      console.log(subscribeMessageJSON);
      console.log('\n📏 Longitud del JSON:', subscribeMessageJSON.length, 'caracteres');
      
      // Parsear el JSON de vuelta a objeto para enviarlo
      // Socket.IO serializa automáticamente los objetos a JSON, pero aquí lo hacemos explícitamente
      const messageToSend = JSON.parse(subscribeMessageJSON);
      console.log('✅ JSON parseado correctamente, enviando objeto...');
      
      // Usar socket.timeout() según la documentación de Socket.IO
      // IMPORTANTE: El mensaje debe incluir 'action: SUBSCRIBE' y todos los parámetros requeridos
      // Socket.IO serializará el objeto a JSON automáticamente al enviarlo
      socket.timeout(10000).emit('stream', messageToSend, (err, response) => {
        if (err) {
          // El servidor no respondió en el tiempo dado
          console.error(`\n❌ [TIMEOUT] No se recibió respuesta ACK después de 10 segundos para cuenta ${accountId}`);
          console.error('   Error:', err);
          console.error('   Esto puede significar que:');
          console.error('   1. El servidor no está respondiendo');
          console.error('   2. El token JWT es inválido o expirado');
          console.error('   3. Hay un problema de conectividad');
          console.error('   4. El formato del mensaje puede estar incorrecto');
          console.error('   Pero los mensajes del stream pueden seguir llegando...');
          return;
        }
        
        // Respuesta recibida exitosamente
        console.log(`\n📥 [ACK CALLBACK] Respuesta recibida para cuenta ${accountId}:`);
        console.log('   Respuesta completa:', JSON.stringify(response, null, 2));
        
        if (response && response.status === 'ok') {
          console.log(`✅ Suscripción exitosa a cuenta ${accountId}`);
          subscribedAccounts.add(accountId);
          if (response.remainingRequests !== undefined) {
            console.log(`   Solicitudes restantes: ${response.remainingRequests}`);
          }
          console.log(`\n⏳ Esperando mensajes del stream para cuenta ${accountId}...`);
          console.log('   💡 Haz cambios en Tradelocker para ver actualizaciones en tiempo real');
          console.log('   📊 Durante la sincronización inicial recibirás todos los datos actuales');
          console.log('   📡 Después de SyncEnd solo recibirás actualizaciones en tiempo real');
        } else {
          console.error(`❌ Error en suscripción a cuenta ${accountId}:`, response?.message || response);
          if (response?.code) {
            console.error(`   Código de error: ${response.code}`);
          }
        }
      });
    }, index * 500); // Delay de 500ms entre cada suscripción
  });
}

// Manejar errores
/*
socket.on('error', (error) => {
  console.error('❌ Error:', error);
});

// Mantener el script corriendo
console.log('🚀 Iniciando conexión a Streams API...');
console.log('📡 Se suscribirá a TODAS las cuentas disponibles');
console.log('💡 Haz cambios en Tradelocker para ver las actualizaciones en tiempo real');
console.log('⏹️  Presiona Ctrl+C para salir\n');
*/

// ============================================
// EJECUTAR PRUEBA TEMPORAL
// ============================================
console.log('🧪 Ejecutando prueba temporal del nuevo endpoint...\n');

testNewEndpoint()
  .then((response) => {
    console.log('\n✅ Prueba completada exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en la prueba:', error.message);
    process.exit(1);
  });

