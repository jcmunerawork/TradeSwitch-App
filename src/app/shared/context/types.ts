// Tipos extendidos para el contexto de la aplicación

import { AccountData } from "../../features/auth/models/userModel";
import { BalanceData } from "../../features/report/models/report.model";
import { ConfigurationOverview } from "../../features/strategy/models/strategy.model";

export interface ConfigurationOverviewWithId extends ConfigurationOverview {
  id: string;
}

export interface AccountDataWithId extends AccountData {
  id: string;
}

// Tipos para estados de carga
export interface LoadingState {
  user: boolean;
  accounts: boolean;
  strategies: boolean;
  plan: boolean;
  pluginHistory: boolean;
  tradeLocker: boolean;
}

// Tipos para estados de error
export interface ErrorState {
  user: string | null;
  accounts: string | null;
  strategies: string | null;
  plan: string | null;
  pluginHistory: string | null;
  tradeLocker: string | null;
}

// Tipos para configuración de caché
export interface CacheConfig {
  tradeLockerTtl: number;
  apiTtl: number;
  maxCacheSize: number;
}

// Tipos para datos de API externa
export interface TradeLockerAccountData {
  accountId: string;
  balance: BalanceData;
  lastUpdated: number;
  isValid: boolean;
}

export interface PluginHistoryData {
  id: string;
  userId: string;
  action: string;
  timestamp: number;
  details: any;
}

export interface UserPlanData {
  planId: string;
  planName: string;
  maxAccounts: number;
  maxStrategies: number;
  features: string[];
  isActive: boolean;
  expiresAt?: number;
}

// Tipos para limitaciones de plan
export interface PlanLimitations {
  maxAccounts: number;
  currentAccounts: number;
  maxStrategies: number;
  currentStrategies: number;
  canCreateAccount: boolean;
  canCreateStrategy: boolean;
}

// Tipos para datos de caché de API
export interface CachedData<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Tipos para eventos del contexto
export type ContextEvent = 
  | 'user:login'
  | 'user:logout'
  | 'user:update'
  | 'accounts:add'
  | 'accounts:update'
  | 'accounts:remove'
  | 'strategies:add'
  | 'strategies:update'
  | 'strategies:remove'
  | 'strategies:activate'
  | 'plan:update'
  | 'pluginHistory:add'
  | 'cache:clear'
  | 'error:set'
  | 'error:clear';

// Tipos para listeners de eventos
export type ContextEventListener = (event: ContextEvent, data?: any) => void;
