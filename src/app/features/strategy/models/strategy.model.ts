import { Timestamp } from "firebase/firestore";

export enum RuleType {
  ASSETS_ALLOWED = 'ASSETS ALLOWED',
  DAYS_ALLOWED = 'DAYS ALLOWED',
  MAX_DAILY_TRADES = 'MAX DAILY TRADES',
  MAX_RISK_PER_TRADE = 'MAX RISK PER TRADE',
  RISK_REWARD_RATIO = 'RISK REWARD RATIO',
  TRADING_HOURS = 'TRADING HOURS',
}

export enum Days {
  MONDAY = 'Monday',
  TUESDAY = 'Tuesday',
  WEDNESDAY = 'Wednesday',
  THURSDAY = 'Thursday',
  FRIDAY = 'Friday',
  SATURDAY = 'Saturday',
  SUNDAY = 'Sunday',
}

export interface MaxDailyTradesConfig {
  isActive: boolean;
  type: RuleType;
  maxDailyTrades: number;
}

export interface DaysAllowedConfig {
  isActive: boolean;
  type: RuleType;
  tradingDays: string[];
}
export interface RiskRewardConfig {
  isActive: boolean;
  riskRewardRatio: string;
  type: RuleType;
}
export interface RiskPerTradeConfig {
  isActive: boolean;
  review_type: "MAX" | "FIXED";
  number_type: "PERCENTAGE" | "MONEY";
  percentage_type: "INITIAL_B" | "ACTUAL_B" | "NULL";
  risk_ammount: number;
  balance: number;
  actualBalance?: number;
  type: RuleType;
}
export interface HoursAllowedConfig {
  isActive: boolean;
  tradingOpenTime: string;
  tradingCloseTime: string;
  timezone: string;
  type: RuleType;
}

export interface AssetsAllowedConfig {
  isActive: boolean;
  assetsAllowed: string[];
  type: RuleType;
}

// Configuración que va en la colección 'configurations' - Solo reglas
export interface StrategyState {
  assetsAllowed: AssetsAllowedConfig;
  hoursAllowed: HoursAllowedConfig;
  riskReward: RiskRewardConfig;
  maxDailyTrades: MaxDailyTradesConfig;
  riskPerTrade: RiskPerTradeConfig;
  daysAllowed: DaysAllowedConfig;
}

// Datos básicos que van en la colección 'configuration-overview' - Solo metadatos
export interface ConfigurationOverview {
  userId: string;
  name: string;
  status: boolean;
  created_at: any; // Timestamp de Firebase
  updated_at: any; // Timestamp de Firebase
  days_active: number;
  configurationId: string; // ID del documento en la colección 'configurations'
  dateActive?: any[]; // Fecha cuando se activó la estrategia
  dateInactive?: any[]; // Fecha cuando se desactivó la estrategia
  deleted?: boolean; // Indica si la estrategia está marcada como eliminada
  deleted_at?: any; // Timestamp de Firebase cuando se marcó como eliminada
}