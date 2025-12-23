import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import http from 'http';

// ============================================
// ⚙️ CONFIGURACIÓN - VARIABLES DE ENTORNO
// ============================================
// 🔴 IMPORTANTE: Configura estas variables en Render:
// - TRADELOCKER_STREAMS_URL: https://api-dev.tradelocker.com/streams-api
// - DEVELOPER_API_KEY: tl-7xUz3A0a2aAReLuGnaU%kmaF
// - FRONTEND_URL: https://app.tradeswitch.io (URL base de tu app Angular, sin rutas como /login)
// ============================================

const TRADELOCKER_STREAMS_URL = process.env.TRADELOCKER_STREAMS_URL || 'https://api-dev.tradelocker.com/streams-api';
const DEVELOPER_API_KEY = process.env.DEVELOPER_API_KEY || 'tl-7xUz3A0a2aAReLuGnaU%kmaF';
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4200';

// Crear servidor HTTP
const server = http.createServer();

// Crear servidor Socket.IO para el frontend
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/socket.io'
});

console.log('🚀 [BACKEND] Iniciando servidor Socket.IO proxy');
console.log('📡 [BACKEND] TradeLocker URL:', TRADELOCKER_STREAMS_URL);
console.log('🔑 [BACKEND] API Key:', DEVELOPER_API_KEY.substring(0, 20) + '...');
console.log('🌐 [BACKEND] Frontend URL:', FRONTEND_URL);

// Mapa para almacenar conexiones a TradeLocker por cliente
const tradeLockerConnections = new Map();

// Cuando un cliente del frontend se conecta
io.on('connection', (clientSocket) => {
  console.log('✅ [BACKEND] Cliente conectado:', clientSocket.id);

  // Crear conexión a TradeLocker para este cliente
  const tradeLockerSocket = ioClient(TRADELOCKER_STREAMS_URL, {
    path: '/streams-api/socket.io',
    transports: ['polling', 'websocket'],
    forceNew: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 20000,
    extraHeaders: {
      'developer-api-key': DEVELOPER_API_KEY
    }
  });

  // Guardar la conexión
  tradeLockerConnections.set(clientSocket.id, tradeLockerSocket);

  // Eventos de TradeLocker
  tradeLockerSocket.on('connect', () => {
    console.log('✅ [BACKEND] Conectado a TradeLocker para cliente:', clientSocket.id);
    clientSocket.emit('tradeLockerConnected', { connected: true });
  });

  tradeLockerSocket.on('disconnect', (reason) => {
    console.log('❌ [BACKEND] Desconectado de TradeLocker:', reason);
    clientSocket.emit('tradeLockerDisconnected', { reason });
  });

  tradeLockerSocket.on('connect_error', (error) => {
    console.error('❌ [BACKEND] Error conectando a TradeLocker:', error.message);
    clientSocket.emit('tradeLockerError', { error: error.message });
  });

  // Reenviar todos los eventos de TradeLocker al frontend
  tradeLockerSocket.onAny((eventName, ...args) => {
    // Solo loguear eventos importantes para no saturar la consola
    if (['stream', 'connection', 'exception', 'subscriptions'].includes(eventName)) {
      console.log(`📡 [BACKEND] Reenviando evento ${eventName} al cliente ${clientSocket.id}`);
    }
    clientSocket.emit(eventName, ...args);
  });

  // Escuchar eventos del frontend y reenviarlos a TradeLocker
  clientSocket.on('subscriptions', (message) => {
    console.log('📤 [BACKEND] Reenviando suscripción a TradeLocker:', message);
    tradeLockerSocket.emit('subscriptions', message);
  });

  // Cuando el cliente se desconecta, cerrar la conexión a TradeLocker
  clientSocket.on('disconnect', () => {
    console.log('👋 [BACKEND] Cliente desconectado:', clientSocket.id);
    if (tradeLockerSocket) {
      tradeLockerSocket.disconnect();
      tradeLockerConnections.delete(clientSocket.id);
    }
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`✅ [BACKEND] Servidor escuchando en puerto ${PORT}`);
  console.log(`🌐 [BACKEND] Socket.IO disponible en http://localhost:${PORT}/socket.io`);
});
