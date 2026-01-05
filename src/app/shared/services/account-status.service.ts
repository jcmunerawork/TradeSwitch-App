import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AppContextService } from '../context';
import { AccountData } from '../../features/auth/models/userModel';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ConfigService } from '../../core/services/config.service';
import {
  AccountMetricsEvent,
  PositionClosedEvent,
  StrategyFollowedUpdateEvent,
  SubscriptionUpdatedEvent
} from './metrics-events.interface';

/**
 * Interface for AccountStatus data from Streams API
 * This matches the format received from the backend
 */
export interface AccountStatus {
  type: 'AccountStatus';
  accountId: string;
  currency: string;
  marginAvailable: string;
  marginUsed: string;
  equity: string;
  positionPnLs?: Array<{
    positionId: string;
    pnl: string;
  }>;
  brandId: string;
  userId: string;
}

/**
 * Service for receiving and processing AccountStatus updates from the backend via WebSocket.
 * 
 * The backend receives AccountStatus data from TradeLocker Streams API and forwards
 * it to the frontend through Socket.IO. This service connects to the backend WebSocket
 * and listens for AccountStatus updates, then updates account balances in real-time.
 * 
 * Features:
 * - Connects to backend WebSocket using Socket.IO
 * - Sends user accounts to backend on connection
 * - Listens for 'stream' events containing AccountStatus
 * - Updates account balances in AppContextService automatically
 * - Handles connection status and errors
 * 
 * Relations:
 * - AppContextService: Updates account balances
 * - AuthService: Provides user authentication state
 */
@Injectable({
  providedIn: 'root'
})
export class AccountStatusService implements OnDestroy {
  private socket: Socket | null = null;
  private socketEventHandlers: Map<string, (...args: any[]) => void> = new Map();
  private accountStatusSubject = new BehaviorSubject<Map<string, AccountStatus>>(new Map());
  public accountStatus$: Observable<Map<string, AccountStatus>> = this.accountStatusSubject.asObservable();
  
  // Propiedades para reconexión y reenvío de cuentas
  private currentUserId: string | null = null;
  private currentAccounts: AccountData[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // Máximo de intentos de reconexión
  private reconnectDelay = 1000; // Delay inicial en ms
  private reconnectTimer: any = null;
  private lastStreamDataTime: number = 0; // Timestamp del último dato recibido
  private streamDataCheckInterval: any = null; // Intervalo para verificar si llegan datos
  private streamDataCheckDelay = 30000; // Verificar cada 30 segundos si no llegan datos
  private backendStreamsConnected: boolean = false; // Estado de conexión del backend con streams API
  private lastBalanceUpdate: Map<string, number> = new Map(); // Timestamp del último balance recibido por cuenta

  // Subjects for metrics events
  private accountMetricsSubject = new Subject<AccountMetricsEvent>();
  public accountMetrics$: Observable<AccountMetricsEvent> = this.accountMetricsSubject.asObservable();

  private positionClosedSubject = new Subject<PositionClosedEvent>();
  public positionClosed$: Observable<PositionClosedEvent> = this.positionClosedSubject.asObservable();

  private strategyFollowedUpdateSubject = new Subject<StrategyFollowedUpdateEvent>();
  public strategyFollowedUpdate$: Observable<StrategyFollowedUpdateEvent> = this.strategyFollowedUpdateSubject.asObservable();

  // Subject para trades del calendario en tiempo real
  private calendarTradeSubject = new Subject<{ accountId: string; trade: any }>();
  public calendarTrade$: Observable<{ accountId: string; trade: any }> = this.calendarTradeSubject.asObservable();

  // Subject para actualizaciones de suscripción
  private subscriptionUpdatedSubject = new Subject<SubscriptionUpdatedEvent>();
  public subscriptionUpdated$: Observable<SubscriptionUpdatedEvent> = this.subscriptionUpdatedSubject.asObservable();

  constructor(
    private appContext: AppContextService,
    private configService: ConfigService
  ) {}

  /**
   * Connect to backend WebSocket and start listening for AccountStatus updates
   * 
   * @param userId - Current user ID (required for backend to filter messages)
   * @param accounts - User's trading accounts (sent to backend on connection)
   */
  connect(userId: string, accounts: AccountData[]): void {
    // Don't connect if already connected
    if (this.socket?.connected) {
      console.warn('🔔 AccountStatusService: Already connected to WebSocket');
      return;
    }

    // Don't connect if no userId
    if (!userId) {
      console.warn('🔔 AccountStatusService: Cannot connect without userId');
      return;
    }

    console.log('🔔 AccountStatusService: Connecting to WebSocket...');

    // Get backend URL from config (remove /api suffix if present for WebSocket)
    const apiUrl = this.configService.apiUrl;
    const backendUrl = apiUrl.replace(/\/api\/?$/, '');

    // Guardar userId y accounts para reconexión
    this.currentUserId = userId;
    this.currentAccounts = accounts || [];
    
    // Connect to WebSocket with userId in query y opciones de reconexión
    this.socket = io(backendUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true, // Habilitar reconexión automática
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 20000,
      query: {
        userId: userId, // IMPORTANTE: Pasar userId en el handshake
      },
    });

    // Helper para registrar handlers y guardarlos para limpieza
    const registerHandler = (event: string, handler: (...args: any[]) => void) => {
      this.socket?.on(event, handler);
      this.socketEventHandlers.set(event, handler);
    };

    // Listen for connection
    registerHandler('connect', () => {
      console.log('✅ AccountStatusService: Connected to backend WebSocket');
      
      // Resetear contador de reconexiones al conectar exitosamente
      this.reconnectAttempts = 0;
      
      // Cancelar timer de reconexión manual si existe
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      // Send user accounts to backend after connection
      if (this.socket?.connected && this.currentAccounts && this.currentAccounts.length > 0) {
        try {
          this.socket.emit('updateAccounts', { accounts: this.currentAccounts });
          console.log(`📤 AccountStatusService: Sent ${this.currentAccounts.length} accounts to backend`);
          
          // Actualizar timestamp de último dato recibido
          this.lastStreamDataTime = Date.now();
          
          // Iniciar verificación de datos de streams
          this.startStreamDataCheck();
        } catch (error) {
          console.error('❌ AccountStatusService: Error sending accounts:', error);
        }
      } else {
        console.warn('⚠️ AccountStatusService: No accounts to send to backend or socket not connected');
      }
    });

    // Listen for 'stream' event where AccountStatus arrives
    registerHandler('stream', (message: any) => {
      // Actualizar timestamp cuando llegan datos
      this.lastStreamDataTime = Date.now();
      this.handleStreamMessage(message);
    });

    // Listen for account metrics updates
    registerHandler('accountMetrics', (data: AccountMetricsEvent) => {
      // Actualizar timestamp cuando llegan datos
      this.lastStreamDataTime = Date.now();
      this.handleAccountMetrics(data);
    });

    // Listen for position closed events
    registerHandler('positionClosed', (data: PositionClosedEvent) => {
      // Actualizar timestamp cuando llegan datos
      this.lastStreamDataTime = Date.now();
      this.handlePositionClosed(data);
    });

    // Listen for strategy followed updates
    registerHandler('strategyFollowedUpdate', (data: StrategyFollowedUpdateEvent) => {
      // Actualizar timestamp cuando llegan datos
      this.lastStreamDataTime = Date.now();
      this.handleStrategyFollowedUpdate(data);
    });

    // Listen for subscription updates
    registerHandler('subscription:updated', (data: SubscriptionUpdatedEvent) => {
      // Actualizar timestamp cuando llegan datos
      this.lastStreamDataTime = Date.now();
      this.handleSubscriptionUpdated(data);
    });

    // Listen for connection status updates
    registerHandler('streamsConnectionStatus', (status: any) => {
      console.log('📡 AccountStatusService: Streams connection status:', status);
      
      // Actualizar estado de conexión del backend con streams
      if (status && typeof status.connected === 'boolean') {
        this.backendStreamsConnected = status.connected;
        
        if (!status.connected) {
          console.warn('⚠️ AccountStatusService: Backend desconectado de Streams API, solicitando reconexión...');
          // Solicitar reconexión al backend
          this.requestStreamsReconnection();
        } else {
          console.log('✅ AccountStatusService: Backend conectado a Streams API');
          // Si se reconecta, reenviar cuentas
          if (this.currentAccounts && this.currentAccounts.length > 0) {
            setTimeout(() => {
              this.updateAccounts(this.currentAccounts);
            }, 1000);
          }
        }
      }
    });

    // Listen for exceptions
    registerHandler('exception', (error: any) => {
      console.error('❌ AccountStatusService: Streams exception:', error);
    });

    // Listen for disconnection
    registerHandler('disconnect', (reason: string) => {
      console.warn('⚠️ AccountStatusService: Disconnected from WebSocket:', reason);
      
      // Detener verificación de datos
      this.stopStreamDataCheck();
      
      // Si no es una desconexión intencional, intentar reconectar
      if (reason !== 'io client disconnect' && this.currentUserId) {
        this.scheduleReconnect();
      }
    });

    // Listen for connection errors
    registerHandler('connect_error', (error: any) => {
      console.error('❌ AccountStatusService: WebSocket connection error:', error);
      
      // Intentar reconectar después de un delay
      if (this.currentUserId) {
        this.scheduleReconnect();
      }
    });
    
    // Listen for reconnection attempts
    registerHandler('reconnect_attempt', (attemptNumber: number) => {
      console.log(`🔄 AccountStatusService: Reconnection attempt ${attemptNumber}/${this.maxReconnectAttempts}`);
      this.reconnectAttempts = attemptNumber;
    });
    
    // Listen for reconnection success
    registerHandler('reconnect', (attemptNumber: number) => {
      console.log(`✅ AccountStatusService: Reconnected after ${attemptNumber} attempts`);
      this.reconnectAttempts = 0;
    });
    
    // Listen for reconnection failed
    registerHandler('reconnect_failed', () => {
      console.error('❌ AccountStatusService: Reconnection failed after all attempts');
      // Intentar reconexión manual después de un delay más largo
      if (this.currentUserId) {
        this.scheduleReconnect();
      }
    });
  }

  /**
   * Handle stream messages from backend
   * Processes AccountStatus and other message types
   */
  private handleStreamMessage(message: any): void {
    if (!message) {
      return;
    }

    // Process AccountStatus messages
    // The backend sends AccountStatus through the 'stream' event
    if (message?.type === 'AccountStatus') {
      this.processAccountStatus(message);
    }
    
    // You can handle other message types here:
    // if (message.type === 'Position') {
    //   this.handlePositionOpened(message);
    // }
    
    // if (message.type === 'ClosePosition') {
    //   this.handlePositionClosed(message);
    // }
  }

  /**
   * Process an AccountStatus update received from the backend
   */
  private processAccountStatus(accountStatus: AccountStatus): void {
    try {
      // Validate the account status data
      if (!accountStatus || accountStatus.type !== 'AccountStatus') {
        console.warn('⚠️ AccountStatusService: Invalid AccountStatus data received:', accountStatus);
        return;
      }

      if (!accountStatus.accountId || !accountStatus.equity) {
        console.warn('⚠️ AccountStatusService: AccountStatus missing required fields:', accountStatus);
        return;
      }

      // Normalize accountId: remove "D#" prefix if present
      const normalizedAccountId = accountStatus.accountId?.replace(/^[A-Z]#/, '') || accountStatus.accountId;

      // Convert equity (string) to number for balance
      const balance = parseFloat(accountStatus.equity);
      
      if (isNaN(balance)) {
        console.warn('⚠️ AccountStatusService: Invalid equity value:', accountStatus.equity);
        return;
      }

      // Update the account balance in AppContextService
      // The accountId format is "D#1492655", we normalize it before updating
      this.appContext.updateAccountBalance(accountStatus.accountId, balance);
      
      // Actualizar timestamp del último balance recibido
      this.lastBalanceUpdate.set(normalizedAccountId, Date.now());

      // Update the accountStatus map
      const currentStatus = new Map(this.accountStatusSubject.value);
      currentStatus.set(normalizedAccountId, accountStatus);
      this.accountStatusSubject.next(currentStatus);

      console.log(`✅ AccountStatusService: Processed AccountStatus for ${accountStatus.accountId}, Balance: ${balance}`);
    } catch (error) {
      console.error('❌ AccountStatusService: Error processing AccountStatus:', error, accountStatus);
    }
  }

  /**
   * Update accounts sent to backend
   * Call this when user adds/removes accounts
   */
  updateAccounts(accounts: AccountData[]): void {
    // Actualizar cuentas actuales
    this.currentAccounts = accounts || [];
    
    if (this.socket?.connected && this.currentAccounts && this.currentAccounts.length > 0) {
      try {
        this.socket.emit('updateAccounts', { accounts: this.currentAccounts });
        console.log(`📤 AccountStatusService: Updated ${this.currentAccounts.length} accounts in backend`);
        // Actualizar timestamp
        this.lastStreamDataTime = Date.now();
      } catch (error) {
        console.error('❌ AccountStatusService: Error updating accounts:', error);
      }
    } else {
      console.warn('⚠️ AccountStatusService: Cannot update accounts - socket not connected or no accounts');
    }
  }

  /**
   * Get AccountStatus for a specific account
   */
  getAccountStatus(accountId: string): AccountStatus | undefined {
    // Try with normalized accountId first
    const normalizedAccountId = accountId?.replace(/^[A-Z]#/, '') || accountId;
    return this.accountStatusSubject.value.get(normalizedAccountId) || 
           this.accountStatusSubject.value.get(accountId);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    // Detener verificación de datos
    this.stopStreamDataCheck();
    
    // Cancelar timer de reconexión
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.socket) {
      // Remover todos los event listeners antes de desconectar
      this.socketEventHandlers.forEach((handler, event) => {
        try {
          this.socket?.off(event, handler);
        } catch (error) {
          console.warn(`⚠️ AccountStatusService: Error removing listener for ${event}:`, error);
        }
      });
      this.socketEventHandlers.clear();
      
      // Desconectar el socket
      try {
        this.socket.disconnect();
      } catch (error) {
        console.warn('⚠️ AccountStatusService: Error disconnecting socket:', error);
      }
      
      this.socket = null;
      this.currentUserId = null;
      this.currentAccounts = [];
      this.reconnectAttempts = 0;
      console.log('🔕 AccountStatusService: Disconnected from WebSocket');
    }
  }

  /**
   * Check if connected to WebSocket
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get the socket instance (for components that need to listen to events directly)
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Handle account metrics event from Socket.IO
   */
  private handleAccountMetrics(data: AccountMetricsEvent): void {
    try {
      console.log('📊 AccountStatusService: Received accountMetrics event:', data);
      
      // Validate data
      if (!data || !data.accountId || !data.metrics) {
        console.warn('⚠️ AccountStatusService: Invalid accountMetrics data:', data);
        return;
      }

      // Emit to subscribers
      this.accountMetricsSubject.next(data);

      // Update account metrics in AppContextService
      this.appContext.updateAccountMetrics(data.accountId, data.metrics);

      // NUEVO: Si viene balance en metrics, actualizarlo también
      if ((data.metrics as any).balance !== undefined) {
        const balance = (data.metrics as any).balance;
        this.appContext.updateAccountBalance(data.accountId, balance);
        console.log(`💰 AccountStatusService: Balance actualizado desde accountMetrics para ${data.accountId}: ${balance}`);
      }

      // NUEVO: Si vienen stats completos, actualizar también
      if (data.metrics.stats) {
        console.log('📊 AccountStatusService: Updating account stats:', data.metrics.stats);
        // El AppContextService puede tener un método para actualizar stats
        // Por ahora, se actualizará desde el componente del reporte
      }

      console.log(`✅ AccountStatusService: Processed accountMetrics for ${data.accountId}`);
    } catch (error) {
      console.error('❌ AccountStatusService: Error handling accountMetrics:', error, data);
    }
  }

  /**
   * Handle position closed event from Socket.IO
   */
  private handlePositionClosed(data: PositionClosedEvent): void {
    try {
      console.log('🔒 AccountStatusService: Received positionClosed event:', data);
      
      // Validate data
      if (!data || !data.accountId || !data.positionId) {
        console.warn('⚠️ AccountStatusService: Invalid positionClosed data:', data);
        return;
      }

      // Emit to subscribers
      this.positionClosedSubject.next(data);

      // Update account metrics in AppContextService (incluye stats si vienen)
      if (data.updatedMetrics) {
        // Actualizar métricas básicas
        this.appContext.updateAccountMetrics(data.accountId, {
          netPnl: data.updatedMetrics.netPnl,
          profit: data.updatedMetrics.profit,
          bestTrade: data.updatedMetrics.bestTrade
        });
      }

      // NUEVO: Si viene trade formateado, emitirlo para el calendario
      if (data.trade && !data.trade.isOpen) {
        console.log('📅 AccountStatusService: Emitting trade for calendar:', data.trade);
        this.calendarTradeSubject.next({
          accountId: data.accountId,
          trade: data.trade
        });
      }

      // Mantener compatibilidad: si no viene trade, usar position (formato antiguo)
      if (!data.trade && data.position) {
        console.log('⚠️ AccountStatusService: Received position (old format), trade conversion may be needed');
        // El componente del reporte puede convertir position a trade si es necesario
      }

      console.log(`✅ AccountStatusService: Processed positionClosed for ${data.positionId}`);
    } catch (error) {
      console.error('❌ AccountStatusService: Error handling positionClosed:', error, data);
    }
  }

  /**
   * Handle strategy followed update event from Socket.IO
   */
  private handleStrategyFollowedUpdate(data: StrategyFollowedUpdateEvent): void {
    try {
      console.log('📈 AccountStatusService: Received strategyFollowedUpdate event:', data);
      
      // Validate data
      if (!data || !data.userId || data.strategy_followed === undefined) {
        console.warn('⚠️ AccountStatusService: Invalid strategyFollowedUpdate data:', data);
        return;
      }

      // Emit to subscribers
      this.strategyFollowedUpdateSubject.next(data);

      // Update user data in AppContextService
      this.appContext.updateUserData({
        strategy_followed: data.strategy_followed
      });

      console.log(`✅ AccountStatusService: Processed strategyFollowedUpdate for ${data.userId}`);
    } catch (error) {
      console.error('❌ AccountStatusService: Error handling strategyFollowedUpdate:', error, data);
    }
  }

  /**
   * Handle subscription updated event from Socket.IO
   * Emitted when subscription changes (from Stripe webhook or manual update)
   */
  private handleSubscriptionUpdated(data: SubscriptionUpdatedEvent): void {
    try {
      console.log('💳 AccountStatusService: Received subscription:updated event:', data);
      
      // Validate data
      if (!data || !data.userId) {
        console.warn('⚠️ AccountStatusService: Invalid subscription:updated data:', data);
        return;
      }

      // Emit to subscribers
      this.subscriptionUpdatedSubject.next(data);

      console.log(`✅ AccountStatusService: Processed subscription:updated for ${data.userId}`);
    } catch (error) {
      console.error('❌ AccountStatusService: Error handling subscription:updated:', error, data);
    }
  }

  /**
   * Programar reconexión manual después de un delay
   */
  private scheduleReconnect(): void {
    // Cancelar timer anterior si existe
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    // No intentar reconectar si ya se alcanzó el máximo
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('⚠️ AccountStatusService: Máximo de intentos de reconexión alcanzado');
      return;
    }
    
    // Calcular delay exponencial
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`🔄 AccountStatusService: Programando reconexión en ${delay}ms (intento ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimer = setTimeout(() => {
      if (this.currentUserId && !this.socket?.connected) {
        console.log('🔄 AccountStatusService: Intentando reconexión manual...');
        this.reconnectAttempts++;
        this.connect(this.currentUserId, this.currentAccounts);
      }
    }, delay);
  }

  /**
   * Iniciar verificación periódica de datos de streams
   * Si no llegan datos por un tiempo, reenviar las cuentas
   */
  private startStreamDataCheck(): void {
    // Detener verificación anterior si existe
    this.stopStreamDataCheck();
    
    // Actualizar timestamp inicial
    this.lastStreamDataTime = Date.now();
    
    // Iniciar verificación periódica
    this.streamDataCheckInterval = setInterval(() => {
      if (!this.socket?.connected) {
        this.stopStreamDataCheck();
        return;
      }
      
      const timeSinceLastData = Date.now() - this.lastStreamDataTime;
      
      // Verificar si hay balances actualizados recientemente
      const hasRecentBalances = Array.from(this.lastBalanceUpdate.values())
        .some(timestamp => Date.now() - timestamp < this.streamDataCheckDelay);
      
      // Si no llegan datos por más del delay configurado O no hay balances recientes
      if (timeSinceLastData > this.streamDataCheckDelay || !hasRecentBalances) {
        console.warn(`⚠️ AccountStatusService: No se recibieron datos de streams en ${timeSinceLastData}ms o no hay balances recientes, verificando conexión...`);
        
        // Si el backend no está conectado a streams, solicitar reconexión
        if (!this.backendStreamsConnected) {
          console.warn('⚠️ AccountStatusService: Backend no está conectado a Streams API, solicitando reconexión...');
          this.requestStreamsReconnection();
        } else {
          // Si está conectado pero no llegan datos, reenviar cuentas
          if (this.currentAccounts && this.currentAccounts.length > 0) {
            try {
              this.socket.emit('updateAccounts', { accounts: this.currentAccounts });
              console.log(`📤 AccountStatusService: Reenviadas ${this.currentAccounts.length} cuentas al backend`);
              // Actualizar timestamp después de reenviar
              this.lastStreamDataTime = Date.now();
            } catch (error) {
              console.error('❌ AccountStatusService: Error reenviando cuentas:', error);
            }
          }
        }
      }
    }, this.streamDataCheckDelay);
  }

  /**
   * Detener verificación de datos de streams
   */
  private stopStreamDataCheck(): void {
    if (this.streamDataCheckInterval) {
      clearInterval(this.streamDataCheckInterval);
      this.streamDataCheckInterval = null;
    }
  }

  /**
   * Solicitar al backend que se reconecte a la API de Streams
   */
  private requestStreamsReconnection(): void {
    if (!this.socket?.connected || !this.currentAccounts || this.currentAccounts.length === 0) {
      console.warn('⚠️ AccountStatusService: No se puede solicitar reconexión - socket no conectado o sin cuentas');
      return;
    }
    
    try {
      // Enviar evento especial para solicitar reconexión a streams
      this.socket.emit('reconnectStreams', { 
        accounts: this.currentAccounts,
        userId: this.currentUserId 
      });
      console.log('📤 AccountStatusService: Solicitada reconexión a Streams API al backend');
    } catch (error) {
      console.error('❌ AccountStatusService: Error solicitando reconexión a streams:', error);
    }
  }

  ngOnDestroy(): void {
    // NO desconectar el socket al destruir el servicio
    // El socket debe mantenerse conectado incluso al recargar la página
    // Solo limpiar subjects, pero mantener la conexión viva
    console.log('🔕 AccountStatusService: ngOnDestroy llamado, pero manteniendo conexión de socket activa');
    
    // Complete subjects (pero no desconectar socket)
    this.accountMetricsSubject.complete();
    this.positionClosedSubject.complete();
    this.strategyFollowedUpdateSubject.complete();
    this.calendarTradeSubject.complete();
    
    // NOTA: No llamar a disconnect() aquí para mantener la conexión al recargar
  }
}
