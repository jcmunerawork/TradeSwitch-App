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
 * Interface for AccountStatus message from Streams API
 */
export interface AccountStatusMessage {
  type: 'AccountStatus';
  accountId: string;
  currency: string;
  balance: string;
  marginAvailable: string;
  equity: string;
  positionPnLs: any[];
  brandId: string;
  userId: string;
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
  // 🔴 IMPORTANTE: Configura esta variable en Vercel:
  // 
  // Variable: STREAMS_BACKEND_URL
  // Valor: URL de tu backend en Render (ej: https://tradeswitch-ws.onrender.com)
  // 
  // En desarrollo local: http://localhost:3000
  // En producción: URL que te da Render después del deploy
  // 
  // Cómo configurar en Vercel:
  // 1. Ve a tu proyecto en Vercel Dashboard
  // 2. Settings → Environment Variables
  // 3. Agrega: STREAMS_BACKEND_URL = https://tu-backend.onrender.com
  // 4. Redeploy la aplicación
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
      tokenResponse.data.forEach(tokenData => {
        this.accountTokens.set(tokenData.accountId, tokenData);
        
        // Mapear accountId del token (ej: "L#821923") al accountID de AccountData (ej: "831962")
        // El accountID en Firebase puede ser solo el número sin el prefijo
        // Extraer el número del accountId del token (quitar "L#", "D#", etc.)
        const tokenAccountNumber = tokenData.accountId.replace(/^[A-Z]#/, '');
        
        // Buscar la cuenta correspondiente en la lista de cuentas
        // Intentar múltiples estrategias de coincidencia
        const matchingAccount = accounts.find(acc => {
          // 1. Coincidencia exacta
          if (acc.accountID === tokenData.accountId) return true;
          
          // 2. El accountID de Firebase es el número sin prefijo
          if (acc.accountID === tokenAccountNumber) return true;
          
          // 3. El accountID de Firebase contiene el número del token
          if (acc.accountID?.includes(tokenAccountNumber)) return true;
          
          // 4. El token contiene el accountID de Firebase
          if (tokenAccountNumber.includes(acc.accountID || '')) return true;
          
          // 5. Comparar accountNumber si existe
          if (acc.accountNumber && acc.accountNumber.toString() === tokenAccountNumber) return true;
          
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
   * Connect to Streams API using Socket.IO via backend proxy
   * 
   * El backend proxy agrega los headers necesarios (developer-api-key) que el navegador
   * no puede enviar por restricciones de CORS. El frontend solo se conecta al backend.
   */
  private connectToStreams(): void {
    if (this.socket?.connected) {
      this.logger.warn('Socket already connected', 'StreamsService');
      return;
    }
    
    console.log('🚀 [STREAMS] Conectando a backend proxy');
    console.log('🚀 [STREAMS] URL:', this.STREAMS_API_URL);
    
    this.logger.info('Connecting to Streams API via backend proxy', 'StreamsService');
    
    // Conectar al backend proxy (el backend agrega los headers automáticamente)
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
    
    console.log('🔧 [STREAMS] Configuración Socket.IO (vía backend proxy):', {
      url: this.STREAMS_API_URL,
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      note: 'El backend proxy agrega el header developer-api-key automáticamente'
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
      console.log('📡 [STREAMS] Evento stream recibido (raw):', message);
      this.handleStreamMessage(message);
    });
    
    // Escuchar todos los eventos para debug
    this.socket.onAny((eventName, ...args) => {
      console.log(`🔔 [STREAMS] Evento recibido: ${eventName}`, args);
      console.log(`🔔 [STREAMS] Args tipo:`, args.map(arg => typeof arg));
    });
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
    
    // Same as JavaScript: socket.timeout(20000).emit('subscriptions', subscribeMessage, callback)
    this.socket.timeout(20000).emit('subscriptions', subscribeMessage, (err: any, response: any) => {
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
      console.log('📥 [STREAMS] Respuesta de suscripción recibida:', JSON.stringify(response, null, 2));
      
      this.logger.info('Subscription response received', 'StreamsService', response);
      
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
    });
  }
  
  /**
   * Handle stream messages
   */
  private handleStreamMessage(message: any): void {
    // Log todos los mensajes recibidos del stream
    console.log('📡 [STREAMS] Mensaje recibido del stream:', JSON.stringify(message, null, 2));
    console.log('📡 [STREAMS] Tipo de mensaje:', message?.type);
    console.log('📡 [STREAMS] Timestamp:', new Date().toISOString());
    
    this.logger.debug('Stream message received', 'StreamsService', message);
    
    if (!message || !message.type) {
      console.warn('⚠️ [STREAMS] Mensaje sin tipo, ignorando:', message);
      return;
    }
    
    // Handle AccountStatus messages
    if (message.type === 'AccountStatus') {
      console.log('💰 [STREAMS] Procesando AccountStatus...');
      this.handleAccountStatus(message as AccountStatusMessage);
    } else {
      console.log(`ℹ️ [STREAMS] Tipo de mensaje no manejado: ${message.type}`);
    }
  }
  
  /**
   * Handle AccountStatus message and update balance
   */
  private handleAccountStatus(message: AccountStatusMessage): void {
    console.log('💰 [STREAMS] AccountStatus completo:', JSON.stringify(message, null, 2));
    
    const accountId = message.accountId;
    const balance = parseFloat(message.balance) || 0;
    const marginAvailable = parseFloat(message.marginAvailable) || 0;
    const equity = parseFloat(message.equity) || 0;
    
    console.log('💰 [STREAMS] Datos extraídos:', {
      accountId,
      balance,
      marginAvailable,
      equity,
      currency: message.currency
    });
    
    // Update balance data
    const balanceData: AccountBalanceData = {
      accountId,
      balance,
      currency: message.currency,
      marginAvailable,
      equity,
      lastUpdated: Date.now()
    };
    
    this.balances.set(accountId, balanceData);
    this.balancesSubject.next(new Map(this.balances));
    
    console.log('💰 [STREAMS] Balance almacenado:', balanceData);
    
    // Update AppContextService
    this.updateAccountBalanceInContext(accountId, balance);
    
    this.logger.debug('Balance updated', 'StreamsService', {
      accountId,
      balance,
      currency: message.currency
    });
  }
  
  /**
   * Update account balance in AppContextService
   */
  private updateAccountBalanceInContext(streamAccountId: string, balance: number): void {
    console.log('🔄 [STREAMS] Actualizando balance en contexto:', {
      streamAccountId,
      balance,
      mapping: Array.from(this.accountIdMapping.entries())
    });
    
    // Obtener el accountID real de AccountData usando el mapeo
    const accountDataId = this.accountIdMapping.get(streamAccountId) || streamAccountId;
    
    console.log('🔄 [STREAMS] AccountID a usar:', accountDataId);
    
    // Actualizar el balance en el contexto usando el método específico
    this.appContext.updateAccountBalance(accountDataId, balance);
    
    // También actualizar las cuentas directamente
    const accounts = this.appContext.userAccounts();
    console.log('🔄 [STREAMS] Cuentas disponibles:', accounts.map(acc => ({
      accountID: acc.accountID,
      accountNumber: acc.accountNumber,
      id: acc.id
    })));
    
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
      
      console.log('✅ [STREAMS] Balance actualizado en cuenta:', {
        streamAccountId,
        accountDataId: updatedAccounts[accountIndex].accountID,
        balance,
        accountName: updatedAccounts[accountIndex].accountName
      });
      
      this.logger.debug('Account balance updated in context', 'StreamsService', {
        streamAccountId,
        accountDataId: updatedAccounts[accountIndex].accountID,
        balance
      });
    } else {
      console.error('❌ [STREAMS] No se encontró cuenta para actualizar balance:', {
        streamAccountId,
        accountDataId,
        availableAccounts: accounts.map(acc => ({
          accountID: acc.accountID,
          accountNumber: acc.accountNumber,
          id: acc.id,
          accountName: acc.accountName
        }))
      });
      
      this.logger.warn('Account not found for balance update', 'StreamsService', {
        streamAccountId,
        accountDataId,
        streamNumber,
        availableAccounts: accounts.map(acc => ({
          accountID: acc.accountID,
          accountNumber: acc.accountNumber,
          id: acc.id
        }))
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
