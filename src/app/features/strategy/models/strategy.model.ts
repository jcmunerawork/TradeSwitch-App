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

export const availableSymbols = [
  'XMRUSD',
  'BTCUSD',
  'ETHEUR',
  'XLMUSD',
  'ZECUSD',
  'BTCEUR',
  'ADAUSD',
];

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
  maxRiskPerTrade: number;
  maxRiskPercentage: number;
  balance: number;
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
}