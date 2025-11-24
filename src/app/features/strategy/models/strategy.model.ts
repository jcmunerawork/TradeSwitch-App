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
 * Interface representing strategy metadata (overview information).
 *
 * This interface contains metadata about a strategy, stored in the
 * 'configuration-overview' collection in Firebase. It includes information
 * like name, status, creation dates, and references to the actual configuration.
 *
 * The actual rules are stored separately in the 'configurations' collection
 * and referenced via configurationId.
 *
 * Features:
 * - Tracks activation/deactivation dates
 * - Supports soft delete (deleted flag)
 * - Links to configuration via configurationId
 *
 * Used in:
 * - StrategyComponent: Displaying strategy cards
 * - SettingsService: Managing strategy metadata
 * - CalendarComponent: Determining strategy compliance for trades
 *
 * @interface ConfigurationOverview
 */
export interface ConfigurationOverview {
  userId: string;
  name: string;
  status: boolean;
  created_at: any; // Timestamp de Firebase
  updated_at: any; // Timestamp de Firebase
  days_active: number;
  configurationId: string; // ID del documento en la colección 'configurations'
  dateActive?: string[]; // ISO 8601 strings - Fechas cuando se activó la estrategia
  dateInactive?: string[]; // ISO 8601 strings - Fechas cuando se desactivó la estrategia
  deleted?: boolean; // Indica si la estrategia está marcada como eliminada
  deleted_at?: any; // Timestamp de Firebase cuando se marcó como eliminada
}