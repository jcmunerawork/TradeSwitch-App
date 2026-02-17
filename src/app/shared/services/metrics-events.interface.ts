import { PositionData } from '../../features/report/models/trading-history.model';

/**
 * Interface for account metrics received from backend
 */
export interface AccountMetrics {
  accountId: string;
  netPnl: number;        // Entero redondeado
  profit: number;       // Profit factor, 2 decimales
  bestTrade: number;    // 2 decimales
  stats?: {
    netPnl: number;
    tradeWinPercent: number;  // Entero (0-100)
    profitFactor: number;     // 2 decimales
    avgWinLossTrades: number; // 2 decimales
    totalTrades: number;      // Entero
    activePositions: number;  // Entero
  };
}

/**
 * Interface for account metrics event from Socket.IO
 */
export interface AccountMetricsEvent {
  accountId: string;        // ID de Firebase de la cuenta
  metrics: {
    netPnl: number;
    profit: number;         // Profit factor
    bestTrade: number;
    // NUEVO: Stats completos (opcional - pueden no venir en todas las actualizaciones)
    stats?: {
      netPnl: number;
      tradeWinPercent: number;
      profitFactor: number;
      avgWinLossTrades: number;
      totalTrades: number;
      activePositions: number;
    };
  };
  timestamp: number;
}

/**
 * Interface for position closed event from Socket.IO
 */
export interface PositionClosedEvent {
  accountId: string;        // ID de Firebase de la cuenta
  positionId: string;
  position?: PositionData;   // Datos completos de la posición cerrada (formato antiguo, opcional)
  // NUEVO: Trade formateado para el calendario (formato nuevo)
  trade?: {
    id: string;
    positionId: string;
    lastModified: number; // timestamp en milisegundos - usado para agrupar por fecha
    pnl: number;
    tradableInstrumentId: string;
    routeId: string;
    instrument: string;
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
    createdDate: string; // timestamp en milisegundos (string o number) - usado para mostrar día en calendario
    closedDate: number; // timestamp en milisegundos
    isOpen: false; // siempre false para trades cerrados
    stopLoss: string;
    stopLossType: string;
    takeProfit: string;
    takeProfitType: string;
    strategyId: string;
    isWon: boolean;
  } | null;
  updatedMetrics: {
    netPnl: number;
    profit: number;
    bestTrade: number;
    // NUEVO: stats completos
    stats: {
      netPnl: number;
      tradeWinPercent: number;
      profitFactor: number;
      avgWinLossTrades: number;
      totalTrades: number;
      activePositions: number;
    };
  };
  timestamp: number;
}

/**
 * Interface for strategy followed update event from Socket.IO
 */
export interface StrategyFollowedUpdateEvent {
  userId: string;
  strategy_followed: number;  // Porcentaje, 1 decimal (0-100)
  strategyName?: string;      // Nombre de la estrategia seguida
  timestamp: number;
}

/**
 * Interface for strategy followed data from API
 */
export interface StrategyFollowedData {
  strategy_followed: number;  // Porcentaje, 1 decimal (0-100)
  strategyName?: string;       // Nombre de la estrategia seguida
}

/**
 * Interface for subscription updated event from Socket.IO
 * Emitted when subscription changes (from Stripe webhook or manual update)
 */
export interface SubscriptionUpdatedEvent {
  userId: string;
  subscription: {
    id?: string;
    planId: string;
    status: string;
    created_at: any;
    updated_at: any;
    userId: string;
    transactionId?: string;
    periodStart?: any;
    periodEnd?: any;
    cancelAtPeriodEnd?: boolean;
  } | null;  // null if user has no subscription
  timestamp: number;
}

