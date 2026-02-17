import { GroupedTradeFinal } from './report.model';

/**
 * Interface representing a position stored in Firebase.
 * 
 * Contains all position data including instrument information,
 * dates, PnL, and synchronization metadata.
 */
export interface PositionData {
  // Identificadores
  positionId: string;
  id: string;
  
  // Instrumento
  tradableInstrumentId: string;
  routeId: string;
  instrumentName: string;           // Nombre del instrumento (guardado)
  instrumentCode: string;           // Código del instrumento (tradableInstrumentId)
  
  // Fechas importantes
  createdDate: string;              // Fecha de apertura (MUY IMPORTANTE)
  lastModified: string;             // Fecha de cierre (si está cerrado)
  openDate?: number;                // Timestamp de apertura
  closeDate?: number;               // Timestamp de cierre (si está cerrado)
  
  // Datos del trade
  qty: string;
  side: string;
  type: string;
  status: string;
  filledQty: string;
  avgPrice: string;
  price: string;
  stopPrice: string;
  validity: string;
  expireDate: string;
  stopLoss: string;
  stopLossType: string;
  takeProfit: string;
  takeProfitType: string;
  strategyId: string;
  
  // Cálculos
  pnl?: number;                     // PnL calculado
  isWon?: boolean;                  // Si ganó o perdió
  isOpen: boolean;                  // Si está abierta o cerrada
  
  // Metadata
  syncedAt: number;                 // Timestamp de última sincronización
  source: 'history' | 'streams';    // Origen del dato
  version: number;                  // Versión para conflict resolution
}

/**
 * Interface representing aggregated metrics for an account.
 * 
 * All metrics are calculated only from closed trades.
 */
export interface TradingMetrics {
  totalPnL: number;                 // Suma de todos los PnL cerrados
  percentageTradeWin: number;      // % de trades ganadores
  profitFactor: number;             // Profit factor
  totalTrades: number;              // Solo trades cerrados
  averageWinLossTrades: number;     // Promedio win/loss
}

/**
 * Interface representing synchronization metadata.
 */
export interface SyncMetadata {
  lastHistorySync: number;          // Última sync completa desde getHistory
  lastStreamSync: number;          // Última actualización desde streams
  lastFullSync: number;             // Última sync completa (histórico + streams)
  totalPositions: number;           // Total de posiciones (abiertas + cerradas)
  closedPositions: number;          // Solo cerradas
  openPositions: number;            // Solo abiertas
}

/**
 * Interface representing cached instrument information.
 */
export interface InstrumentCacheEntry {
  name: string;
  lotSize: number;
  lastFetched: number;
}

/**
 * Interface representing the complete trading history document in Firebase.
 * 
 * Structure: users/{userId}/trading_history/{accountId}
 */
export interface TradingHistoryDocument {
  accountId: string;
  
  // Posiciones individuales (indexadas por positionId)
  positions: {
    [positionId: string]: PositionData;
  };
  
  // Métricas agregadas de la cuenta (solo trades cerrados)
  metrics: TradingMetrics;
  
  // Metadata de sincronización
  syncMetadata: SyncMetadata;
  
  // Cache de nombres de instrumentos (para evitar peticiones repetidas)
  instrumentCache: {
    [key: string]: InstrumentCacheEntry; // key: "tradableInstrumentId-routeId"
  };
}

/**
 * Interface representing a streams update for a position.
 */
export interface StreamsPositionUpdate {
  positionId: string;
  pnl?: number;
  isOpen?: boolean;
  lastModified?: string;
  // Otros campos que puedan venir de streams
  [key: string]: any;
}

/**
 * Interface representing the result of a sync operation.
 */
export interface SyncResult {
  success: boolean;
  error?: string;
  positionsAdded?: number;
  positionsUpdated?: number;
  metricsUpdated?: boolean;
}

