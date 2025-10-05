// Constantes para el contexto de la aplicación

export const CACHE_CONFIG = {
  // TTL en milisegundos
  TRADE_LOCKER_TTL: 5 * 60 * 1000, // 5 minutos
  API_TTL: 10 * 60 * 1000, // 10 minutos
  USER_DATA_TTL: 30 * 60 * 1000, // 30 minutos
  
  // Tamaños máximos
  MAX_CACHE_SIZE: 100,
  MAX_TRADE_LOCKER_ACCOUNTS: 50,
  MAX_PLUGIN_HISTORY: 1000,
  
  // Intervalos de actualización
  AUTO_REFRESH_INTERVAL: 60 * 1000, // 1 minuto
  STALE_DATA_THRESHOLD: 2 * 60 * 1000, // 2 minutos
} as const;

export const LOADING_STATES = {
  USER: 'user',
  ACCOUNTS: 'accounts',
  STRATEGIES: 'strategies',
  PLAN: 'plan',
  PLUGIN_HISTORY: 'pluginHistory',
  TRADE_LOCKER: 'tradeLocker',
} as const;

export const ERROR_TYPES = {
  USER: 'user',
  ACCOUNTS: 'accounts',
  STRATEGIES: 'strategies',
  PLAN: 'plan',
  PLUGIN_HISTORY: 'pluginHistory',
  TRADE_LOCKER: 'tradeLocker',
} as const;

export const CONTEXT_EVENTS = {
  USER_LOGIN: 'user:login',
  USER_LOGOUT: 'user:logout',
  USER_UPDATE: 'user:update',
  ACCOUNTS_ADD: 'accounts:add',
  ACCOUNTS_UPDATE: 'accounts:update',
  ACCOUNTS_REMOVE: 'accounts:remove',
  STRATEGIES_ADD: 'strategies:add',
  STRATEGIES_UPDATE: 'strategies:update',
  STRATEGIES_REMOVE: 'strategies:remove',
  STRATEGIES_ACTIVATE: 'strategies:activate',
  PLAN_UPDATE: 'plan:update',
  PLUGIN_HISTORY_ADD: 'pluginHistory:add',
  CACHE_CLEAR: 'cache:clear',
  ERROR_SET: 'error:set',
  ERROR_CLEAR: 'error:clear',
} as const;

export const DEFAULT_PLAN = {
  planId: 'free',
  planName: 'Free',
  maxAccounts: 1,
  maxStrategies: 1,
  features: ['basic_trading'],
  isActive: true,
} as const;

export const PLUGIN_ACTIONS = {
  ACCOUNT_CREATED: 'account_created',
  ACCOUNT_UPDATED: 'account_updated',
  ACCOUNT_DELETED: 'account_deleted',
  STRATEGY_CREATED: 'strategy_created',
  STRATEGY_UPDATED: 'strategy_updated',
  STRATEGY_DELETED: 'strategy_deleted',
  STRATEGY_ACTIVATED: 'strategy_activated',
  STRATEGY_DEACTIVATED: 'strategy_deactivated',
  PLAN_CHANGED: 'plan_changed',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
} as const;
