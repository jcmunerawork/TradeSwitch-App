import { Injectable, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject, firstValueFrom } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { TradeLockerApiService, TradeLockerCredentials, AccountTokenData } from './tradelocker-api.service';
import { AppContextService } from '../context';
import { AccountData } from '../../features/auth/models/userModel';
import { LoggerService } from '../../core/services';

/**
 * Interface for AccountStatus message from Streams API (optimized format from backend)
 */
export interface AccountStatusMessage {
  type: 'AccountStatus';
  accountId: string; // Solo número, sin prefijo L#
  equity: number; // Equity que se mapea a balance
  positions: Array<{
    positionId: string;
    pnl: number;
  }>;
  timestamp?: number; // Timestamp de última actualización
}

/**
 * Interface for balance data stored per account
 */
export interface AccountBalanceData {
  accountId: string;
  balance: number;
  currency: string;
  marginAvailable: number;
  equity: number;
  lastUpdated: number;
}

/**
 * Service for managing TradeLocker Streams API connection.
 *
 * This service handles real-time data streaming from TradeLocker using Socket.IO.
 * It connects to the Streams API, subscribes to account updates, and manages
 * real-time balance updates for all user accounts.
 *
 * Features:
 * - Socket.IO connection to Streams API
 * - Automatic token management
 * - Real-time balance updates
 * - Account status monitoring
 * - Automatic reconnection
 * - Balance persistence in AppContextService
 *
 * Relations:
 * - TradeLockerApiService: Gets account tokens
 * - AppContextService: Updates account balances
 * - LoggerService: Logging
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class StreamsService implements OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private logger = inject(LoggerService);
  
  // Socket.IO connection
  private socket: Socket | null = null;
  private isConnected = false;
  private subscriptionAttempted = false;
  private subscriptionTimeout: any = null;
  
  // ============================================
  // ⚙️ CONFIGURACIÓN - VARIABLES DE ENTORNO
  // ============================================
  // 
  // DESARROLLO LOCAL:
  // - Crea un archivo .env en la raíz del proyecto con:
  //   STREAMS_BACKEND_URL=http://localhost:3000
  // - O simplemente no lo definas y usará http://localhost:3000 por defecto
  // 
  // PRODUCCIÓN (Vercel):
  // - Ya está configurado en Vercel Dashboard → Settings → Environment Variables
  // - Variable: STREAMS_BACKEND_URL
  // - Valor: https://tradeswitch-app.onrender.com
  // 
  // El script setup-env.js inyecta esta variable en window.__ENV__ durante el build
  // ============================================
  private readonly STREAMS_API_URL = this.getBackendUrl();
  
  /**
   * Obtiene la URL del backend desde variables de entorno
   */
  private getBackendUrl(): string {
    if (this.isBrowser) {
      // En el navegador, leer desde window.__ENV__ (configurado por Vercel)
      return (window as any)?.__ENV__?.STREAMS_BACKEND_URL || 'http://localhost:3000';
    } else {
      // En el servidor (SSR), leer desde process.env
      return process.env['STREAMS_BACKEND_URL'] || 'http://localhost:3000';
    }
  }
  
  // Ya no se usa en el frontend - el backend agrega este header automáticamente
  // private readonly DEVELOPER_API_KEY = 'tl-7xUz3A0a2aAReLuGnaU%kmaF';
  
  // Account tokens and balances
  private accountTokens: Map<string, AccountTokenData> = new Map();
  private balances: Map<string, AccountBalanceData> = new Map();
  
  // Mapeo de accountId del stream a accountID de AccountData
  private accountIdMapping: Map<string, string> = new Map();
  
  // Observables
  private balancesSubject = new BehaviorSubject<Map<string, AccountBalanceData>>(new Map());
  public balances$ = this.balancesSubject.asObservable();
  
  // Cleanup
  private destroy$ = new Subject<void>();
  
  constructor(
    private tradeLockerApi: TradeLockerApiService,
    private appContext: AppContextService
  ) {
    this.logger.info('StreamsService initialized', 'StreamsService');
    
    // Suscribirse a cambios en las cuentas del usuario para inicializar streams automáticamente
    this.subscribeToUserAccounts();
  }
  
  /**
   * Suscribirse a cambios en las cuentas del usuario desde el contexto
   * Inicializa streams automáticamente cuando hay cuentas disponibles
   */
  private subscribeToUserAccounts(): void {
    // Usar el observable del contexto para detectar cambios en las cuentas
    this.appContext.userAccounts$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(accounts => {
      if (accounts && accounts.length > 0) {
        this.logger.info(`User accounts updated: ${accounts.length} account(s) found`, 'StreamsService');
        // Inicializar streams con todas las cuentas disponibles
        this.initializeStreams(accounts).catch(error => {
          this.logger.error('Error initializing streams from account subscription', 'StreamsService', error);
        });
      } else {
        this.logger.debug('No user accounts available yet, waiting for accounts...', 'StreamsService');
        // Si no hay cuentas, desconectar streams si estaban conectados
        if (this.socket?.connected) {
          this.disconnect();
        }
      }
    });
  }
  
  /**
   * Initialize streams connection for user accounts
   * 
   * This method is called automatically when accounts are available in the context.
   * It fetches tokens for all accounts and connects to the Streams API.
   */
  async initializeStreams(accounts: AccountData[]): Promise<void> {
    if (!this.isBrowser) {
      this.logger.warn('Streams service only works in browser', 'StreamsService');
      return;
    }
    
    if (accounts.length === 0) {
      this.logger.warn('No accounts provided for streams', 'StreamsService');
      return;
    }
    
    // Si ya hay una conexión activa, no reinicializar a menos que las cuentas hayan cambiado
    if (this.socket?.connected) {
      this.logger.debug('Streams already connected, skipping reinitialization', 'StreamsService');
      return;
    }
    
    try {
      // Get tokens for all accounts using the first account's credentials
      // The API returns tokens for all accounts associated with the user
      const firstAccount = accounts[0];
      const credentials: TradeLockerCredentials = {
        email: firstAccount.emailTradingAccount,
        password: firstAccount.brokerPassword,
        server: firstAccount.server
      };
      
      this.logger.info(`Fetching account tokens for ${accounts.length} account(s)`, 'StreamsService');
      const tokenResponse = await firstValueFrom(this.tradeLockerApi.getAccountTokens(credentials));
      
      if (!tokenResponse || !tokenResponse.data || tokenResponse.data.length === 0) {
        this.logger.error('No tokens received from API', 'StreamsService');
        return;
      }
      
      // Store tokens and create mapping for all accounts
      console.log(`🔍 [STREAMS] Procesando ${tokenResponse.data.length} token(s) para ${accounts.length} cuenta(s) de Firebase`);
      console.log(`🔍 [STREAMS] Tokens recibidos:`, tokenResponse.data.map(t => t.accountId));
      console.log(`🔍 [STREAMS] Cuentas en Firebase:`, accounts.map(acc => ({
        accountID: acc.accountID,
        accountNumber: acc.accountNumber,
        accountName: acc.accountName
      })));
      
      tokenResponse.data.forEach(tokenData => {
        this.accountTokens.set(tokenData.accountId, tokenData);
        
        // Mapear accountId del token (ej: "L#821923") al accountID de AccountData (ej: "831962")
        // El accountID en Firebase puede ser solo el número sin el prefijo
        // Extraer el número del accountId del token (quitar "L#", "D#", etc.)
        const tokenAccountNumber = tokenData.accountId.replace(/^[A-Z]#/, '');
        
        console.log(`🔍 [STREAMS] Intentando mapear token ${tokenData.accountId} (número: ${tokenAccountNumber})`);
        
        // Buscar la cuenta correspondiente en la lista de cuentas
        // Intentar múltiples estrategias de coincidencia
        const matchingAccount = accounts.find(acc => {
          // 1. Coincidencia exacta
          if (acc.accountID === tokenData.accountId) {
            console.log(`   ✅ Coincidencia exacta: ${acc.accountID} === ${tokenData.accountId}`);
            return true;
          }
          
          // 2. El accountID de Firebase es el número sin prefijo
          if (acc.accountID === tokenAccountNumber) {
            console.log(`   ✅ Coincidencia por número: ${acc.accountID} === ${tokenAccountNumber}`);
            return true;
          }
          
          // 3. El accountID de Firebase contiene el número del token
          if (acc.accountID?.includes(tokenAccountNumber)) {
            console.log(`   ✅ Coincidencia por inclusión: ${acc.accountID} incluye ${tokenAccountNumber}`);
            return true;
          }
          
          // 4. El token contiene el accountID de Firebase
          if (tokenAccountNumber.includes(acc.accountID || '')) {
            console.log(`   ✅ Coincidencia por inclusión inversa: ${tokenAccountNumber} incluye ${acc.accountID}`);
            return true;
          }
          
          // 5. Comparar accountNumber si existe
          if (acc.accountNumber && acc.accountNumber.toString() === tokenAccountNumber) {
            console.log(`   ✅ Coincidencia por accountNumber: ${acc.accountNumber} === ${tokenAccountNumber}`);
            return true;
          }
          
          return false;
        });
        
        if (matchingAccount) {
          // Mapear accountId del stream -> accountID de AccountData
          this.accountIdMapping.set(tokenData.accountId, matchingAccount.accountID);
          console.log('🔗 [STREAMS] Mapeo creado:', {
            streamAccountId: tokenData.accountId,
            tokenAccountNumber,
            accountDataId: matchingAccount.accountID,
            accountNumber: matchingAccount.accountNumber
          });
          this.logger.debug('Account ID mapping created', 'StreamsService', {
            streamAccountId: tokenData.accountId,
            accountDataId: matchingAccount.accountID
          });
        } else {
          console.warn('⚠️ [STREAMS] No se encontró cuenta para mapear:', {
            tokenAccountId: tokenData.accountId,
            tokenAccountNumber,
            availableAccounts: accounts.map(acc => ({
              accountID: acc.accountID,
              accountNumber: acc.accountNumber,
              accountName: acc.accountName
            }))
          });
          this.logger.warn('Account not found for mapping', 'StreamsService', {
            tokenAccountId: tokenData.accountId,
            tokenAccountNumber,
            availableAccountsCount: accounts.length
          });
        }
      });
      
      this.logger.info(`Received ${tokenResponse.data.length} account token(s) for ${accounts.length} Firebase account(s)`, 'StreamsService');
      
      // Connect to Streams API
      this.connectToStreams();
      
    } catch (error) {
      this.logger.error('Error initializing streams', 'StreamsService', error);
    }
  }
  
  /**
   * Connect to Streams API using Socket.IO via backend
   * 
   * El backend agrega los headers necesarios (developer-api-key) que el navegador
   * no puede enviar por restricciones de CORS. El frontend solo se conecta al backend.
   */
  private connectToStreams(): void {
    if (this.socket?.connected) {
      this.logger.warn('Socket already connected', 'StreamsService');
      return;
    }
    
    console.log('🚀 [STREAMS] Conectando a backend');
    console.log('🚀 [STREAMS] URL:', this.STREAMS_API_URL);
    
    this.logger.info('Connecting to Streams API via backend', 'StreamsService');
    
    // Conectar al backend (el backend agrega los headers automáticamente)
    this.socket = io(this.STREAMS_API_URL, {
      path: '/socket.io', // El backend usa /socket.io como path
      transports: ['polling', 'websocket'], // Permitir ambos transports
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000
      // No usar extraHeaders - el backend los agrega automáticamente
    });
    
    console.log('🔧 [STREAMS] Configuración Socket.IO (vía backend):', {
      url: this.STREAMS_API_URL,
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      note: 'El backend agrega el header developer-api-key automáticamente'
    });
    
    // Connection events
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.subscriptionAttempted = false;
      
      const transport = (this.socket as any)?.io?.engine?.transport?.name;
      console.log('✅ [STREAMS] Socket conectado exitosamente');
      console.log('✅ [STREAMS] Socket ID:', this.socket?.id);
      console.log('✅ [STREAMS] Connected:', this.socket?.connected);
      console.log('✅ [STREAMS] Transport:', transport);
      console.log('✅ [STREAMS] Transport type:', typeof transport);
      
      this.logger.info('Connected to Streams API', 'StreamsService', { 
        socketId: this.socket?.id,
        connected: this.socket?.connected,
        transport: transport
      });
      
      // Subscribe after connection (same delay as working JavaScript version)
      this.subscriptionTimeout = setTimeout(() => {
        if (this.socket?.connected && this.isConnected && !this.subscriptionAttempted) {
          console.log('📤 [STREAMS] Intentando suscribirse después del delay de 1000ms...');
          this.subscribeToAccounts();
        } else {
          console.warn('⚠️ [STREAMS] No se puede suscribir - socket desconectado o ya se intentó', {
            connected: this.socket?.connected,
            isConnected: this.isConnected,
            subscriptionAttempted: this.subscriptionAttempted
          });
        }
      }, 1000);
    });
    
    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      
      console.log('❌ [STREAMS] Socket desconectado');
      console.log('❌ [STREAMS] Razón:', reason);
      console.log('❌ [STREAMS] Tipo de razón:', typeof reason);
      console.log('❌ [STREAMS] Subscription attempted:', this.subscriptionAttempted);
      console.log('❌ [STREAMS] Socket ID antes de desconectar:', this.socket?.id);
      console.log('❌ [STREAMS] Timestamp:', new Date().toISOString());
      
      this.logger.warn('Disconnected from Streams API', 'StreamsService', { reason });
      
      // Clear subscription timeout if socket disconnects
      if (this.subscriptionTimeout) {
        clearTimeout(this.subscriptionTimeout);
        this.subscriptionTimeout = null;
      }
    });
    
    this.socket.on('connect_error', (error: any) => {
      console.error('❌ [STREAMS] Error de conexión:', error);
      console.error('❌ [STREAMS] Tipo de error:', error?.type);
      console.error('❌ [STREAMS] Mensaje:', error?.message);
      console.error('❌ [STREAMS] Descripción:', error?.description);
      console.error('❌ [STREAMS] Error completo:', JSON.stringify(error, null, 2));
      
      this.logger.error('Connection error', 'StreamsService', { 
        message: error.message,
        type: error.type,
        description: error.description,
        error: error
      });
    });
    
    // Stream events (same as JavaScript version)
    this.socket.on('connection', (message) => {
      console.log('🔌 [STREAMS] Evento connection recibido:', JSON.stringify(message, null, 2));
      this.logger.debug('Connection event received', 'StreamsService', message);
    });
    
    this.socket.on('exception', (message) => {
      console.error('⚠️ [STREAMS] Exception recibida:', JSON.stringify(message, null, 2));
      this.logger.error('Exception received', 'StreamsService', message);
    });
    
    this.socket.on('subscriptions', (message) => {
      console.log('📥 [STREAMS] Evento subscriptions recibido:', JSON.stringify(message, null, 2));
      this.logger.debug('Subscriptions event received', 'StreamsService', message);
    });
    
    this.socket.on('stream', (message: any) => {
      // IMPORTANTE: Imprimir TODOS los tipos de mensajes en consola
      if (message?.type) {
        switch (message.type) {
          case 'AccountStatus':
            console.log(`📊 [STREAMS] AccountStatus recibido:`, {
              accountId: message.accountId,
              equity: message.equity,
              positions: message.positions?.length || 0
            });
            break;
          case 'Position':
            console.log(`📍 [STREAMS] Position recibido:`, message);
            break;
          case 'ClosePosition':
            console.log(`🔒 [STREAMS] ClosePosition recibido:`, message);
            break;
          case 'OpenOrder':
            console.log(`📋 [STREAMS] OpenOrder recibido:`, message);
            break;
          case 'Property':
            console.log(`🔔 [STREAMS] Property recibido:`, message);
            break;
          default:
            console.log(`📨 [STREAMS] Mensaje tipo ${message.type} recibido:`, message);
        }
      }
      this.handleStreamMessage(message);
    });
    
    // Escuchar eventos importantes para debug (reducido)
    // this.socket.onAny((eventName, ...args) => {
    //   console.log(`🔔 [STREAMS] Evento recibido: ${eventName}`, args);
    //   console.log(`🔔 [STREAMS] Args tipo:`, args.map(arg => typeof arg));
    // });
  }
  
  /**
   * Subscribe to all accounts
   * 
   * Same implementation as JavaScript version (subscribeToAccount function).
   * Sends subscription message with action 'SUBSCRIBE' and token to 'subscriptions' event.
   */
  private subscribeToAccounts(): void {
    // Mark that we've attempted subscription
    this.subscriptionAttempted = true;
    
    // Verify socket is still connected before proceeding (same as JavaScript version)
    if (!this.socket?.connected || !this.isConnected) {
      this.logger.error('Socket not connected, cannot subscribe', 'StreamsService', {
        socketExists: !!this.socket,
        socketConnected: this.socket?.connected,
        isConnected: this.isConnected
      });
      // Let Socket.IO handle reconnection automatically
      return;
    }
    
    // Get first token (same as JavaScript version)
    const firstToken = Array.from(this.accountTokens.values())[0];

    if (!firstToken || !firstToken.accessToken) {
      this.logger.error('No token available for subscription', 'StreamsService');
      this.disconnect();
      return;
    }
    
    const subscribeMessage = {
      action: 'SUBSCRIBE',
      token: firstToken.accessToken
    };
    
    // Log del mensaje que se envía
    console.log('📤 [STREAMS] Mensaje de suscripción a enviar:', JSON.stringify(subscribeMessage, null, 2));
    console.log('📤 [STREAMS] Token (primeros 100 chars):', firstToken.accessToken.substring(0, 100) + '...');
    console.log('📤 [STREAMS] Account ID:', firstToken.accountId);
    
    this.logger.info('Subscribing to account', 'StreamsService', { accountId: firstToken.accountId });
    
    // Generar un ID único para esta suscripción
    const subscriptionId = `${this.socket?.id}-${Date.now()}`;
    let ackReceived = false;
    
    // Escuchar el evento de respaldo 'subscription-response' por si el ACK no funciona
    const subscriptionResponseHandler = (data: any) => {
      if (data.subscriptionId === subscriptionId && !ackReceived) {
        ackReceived = true;
        this.socket?.off('subscription-response', subscriptionResponseHandler);
        
        if (data.error) {
          console.error('❌ [STREAMS] Error en suscripción (evento):', data.error);
          this.logger.error('Subscription error (event)', 'StreamsService', { error: data.error });
          this.disconnect();
        } else if (data.response) {
          this.handleSubscriptionResponse(data.response);
        }
      }
    };
    
    this.socket?.on('subscription-response', subscriptionResponseHandler);
    
    // Intentar con ACK primero (método preferido)
    this.socket.timeout(20000).emit('subscriptions', subscribeMessage, (err: any, response: any) => {
      if (ackReceived) {
        return; // Ya se manejó con el evento
      }
      
      ackReceived = true;
      this.socket?.off('subscription-response', subscriptionResponseHandler);
      
      if (err) {
        console.error('❌ [STREAMS] Error en suscripción:', err);
        console.error('❌ [STREAMS] Tipo de error:', err?.type || 'unknown');
        console.error('❌ [STREAMS] Mensaje de error:', err?.message || 'No message');
        
        this.logger.error('Subscription timeout/error', 'StreamsService', {
          error: err,
          message: 'No ACK response received after 20 seconds. Possible issues: server not responding, invalid/expired JWT token, connectivity problem, or incorrect message format.'
        });
        // Disconnect from stream if subscription fails
        this.disconnect();
        return;
      }
      
      // Log de la respuesta recibida
      console.log('📥 [STREAMS] Respuesta de suscripción recibida (ACK):', JSON.stringify(response, null, 2));
      
      this.handleSubscriptionResponse(response);
    });
  }
  
  /**
   * Maneja la respuesta de suscripción (compartido entre ACK y evento)
   */
  private handleSubscriptionResponse(response: any): void {
    this.logger.info('Subscription response received', 'StreamsService', response);
    
    // Si la respuesta es null o undefined, el backend ya creó una respuesta por defecto
    // pero por si acaso, manejamos este caso también
    if (response === null || response === undefined) {
      console.warn('⚠️ [STREAMS] Respuesta null/undefined, pero asumiendo éxito (backend maneja esto)');
      // El backend ya creó una respuesta por defecto, así que asumimos éxito
      console.log('✅ [STREAMS] Suscripción asumida exitosa (respuesta null manejada por backend)');
      this.logger.info('Subscription assumed successful (null response handled by backend)', 'StreamsService');
      return;
    }
    
    if (response && response.status === 'ok') {
      console.log('✅ [STREAMS] Suscripción exitosa!');
      console.log('✅ [STREAMS] Solicitudes restantes:', response.remainingRequests);
      
      this.logger.info('Successfully subscribed to streams', 'StreamsService', {
        remainingRequests: response.remainingRequests
      });
      // Subscription successful - no need to reset counters (Socket.IO handles reconnection)
    } else {
      console.error('❌ [STREAMS] Error en suscripción - respuesta:', response);
      console.error('❌ [STREAMS] Mensaje:', response?.message);
      console.error('❌ [STREAMS] Código:', response?.code);
      
      this.logger.error('Subscription failed', 'StreamsService', {
        response,
        message: response?.message,
        code: response?.code
      });
      // Disconnect from stream if subscription failed
      this.disconnect();
    }
  }
  
  /**
   * Handle stream messages
   */
  private handleStreamMessage(message: any): void {
    if (!message || !message.type) {
      console.warn('⚠️ [STREAMS] Mensaje sin tipo, ignorando:', message);
      return;
    }
    
    // Log todos los mensajes recibidos (ya se hace en el listener, pero también aquí para consistencia)
    this.logger.debug('Stream message received', 'StreamsService', { type: message.type, accountId: message.accountId });
    
    // Handle AccountStatus messages
    if (message.type === 'AccountStatus') {
      this.handleAccountStatus(message as AccountStatusMessage);
    } else {
      // Otros tipos de mensajes (Position, ClosePosition, OpenOrder, Property)
      // Ya se imprimen en consola en el listener, aquí solo los registramos en el logger
      this.logger.debug(`Message type ${message.type} received (not processed)`, 'StreamsService', message);
    }
  }
  
  /**
   * Handle AccountStatus message and update balance
   * El mensaje ahora viene optimizado del backend con solo los datos necesarios
   */
  private handleAccountStatus(message: AccountStatusMessage): void {
    const accountId = message.accountId; // Ya viene sin prefijo L#
    const equity = message.equity || 0; // Equity se mapea a balance
    const positions = message.positions || [];
    
    // El backend ya envía accountId sin prefijo, pero necesitamos el formato completo para el mapeo
    // Buscar el accountId completo en el mapeo
    const fullAccountId = Array.from(this.accountIdMapping.keys()).find(
      key => key.replace(/^[A-Z]#/, '') === accountId
    ) || `L#${accountId}`;
    
    // Update balance data (usar equity como balance)
    const balanceData: AccountBalanceData = {
      accountId: fullAccountId, // Guardar con prefijo para consistencia
      balance: equity, // Equity se usa como balance
      currency: 'USD', // Por defecto, el backend no envía currency
      marginAvailable: 0, // El backend no envía esto en el formato optimizado
      equity: equity,
      lastUpdated: message.timestamp || Date.now()
    };
    
    this.balances.set(fullAccountId, balanceData);
    this.balancesSubject.next(new Map(this.balances));
    
    // Update AppContextService usando equity como balance
    this.updateAccountBalanceInContext(fullAccountId, equity);
    
    this.logger.debug('Balance updated', 'StreamsService', {
      accountId,
      equity,
      positionsCount: positions.length
    });
  }
  
  /**
   * Update account balance in AppContextService
   */
  private updateAccountBalanceInContext(streamAccountId: string, balance: number): void {
    // Obtener el accountID real de AccountData usando el mapeo
    const accountDataId = this.accountIdMapping.get(streamAccountId) || streamAccountId;
    
    // Actualizar el balance en el contexto usando el método específico
    this.appContext.updateAccountBalance(accountDataId, balance);
    
    // También actualizar las cuentas directamente
    const accounts = this.appContext.userAccounts();
    
    // Intentar múltiples estrategias para encontrar la cuenta
    const streamNumber = streamAccountId.replace(/^[A-Z]#/, '');
    const accountIndex = accounts.findIndex(acc => {
      // 1. Coincidencia exacta con accountID
      if (acc.accountID === accountDataId) return true;
      if (acc.accountID === streamAccountId) return true;
      
      // 2. Coincidencia con id
      if (acc.id === accountDataId) return true;
      if (acc.id === streamAccountId) return true;
      
      // 3. Extraer número del streamAccountId y comparar con accountID
      if (acc.accountID === streamNumber) return true;
      
      // 4. Comparar con accountNumber
      if (acc.accountNumber && acc.accountNumber.toString() === streamNumber) return true;
      
      // 5. Comparar accountID con el número del stream (sin prefijo)
      if (acc.accountID && acc.accountID.toString() === streamNumber) return true;
      
      return false;
    });
    
    if (accountIndex !== -1) {
      const updatedAccounts = [...accounts];
      updatedAccounts[accountIndex] = {
        ...updatedAccounts[accountIndex],
        balance
      };
      this.appContext.setUserAccounts(updatedAccounts);
      
      this.logger.debug('Account balance updated in context', 'StreamsService', {
        streamAccountId,
        accountDataId: updatedAccounts[accountIndex].accountID,
        balance
      });
    } else {
      this.logger.warn('Account not found for balance update', 'StreamsService', {
        streamAccountId,
        accountDataId,
        streamNumber
      });
      
      // Intentar actualizar usando diferentes estrategias como fallback
      // 1. Intentar con el accountDataId del mapeo
      if (accountDataId && accountDataId !== streamAccountId) {
        this.appContext.updateAccountBalance(accountDataId, balance);
      }
      
      // 2. Intentar con el número sin prefijo
      if (streamNumber && streamNumber !== streamAccountId) {
        this.appContext.updateAccountBalance(streamNumber, balance);
      }
      
      // 3. Intentar con el streamAccountId completo como último recurso
      this.appContext.updateAccountBalance(streamAccountId, balance);
    }
    
    // Also update report balance data if it's the current account
    const reportData = this.appContext.reportData();
    if (reportData.balanceData) {
      const updatedBalanceData = {
        ...reportData.balanceData,
        balance
      };
      this.appContext.updateReportBalance(updatedBalanceData);
    }
  }
  
  /**
   * Get balance for a specific account
   */
  getBalance(accountId: string): number {
    const balanceData = this.balances.get(accountId);
    return balanceData?.balance || 0;
  }
  
  /**
   * Get balance observable for a specific account
   */
  getBalance$(accountId: string): Observable<number> {
    return this.balances$.pipe(
      map(balances => balances.get(accountId)?.balance || 0),
      takeUntil(this.destroy$)
    );
  }
  
  /**
   * Disconnect from streams
   */
  disconnect(): void {
    // Clear subscription timeout
    if (this.subscriptionTimeout) {
      clearTimeout(this.subscriptionTimeout);
      this.subscriptionTimeout = null;
    }
    
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.subscriptionAttempted = false;
      this.logger.info('Disconnected from Streams API', 'StreamsService');
    }
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnect();
  }
}
