import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import http from 'http';
import { StreamProcessor } from './services/stream-processor.js';

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

console.log('🚀 [BACKEND] Iniciando servidor Socket.IO');
console.log('📡 [BACKEND] TradeLocker URL:', TRADELOCKER_STREAMS_URL);
console.log('🔑 [BACKEND] API Key:', DEVELOPER_API_KEY.substring(0, 20) + '...');
console.log('🌐 [BACKEND] Frontend URL:', FRONTEND_URL);

// Mapa para almacenar conexiones a TradeLocker por cliente
const tradeLockerConnections = new Map();

// Procesador de streams para filtrar y optimizar mensajes
const streamProcessor = new StreamProcessor();

// Cuando un cliente del frontend se conecta
io.on('connection', (clientSocket) => {
  console.log('✅ [BACKEND] Cliente conectado:', clientSocket.id);

  // Crear conexión a TradeLocker para este cliente
  // Usar la misma configuración que funciona en test-streams-api.js
  console.log('🔧 [BACKEND] Configurando conexión a TradeLocker:');
  console.log('   URL:', TRADELOCKER_STREAMS_URL);
  console.log('   Path:', '/streams-api/socket.io');
  console.log('   Transports:', 'websocket');
  console.log('   API Key:', DEVELOPER_API_KEY.substring(0, 20) + '...');
  
  const tradeLockerSocket = ioClient(TRADELOCKER_STREAMS_URL, {
    path: '/streams-api/socket.io',
    transports: ['websocket'], // Solo websocket, como en test-streams-api.js
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
    console.log('   Socket ID:', tradeLockerSocket.id);
    console.log('   Transport:', tradeLockerSocket.io?.engine?.transport?.name);
    clientSocket.emit('tradeLockerConnected', { connected: true });
  });

  tradeLockerSocket.on('disconnect', (reason) => {
    console.log('❌ [BACKEND] Desconectado de TradeLocker:', reason);
    clientSocket.emit('tradeLockerDisconnected', { reason });
  });

  tradeLockerSocket.on('connect_error', (error) => {
    console.error('❌ [BACKEND] Error conectando a TradeLocker:');
    console.error('   Mensaje:', error.message);
    console.error('   Tipo:', error.type);
    console.error('   Descripción:', error.description);
    clientSocket.emit('tradeLockerError', { error: error.message });
  });

  // Procesar mensajes del stream antes de reenviarlos
  // IMPORTANTE: El servidor SIEMPRE recibe todos los mensajes para mantener la conexión activa
  // pero solo reenvía al frontend según el filtro (cada minuto para AccountStatus, inmediato para otros)
  tradeLockerSocket.on('stream', (message) => {
    if (!message || !message.type) {
      return; // Ignorar mensajes inválidos
    }

    // IMPORTANTE: Siempre recibir el mensaje (mantiene la conexión activa)
    // Log de recepción para todos los tipos de mensajes
    const accountId = message.accountId?.replace(/^[A-Z]#/, '') || message.accountId || 'unknown';
    console.log(`📥 [BACKEND] Mensaje recibido del stream: ${message.type} para cuenta ${accountId}`);

    // Procesar el mensaje con el StreamProcessor
    // El StreamProcessor filtra AccountStatus (solo reenvía cada minuto si hay cambios)
    // Para otros tipos (Position, ClosePosition, OpenOrder, Property) siempre reenvía
    const processedMessage = streamProcessor.processMessage(clientSocket.id, message);
    
    // Solo reenviar si hay cambios o es un mensaje importante (processedMessage no es null)
    if (processedMessage !== null) {
      // Log según el tipo de mensaje antes de reenviar
      switch (processedMessage.type) {
        case 'AccountStatus':
          console.log(`📊 [BACKEND] Reenviando AccountStatus de cuenta ${processedMessage.accountId} al cliente ${clientSocket.id}`);
          console.log(`   Equity: ${processedMessage.equity}, Posiciones: ${processedMessage.positions.length}`);
          break;
        case 'Position':
          console.log(`📍 [BACKEND] Reenviando Position al cliente ${clientSocket.id}:`, {
            accountId: processedMessage.accountId,
            positionId: processedMessage.positionId,
            instrument: processedMessage.instrument
          });
          break;
        case 'ClosePosition':
          console.log(`🔒 [BACKEND] Reenviando ClosePosition al cliente ${clientSocket.id}:`, {
            accountId: processedMessage.accountId,
            positionId: processedMessage.positionId
          });
          break;
        case 'OpenOrder':
          console.log(`📋 [BACKEND] Reenviando OpenOrder al cliente ${clientSocket.id}:`, {
            accountId: processedMessage.accountId,
            orderId: processedMessage.orderId,
            status: processedMessage.status
          });
          break;
        case 'Property':
          console.log(`🔔 [BACKEND] Reenviando Property al cliente ${clientSocket.id}:`, {
            name: processedMessage.name
          });
          break;
        default:
          console.log(`📨 [BACKEND] Reenviando mensaje tipo ${processedMessage.type} al cliente ${clientSocket.id}`);
      }
      
      clientSocket.emit('stream', processedMessage);
    } else {
      // Mensaje filtrado (sin cambios o en throttling), no reenviar
      // Pero el servidor ya recibió el mensaje, así que la conexión se mantiene activa
      if (message?.type === 'AccountStatus') {
        const accountId = message.accountId?.replace(/^[A-Z]#/, '') || 'unknown';
        console.log(`⏭️  [BACKEND] AccountStatus filtrado (sin cambios o throttling) para cuenta ${accountId} - conexión mantenida`);
      }
    }
  });

  // Reenviar otros eventos de TradeLocker al frontend (connection, exception, subscriptions)
  tradeLockerSocket.on('connection', (message) => {
    console.log(`📡 [BACKEND] Reenviando evento connection al cliente ${clientSocket.id}`);
    clientSocket.emit('connection', message);
  });

  tradeLockerSocket.on('exception', (message) => {
    console.error(`⚠️  [BACKEND] Reenviando excepción al cliente ${clientSocket.id}:`, message);
    clientSocket.emit('exception', message);
  });

  // Escuchar eventos del frontend y reenviarlos a TradeLocker con ACK
  // Socket.IO pasa el callback como último argumento cuando se usa con ACK
  // NOTA: Los ACKs no se propagan correctamente a través de proxies en Socket.IO,
  // por lo que también emitimos un evento 'subscription-response' como respaldo
  clientSocket.on('subscriptions', (message, ackCallback) => {
    console.log('📤 [BACKEND] Reenviando suscripción a TradeLocker:', message);
    console.log('📤 [BACKEND] Tiene callback ACK:', typeof ackCallback === 'function');
    
    // Generar un ID único para esta suscripción para correlacionar la respuesta
    const subscriptionId = `${clientSocket.id}-${Date.now()}`;
    
    // Si hay un callback (ACK), reenviar con callback para mantener el ACK
    if (typeof ackCallback === 'function') {
      // Reenviar con timeout y callback para mantener el ACK
      tradeLockerSocket.timeout(20000).emit('subscriptions', message, (err, response) => {
        if (err) {
          console.error('❌ [BACKEND] Error en suscripción a TradeLocker:', err);
          // Intentar llamar el callback con el error
          try {
            ackCallback(err);
          } catch (e) {
            console.error('❌ [BACKEND] Error al llamar ackCallback con error:', e);
          }
          // También emitir como evento de respaldo
          clientSocket.emit('subscription-response', { subscriptionId, error: err });
          return;
        }
        
        console.log('✅ [BACKEND] Respuesta de TradeLocker recibida:', response);
        
        // Asegurar que la respuesta sea un objeto serializable
        let serializedResponse = response;
        if (response && typeof response === 'object') {
          try {
            // Serializar y deserializar para asegurar que sea un objeto plano
            serializedResponse = JSON.parse(JSON.stringify(response));
          } catch (e) {
            console.warn('⚠️ [BACKEND] No se pudo serializar la respuesta, usando original:', e);
          }
        } else if (response === null || response === undefined) {
          // Si la respuesta es null o undefined, crear un objeto de respuesta por defecto
          console.warn('⚠️ [BACKEND] Respuesta null/undefined de TradeLocker, creando respuesta por defecto');
          serializedResponse = {
            status: 'ok',
            message: 'Subscription received (no explicit response from TradeLocker)'
          };
        }
        
        // Llamar el callback con la respuesta
        // Socket.IO espera (err, response) cuando se usa socket.timeout().emit()
        try {
          ackCallback(null, serializedResponse);
          console.log('✅ [BACKEND] ACK enviado al frontend exitosamente:', JSON.stringify(serializedResponse, null, 2));
        } catch (e) {
          console.error('❌ [BACKEND] Error al enviar ACK al frontend:', e);
          // Si el ACK falla, emitir como evento de respaldo
          clientSocket.emit('subscription-response', { subscriptionId, response: serializedResponse });
        }
      });
    } else {
      // Sin callback, reenviar normalmente
      console.log('📤 [BACKEND] Enviando suscripción sin ACK...');
      tradeLockerSocket.emit('subscriptions', message);
    }
  });

  // Cuando el cliente se desconecta, cerrar la conexión a TradeLocker
  clientSocket.on('disconnect', () => {
    console.log('👋 [BACKEND] Cliente desconectado:', clientSocket.id);
    
    // Limpiar el estado del procesador para este cliente
    streamProcessor.clearClientState(clientSocket.id);
    
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
