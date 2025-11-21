// Script para probar Streams API con Node.js
// Instalar: npm install socket.io-client
// Ejecutar: node test-streams-api.js

const { io } = require('socket.io-client');

// CONFIGURACIÓN - Reemplaza con tus valores
const DEVELOPER_API_KEY = 'tl-g0fswpjddxnovcr0smdkpb160ybnivgk';
// IMPORTANTE: Usar https:// no wss:// - Socket.IO maneja el protocolo WebSocket internamente
const STREAMS_API_URL = 'https://api-dev.tradelocker.com';
const JWT_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ0cmFkZWxvY2tlci1hcGkiLCJhdWQiOiJ0cmFkZWxvY2tlci1hcGktdHJhZGVycyIsInR5cGUiOiJhY2Nlc3NfdG9rZW4iLCJzdWIiOiJURlVORFMjYmQzZTA2NmQtMmYxYy00NjliLWIyZGUtZDFiNzg0NjcwZjZkIiwidWlkIjoiYmQzZTA2NmQtMmYxYy00NjliLWIyZGUtZDFiNzg0NjcwZjZkIiwiYnJhbmQiOiJURlVORFMiLCJob3N0IjoiYnNiLnRyYWRlbG9ja2VyLmNvbSIsImVtYWlsIjoidGVzdEB0aGVmdW5kZWRwaWNrcy5jb20iLCJicmFuZFVzZXJJZCI6ImJkM2UwNjZkLTJmMWMtNDY5Yi1iMmRlLWQxYjc4NDY3MGY2ZCIsImFjY291bnRUeXBlIjoiREVNTyIsImlhdCI6MTc2MzcyNDY2NiwiZXhwIjoxNzYzNzI4MjY2fQ.FDdNM9ZsDsllqM2pIs6COeVwUHqBXoGosgLUnC1tOTl0ASgOsaPz1oGDf9m4ijwfHwvWSMN7gTpJgOzpasHKwHU0mynEbnYKQSkjE_aO3wm5dh0f0rFsTMmzMJGVNhmQ4HuwCCDTa3W6wk0p3hPIN4O4Ag2iLpZ38rGvFzjX37lHaFlA5s4BVo1pvpnSDN4RaCtc9jNQo99AtrorDUPHtqDVJUQriHIUzpeB6bVZeRhW0dBUJDUtqW1jE3kmvN1Bj3G-h2Zt8WGpdRAgYLQkKBP5UW3NpcsvYTQn37fjUumKMYzeZy_qRo-OY3eLZ2cbtd87ECulCdxhTtR6VfGzcw'; // Del request 1

// Verificar si el JWT token está expirado
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const exp = payload.exp * 1000; // Convertir a milisegundos
    const now = Date.now();
    const isExpired = now > exp;
    if (isExpired) {
      console.warn('⚠️  JWT Token EXPIRADO!');
      console.warn('Expiró el:', new Date(exp).toISOString());
      console.warn('Hora actual:', new Date(now).toISOString());
    } else {
      console.log('✅ JWT Token válido hasta:', new Date(exp).toISOString());
    }
    return isExpired;
  } catch (e) {
    console.warn('⚠️  No se pudo verificar expiración del token');
    return false;
  }
}

console.log('🔧 Configuración:');
console.log('API Key:', DEVELOPER_API_KEY);
console.log('URL:', STREAMS_API_URL);
console.log('Namespace: /streams-api');
console.log('Path: /streams-api/socket.io');
console.log('JWT Token (primeros 50 chars):', JWT_TOKEN.substring(0, 50) + '...');
isTokenExpired(JWT_TOKEN);
console.log('');

// Crear conexión Socket.IO con namespace /streams-api
// Según la documentación: Namespace: /streams-api, Handshake path: /streams-api/socket.io
// IMPORTANTE: developer-api-key debe ir en headers HTTP durante el handshake
const socket = io(`${STREAMS_API_URL}/streams-api`, {
  path: '/streams-api/socket.io',
  transports: ['websocket'],
  forceNew: true,
  reconnection: false, // Desactivar reconexión automática para debug
  // extraHeaders es la forma correcta de enviar headers HTTP personalizados
  // Estos headers se envían durante el handshake HTTP inicial
  extraHeaders: {
    'developer-api-key': DEVELOPER_API_KEY
  }
});

// Eventos de conexión
socket.on('connect', () => {
  console.log('✅ Conectado a Streams API');
  console.log('Socket ID:', socket.id);
  
  // Suscribirse a una cuenta
  subscribeToAccount();
});

socket.on('disconnect', () => {
  console.log('❌ Desconectado de Streams API');
});

socket.on('connect_error', (error) => {
  console.error('❌ Error de conexión:', error.message);
  console.error('Detalles del error:', error);
  if (error.message) {
    console.error('Mensaje completo:', JSON.stringify(error, null, 2));
  }
  
  // Si el error menciona API key, verificar que se esté enviando
  if (error.message && error.message.toLowerCase().includes('api')) {
    console.error('\n⚠️  Posible problema con developer-api-key');
    console.error('Verifica que el header se esté enviando correctamente');
    console.error('API Key configurada:', DEVELOPER_API_KEY);
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

// Escuchar mensajes del stream
socket.on('stream', (message) => {
  console.log('\n📨 Mensaje recibido:');
  console.log('Tipo:', message.type);
  console.log('Datos:', JSON.stringify(message, null, 2));
  
  if (message.type === 'Property' && message.name === 'SyncEnd') {
    console.log('\n✅ Sincronización inicial completada');
  }
});

// Escuchar todos los eventos para debug
socket.onAny((eventName, ...args) => {
  console.log(`\n📡 Evento recibido: ${eventName}`);
  if (args.length > 0) {
    console.log('Datos:', JSON.stringify(args, null, 2));
  }
});

// Este listener ya está arriba para manejar errores de autenticación

// Escuchar mensajes de estado
socket.on('status', (message) => {
  console.log('\n📊 Status:', message);
});

// Variable para rastrear si hubo error de autenticación
let hasAuthError = false;

// Función para suscribirse a una cuenta
function subscribeToAccount() {
  // Si hubo error de autenticación, no intentar suscribirse
  if (hasAuthError) {
    console.log('\n⚠️  Saltando suscripción debido a error de autenticación');
    return;
  }
  
  // Verificar si el token está expirado
  if (isTokenExpired(JWT_TOKEN)) {
    console.error('\n❌ No se puede suscribir: JWT Token expirado');
    console.error('Obtén un nuevo token con el request POST a /auth/jwt/accounts/tokens');
    return;
  }
  
  // Esperar un momento para asegurar que la conexión está lista
  setTimeout(() => {
    const subscribeMessage = {
      action: 'SUBSCRIBE',
      token: JWT_TOKEN
    };
    
    console.log('\n📤 Suscribiéndose a cuenta...');
    console.log('Mensaje:', JSON.stringify(subscribeMessage, null, 2));
    
    // Enviar mensaje de suscripción con ACK callback
    socket.emit('stream', subscribeMessage, (response) => {
      console.log('\n📥 Respuesta de suscripción (ACK):', response);
    });
    
    // También escuchar respuesta sin ACK (por si acaso)
    socket.once('subscriptions', (response) => {
      console.log('\n📥 Respuesta de suscripción (evento):', response);
    });
  }, 1000);
}

// Manejar errores
socket.on('error', (error) => {
  console.error('❌ Error:', error);
});

// Mantener el script corriendo
console.log('🚀 Iniciando conexión a Streams API...');
console.log('Presiona Ctrl+C para salir\n');

