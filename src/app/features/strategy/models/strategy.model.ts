import { Timestamp } from "firebase/firestore";

/**
 * Enum representing the types of trading rules available in the system.
 *
 * Each rule type corresponds to a specific trading constraint or configuration.
 *
 * @enum {string}
 */
export enum RuleType {
  ASSETS_ALLOWED = 'ASSETS ALLOWED',
  DAYS_ALLOWED = 'DAYS ALLOWED',
  MAX_DAILY_TRADES = 'MAX DAILY TRADES',
  MAX_RISK_PER_TRADE = 'MAX RISK PER TRADE',
  RISK_REWARD_RATIO = 'RISK REWARD RATIO',
  TRADING_HOURS = 'TRADING HOURS',
}

/**
 * Enum representing the days of the week.
 *
 * Used for configuring which days trading is allowed.
 *
 * @enum {string}
 */
export enum Days {
  MONDAY = 'Monday',
  TUESDAY = 'Tuesday',
  WEDNESDAY = 'Wednesday',
  THURSDAY = 'Thursday',
  FRIDAY = 'Friday',
  SATURDAY = 'Saturday',
  SUNDAY = 'Sunday',
}

/**
 * Interface representing the maximum daily trades configuration.
 *
 * Limits the number of trades that can be executed per day.
 *
 * @interface MaxDailyTradesConfig
 */
export interface MaxDailyTradesConfig {
  isActive: boolean;
  type: RuleType;
  maxDailyTrades: number;
}

/**
 * Interface representing the days allowed for trading configuration.
 *
 * Specifies which days of the week trading is permitted.
 *
 * @interface DaysAllowedConfig
 */
export interface DaysAllowedConfig {
  isActive: boolean;
  type: RuleType;
  tradingDays: string[];
}
/**
 * Interface representing the risk/reward ratio configuration.
 *
 * Defines the minimum risk/reward ratio required for trades (e.g., "1:2").
 *
 * @interface RiskRewardConfig
 */
export interface RiskRewardConfig {
  isActive: boolean;
  riskRewardRatio: string;
  type: RuleType;
}
/**
 * Interface representing the maximum risk per trade configuration.
 *
 * Defines how much risk can be taken per trade, with options for:
 * - Review type: MAX (maximum allowed) or FIXED (fixed amount)
 * - Number type: PERCENTAGE or MONEY
 * - Percentage type: INITIAL_B (initial balance), ACTUAL_B (actual balance), or NULL
 *
 * @interface RiskPerTradeConfig
 */
export interface RiskPerTradeConfig {
  isActive: boolean;
  review_type: "MAX" | "FIXED";
  number_type: "PERCENTAGE" | "MONEY";
  percentage_type: "INITIAL_B" | "ACTUAL_B" | "NULL";
  risk_ammount: number;
  balance: number;
  actualBalance?: any;
  type: RuleType;
}
/**
 * Interface representing the trading hours configuration.
 *
 * Defines the time window during which trading is allowed, including
 * timezone information.
 *
 * @interface HoursAllowedConfig
 */
export interface HoursAllowedConfig {
  isActive: boolean;
  tradingOpenTime: string;
  tradingCloseTime: string;
  timezone: string;
  type: RuleType;
}

/**
 * Interface representing the assets allowed for trading configuration.
 *
 * Specifies which trading instruments/assets are permitted for trading.
 *
 * @interface AssetsAllowedConfig
 */
export interface AssetsAllowedConfig {
  isActive: boolean;
  assetsAllowed: string[];
  type: RuleType;
}

/**
 * Interface representing the complete strategy state (all trading rules).
 *
 * This interface contains all six trading rule configurations that make up
 * a complete trading strategy. It is stored in the 'configurations' collection
 * in Firebase, containing only the rules themselves.
 *
 * Used in:
 * - StrategyComponent: Managing strategy configurations
 * - SettingsService: CRUD operations for strategies
 * - NgRx Store: Local state management
 *
 * @interface StrategyState
 */
export interface StrategyState {
  assetsAllowed: AssetsAllowedConfig;
  hoursAllowed: HoursAllowedConfig;
  riskReward: RiskRewardConfig;
  maxDailyTrades: MaxDailyTradesConfig;
  riskPerTrade: RiskPerTradeConfig;
  daysAllowed: DaysAllowedConfig;
}

/**
 * Intervalo de actividad en el timeline de una estrategia.
 * El backend gestiona timeline; end_date null = intervalo abierto (activa hasta ahora).
 */
export interface TimelineInterval {
  start_date: string; // ISO 8601
  end_date: string | null; // null = aún activa
}

/**
 * Entrada del historial de actualizaciones (reglas activas en una fecha).
 */
export interface UpdatedAtHistoryEntry {
  date: string; // ISO 8601
  active_rules: string[];
}

/**
 * Convierte el timeline de una estrategia en rangos { start, end } para comparar con una fecha.
 * end_date null se trata como "hasta ahora" (now).
 */
export function getStrategyRangesFromTimeline(
  timeline: TimelineInterval[] | undefined | null,
  now: Date = new Date()
): { start: Date; end: Date }[] {
  if (!timeline || timeline.length === 0) return [];
  return timeline.map((interval) => ({
    start: new Date(interval.start_date),
    end: interval.end_date ? new Date(interval.end_date) : now,
  }));
}

/**
 * Interface representing strategy metadata (overview information).
 *
 * This interface contains metadata about a strategy, stored in the
 * 'configuration-overview' collection. It includes information
 * like name, status, creation dates, and references to the actual configuration.
 *
 * The actual rules are stored separately in the 'configurations' collection
 * and referenced via configurationId.
 *
 * Tracking de actividad:
 * - timeline: intervalos de activación/desactivación (start_date, end_date | null).
 * - updated_at_history: historial de cambios con reglas activas por fecha.
 * - dateActive/dateInactive están deprecados; usar timeline.
 *
 * @interface ConfigurationOverview
 */
export interface ConfigurationOverview {
  id?: string;
  userId: string;
  name: string;
  status: boolean;
  created_at: any;
  updated_at: any;
  days_active: number;
  configurationId: string;
  /** Activity intervals (from backend); end_date null = active until now */
  timeline?: TimelineInterval[];
  /** History of updates with active rules by date */
  updated_at_history?: UpdatedAtHistoryEntry[];
  /**
   * @deprecated Use timeline. Dates when the strategy was enabled (legacy).
   */
  dateActive?: string[];
  /**
   * @deprecated Use timeline. Dates when the strategy was disabled (legacy).
   */
  dateInactive?: string[];
}