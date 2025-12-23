import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Crear servidor HTTP para Socket.IO
const httpServer = createServer(app);

// Configuración del proxy WebSocket para TradeLocker Streams API
const STREAMS_API_URL = 'https://api-dev.tradelocker.com/streams-api';
const DEVELOPER_API_KEY = 'tl-7xUz3A0a2aAReLuGnaU%kmaF';

// Crear servidor Socket.IO para el proxy
const io = new SocketIOServer(httpServer, {
  path: '/streams-api-proxy/socket.io',
  cors: {
    origin: '*', // En producción, especificar los orígenes permitidos
    methods: ['GET', 'POST']
  }
});

// Mapa para almacenar las conexiones cliente -> TradeLocker
const clientToTradeLockerMap = new Map<string, any>();

// Manejar conexiones del cliente Angular
io.on('connection', (clientSocket) => {
  console.log(`[WebSocket Proxy] Cliente conectado: ${clientSocket.id}`);

  // Crear conexión a TradeLocker Streams API con el header requerido
  const tradeLockerSocket = SocketIOClient(STREAMS_API_URL, {
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

  // Almacenar el mapeo
  clientToTradeLockerMap.set(clientSocket.id, tradeLockerSocket);

  // Reenviar eventos de TradeLocker al cliente
  // NOTA: 'connect' y 'disconnect' son eventos reservados de Socket.IO
  // No se pueden emitir manualmente, se disparan automáticamente
  tradeLockerSocket.on('connect', () => {
    console.log(`[WebSocket Proxy] Conectado a TradeLocker para cliente ${clientSocket.id}`);
    // No emitir 'connect' manualmente - Socket.IO lo maneja automáticamente
  });

  tradeLockerSocket.on('disconnect', (reason) => {
    console.log(`[WebSocket Proxy] Desconectado de TradeLocker para cliente ${clientSocket.id}:`, reason);
    // No emitir 'disconnect' manualmente - Socket.IO lo maneja automáticamente
  });

  tradeLockerSocket.on('connect_error', (error) => {
    console.error(`[WebSocket Proxy] Error de conexión a TradeLocker para cliente ${clientSocket.id}:`, error);
    clientSocket.emit('connect_error', error);
  });

  tradeLockerSocket.on('connection', (message) => {
    clientSocket.emit('connection', message);
  });

  tradeLockerSocket.on('exception', (message) => {
    clientSocket.emit('exception', message);
  });

  tradeLockerSocket.on('subscriptions', (message) => {
    clientSocket.emit('subscriptions', message);
  });

  tradeLockerSocket.on('stream', (message) => {
    clientSocket.emit('stream', message);
  });

  // Reenviar eventos del cliente a TradeLocker
  clientSocket.onAny((eventName, ...args) => {
    // Reenviar todos los eventos excepto los de conexión/desconexión que ya manejamos
    if (eventName !== 'connect' && eventName !== 'disconnect' && eventName !== 'connect_error') {
      tradeLockerSocket.emit(eventName, ...args);
    }
  });

  // Limpiar cuando el cliente se desconecta
  clientSocket.on('disconnect', () => {
    console.log(`[WebSocket Proxy] Cliente desconectado: ${clientSocket.id}`);
    if (tradeLockerSocket) {
      tradeLockerSocket.disconnect();
    }
    clientToTradeLockerMap.delete(clientSocket.id);
  });
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  httpServer.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
    console.log(`WebSocket Proxy disponible en ws://localhost:${port}/streams-api-proxy/socket.io`);
  });
  
  // Manejar errores del servidor
  httpServer.on('error', (error: Error) => {
    console.error('Error starting server:', error);
      throw error;
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
