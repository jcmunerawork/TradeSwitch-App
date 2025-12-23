// Script para probar obtención de tokens de TradeLocker y conexión a Streams API
// Ejecutar: node test-streams-api.js


// Proxy de streams comentado temporalmente para probar conexión directa
  // "/streams-api-proxy/*": {
  //   "target": "http://localhost:4000",
  //   "secure": false,
  //   "changeOrigin": true,
  //   "logLevel": "debug",
  //   "ws": true
  // }


const https = require('https');
const { io } = require('socket.io-client');

// ============================================
// CONFIGURACIÓN
// ============================================

// URL del Backend API para obtener tokens
const BACKEND_API_URL = 'https://stg.tradelocker.com/backend-api';

// URL del Streams API (Socket.IO)
const STREAMS_API_URL = 'https://api-dev.tradelocker.com/streams-api';

// Credenciales para obtener tokens
const USER_EMAIL = 'monet@tradeswitch.io';
const USER_PASSWORD = 'Password!1!';
const SERVER = 'BAPIA';

// Developer API Key para Streams API
const DEVELOPER_API_KEY = 'tl-7xUz3A0a2aAReLuGnaU%kmaF';

// ============================================
// FUNCIÓN PARA OBTENER TOKEN
// ============================================

/**
 * Obtiene el token JWT para la primera cuenta del usuario.
 * 
 * @returns {Promise<{accessToken: string, accountId: string, expireDate: string}>}
 */
async function getAccountToken() {
  return new Promise((resolve, reject) => {
    const body = {
      email: USER_EMAIL,
      password: USER_PASSWORD,
      server: SERVER
    };
    
    const postData = JSON.stringify(body);
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🔐 OBTENIENDO TOKEN JWT');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n📤 Enviando petición de autenticación...');
    console.log('   URL:', `${BACKEND_API_URL}/auth/jwt/accounts/tokens`);
    console.log('   Método: POST');
    console.log('   Body:', JSON.stringify(body, null, 2));

    const url = new URL(`${BACKEND_API_URL}/auth/jwt/accounts/tokens`);
    
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

    const req = https.request(options, (res) => {
      let data = '';

      console.log('\n📥 Respuesta recibida:');
      console.log('   Status Code:', res.statusCode);
      console.log('   Status Message:', res.statusMessage);

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const errorResponse = JSON.parse(data);
            console.error('\n❌ Error HTTP:', res.statusCode);
            console.error('   Mensaje:', errorResponse.message || 'Sin mensaje');
            reject(new Error(errorResponse.message || `HTTP ${res.statusCode}`));
            return;
          }

          const response = JSON.parse(data);
          
          console.log('\n✅ Petición exitosa (HTTP', res.statusCode + ')');
          console.log('\n📋 Respuesta completa:');
          console.log(JSON.stringify(response, null, 2));
          
          // Verificar que la respuesta tenga la estructura esperada
          if (!response.data || !Array.isArray(response.data)) {
            console.error('\n❌ La respuesta no tiene el formato esperado: { data: [...] }');
            console.error('   Respuesta recibida:', JSON.stringify(response, null, 2));
            reject(new Error('Formato de respuesta no válido'));
            return;
          }
          
          if (response.data.length === 0) {
            console.error('\n❌ No se encontraron cuentas en la respuesta');
            reject(new Error('No se encontraron cuentas'));
            return;
          }
          
          console.log(`\n📊 Cuentas encontradas: ${response.data.length}`);
          
          // Tomar la primera cuenta
          const firstAccount = response.data[0];
          
          if (!firstAccount.accessToken) {
            console.error('\n❌ La primera cuenta no tiene accessToken');
            reject(new Error('accessToken no encontrado en la respuesta'));
            return;
          }
          
          if (!firstAccount.accountId) {
            console.error('\n❌ La primera cuenta no tiene accountId');
            reject(new Error('accountId no encontrado en la respuesta'));
            return;
          }
          
          console.log('\n✅ Token obtenido exitosamente:');
          console.log('   Account ID:', firstAccount.accountId);
          console.log('   Expire Date:', firstAccount.expireDate);
          console.log('   Access Token (primeros 50 chars):', firstAccount.accessToken.substring(0, 50) + '...');
          
          const tokenData = {
            accessToken: firstAccount.accessToken,
            accountId: firstAccount.accountId,
            expireDate: firstAccount.expireDate
          };
          
          resolve(tokenData);
        } catch (e) {
          console.error('\n❌ Error parseando respuesta como JSON:', e.message);
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

// ============================================
// EJECUTAR
// ============================================

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🚀 INICIANDO PRUEBA DE OBTENCIÓN DE TOKEN');
console.log('═══════════════════════════════════════════════════════════════');

getAccountToken()
  .then((tokenData) => {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ TOKEN OBTENIDO EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n📦 Token guardado:');
    console.log('   Access Token:', tokenData.accessToken);
    console.log('   Account ID:', tokenData.accountId);
    console.log('   Expire Date:', tokenData.expireDate);
    
    // Conectar a Streams API
    connectToStreamsAPI(tokenData);
  })
  .catch((error) => {
    console.error('\n❌ Error obteniendo token:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  });

// ============================================
// FUNCIÓN PARA CONECTAR A STREAMS API
// ============================================

/**
 * Conecta a Streams API usando Socket.IO
 * 
 * @param {Object} tokenData - Datos del token obtenido
 */
function connectToStreamsAPI(tokenData) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔌 CONECTANDO A STREAMS API');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n🔧 Configuración Socket.IO:');
  console.log('   URL:', STREAMS_API_URL);
  console.log('   Client Version: v4');
  console.log('   Handshake Path: /streams-api/socket.io');
  console.log('   Developer API Key:', DEVELOPER_API_KEY);
  
  // Configurar Socket.IO
  const socket = io(STREAMS_API_URL, {
    path: '/streams-api/socket.io',
    transports: ['websocket'],
    forceNew: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 20000,
    extraHeaders: {
      'developer-api-key': DEVELOPER_API_KEY
    }
  });
  
  // ============================================
  // EVENTOS DE CONEXIÓN
  // ============================================
  
  socket.on('connect', () => {
    console.log('\n✅ [SOCKET.IO] Conectado a Streams API');
    console.log('   Socket ID:', socket.id);
    console.log('   Transport:', socket.io.engine.transport.name);
    console.log('   Connected:', socket.connected);
    
    // Enviar mensaje de suscripción después de conectar
    setTimeout(() => {
      subscribeToAccount(socket, tokenData);
    }, 1000);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('\n❌ [SOCKET.IO] Desconectado de Streams API');
    console.log('   Razón:', reason);
  });
  
  socket.on('connect_error', (error) => {
    console.error('\n❌ [SOCKET.IO] Error de conexión:', error.message);
    console.error('   Tipo:', error.type);
    if (error.description) {
      console.error('   Descripción:', error.description);
    }
  });
  
  // ============================================
  // EVENTOS A ESCUCHAR
  // ============================================
  
  // Evento: connection
  socket.on('connection', (message) => {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    console.log(`\n🔌 [${timestamp}] [EVENT: connection] Mensaje recibido:`);
    console.log(JSON.stringify(message, null, 2));
  });
  
  // Evento: exception
  socket.on('exception', (message) => {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    console.log(`\n⚠️  [${timestamp}] [EVENT: exception] Excepción recibida:`);
    console.log(JSON.stringify(message, null, 2));
  });
  
  // Evento: subscriptions
  socket.on('subscriptions', (message) => {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    console.log(`\n📥 [${timestamp}] [EVENT: subscriptions] Mensaje recibido:`);
    console.log(JSON.stringify(message, null, 2));
  });
  
  // Evento: stream
  socket.on('stream', (message) => {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    console.log(`\n📡 [${timestamp}] [EVENT: stream] Mensaje recibido:`);
    console.log(JSON.stringify(message, null, 2));
  });
  
  // Escuchar todos los eventos para debug (opcional)
  socket.onAny((eventName, ...args) => {
    if (!['connection', 'exception', 'subscriptions', 'stream', 'connect', 'disconnect', 'connect_error'].includes(eventName)) {
      const timestamp = new Date().toLocaleTimeString('es-ES');
      console.log(`\n📨 [${timestamp}] [EVENT: ${eventName}] Evento recibido:`);
      if (args.length > 0) {
        console.log(JSON.stringify(args, null, 2));
      }
    }
  });
  
  // Guardar socket y tokenData para uso posterior
  global.socket = socket;
  global.tokenData = tokenData;
  
  // Mantener el script corriendo
  console.log('\n⏳ Esperando conexión y eventos del stream...');
  console.log('💡 Presiona Ctrl+C para salir\n');
}

// ============================================
// FUNCIÓN PARA SUSCRIBIRSE A UNA CUENTA
// ============================================

/**
 * Envía el mensaje de suscripción a Streams API
 * 
 * @param {Object} socket - Instancia de Socket.IO
 * @param {Object} tokenData - Datos del token obtenido
 */
function subscribeToAccount(socket, tokenData) {
  if (!tokenData || !tokenData.accessToken) {
    console.error('\n❌ No hay token disponible para suscribirse');
    return;
  }
  
  if (!socket.connected) {
    console.error('\n❌ Socket no está conectado, no se puede suscribir');
    return;
  }
  
  const subscribeMessage = {
    action: 'SUBSCRIBE',
    token: tokenData.accessToken
  };
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📤 ENVIANDO MENSAJE DE SUSCRIPCIÓN');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n📋 Mensaje a enviar:');
  console.log(JSON.stringify(subscribeMessage, null, 2));
  console.log('\n🔑 Token (primeros 100 chars):');
  console.log('   ' + tokenData.accessToken.substring(0, 100) + '...');
  console.log('\n📡 Enviando al evento: subscriptions');
  console.log('   Con ACK habilitado');
  console.log('   Timeout: 20000ms');
  
  // Enviar mensaje con ACK
  socket.timeout(20000).emit('subscriptions', subscribeMessage, (err, response) => {
    if (err) {
      console.error('\n❌ [TIMEOUT/ERROR] No se recibió respuesta ACK después de 20 segundos');
      console.error('   Error:', err);
      console.error('   Esto puede significar que:');
      console.error('   1. El servidor no está respondiendo');
      console.error('   2. El token JWT es inválido o expirado');
      console.error('   3. Hay un problema de conectividad');
      console.error('   4. El formato del mensaje puede estar incorrecto');
      return;
    }
    
    console.log('\n✅ [ACK CALLBACK] Respuesta recibida:');
    console.log(JSON.stringify(response, null, 2));
    
    if (response && response.status === 'ok') {
      console.log('\n✅ Suscripción exitosa!');
      if (response.remainingRequests !== undefined) {
        console.log(`   Solicitudes restantes: ${response.remainingRequests}`);
      }
      console.log('\n📡 Ahora recibirás mensajes del stream en tiempo real');
    } else {
      console.error('\n❌ Error en suscripción:', response?.message || response);
      if (response?.code) {
        console.error(`   Código de error: ${response.code}`);
      }
    }
  });
}

  