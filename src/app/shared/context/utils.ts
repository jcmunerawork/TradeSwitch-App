import { CACHE_CONFIG, PLUGIN_ACTIONS } from './constants';
import { TradeLockerAccountData, PluginHistoryData, UserPlanData } from './types';

// Utilidades para el contexto de la aplicación

/**
 * Verifica si los datos están obsoletos basándose en su timestamp
 */
export function isDataStale(timestamp: number, ttl: number = CACHE_CONFIG.API_TTL): boolean {
  const now = Date.now();
  return (now - timestamp) > ttl;
}

/**
 * Verifica si los datos de TradeLocker están obsoletos
 */
export function isTradeLockerDataStale(data: TradeLockerAccountData): boolean {
  return isDataStale(data.lastUpdated, CACHE_CONFIG.TRADE_LOCKER_TTL);
}

/**
 * Crea una entrada de historial de plugin
 */
export function createPluginHistoryEntry(
  userId: string,
  action: string,
  details: any = {}
): PluginHistoryData {
  return {
    id: generateId(),
    userId,
    action,
    timestamp: Date.now(),
    details
  };
}

/**
 * Genera un ID único
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Valida si un plan permite crear más cuentas
 */
export function canCreateAccount(plan: UserPlanData | null, currentCount: number): boolean {
  if (!plan) return false;
  return currentCount < plan.maxAccounts;
}

/**
 * Valida si un plan permite crear más estrategias
 */
export function canCreateStrategy(plan: UserPlanData | null, currentCount: number): boolean {
  if (!plan) return false;
  return currentCount < plan.maxStrategies;
}

/**
 * Calcula las limitaciones del plan
 */
export function calculatePlanLimitations(
  plan: UserPlanData | null,
  currentAccounts: number,
  currentStrategies: number
) {
  return {
    maxAccounts: plan?.maxAccounts || 0,
    currentAccounts,
    maxStrategies: plan?.maxStrategies || 0,
    currentStrategies,
    canCreateAccount: canCreateAccount(plan, currentAccounts),
    canCreateStrategy: canCreateStrategy(plan, currentStrategies),
    accountsRemaining: Math.max(0, (plan?.maxAccounts || 0) - currentAccounts),
    strategiesRemaining: Math.max(0, (plan?.maxStrategies || 0) - currentStrategies)
  };
}

/**
 * Limpia datos obsoletos del caché
 */
export function cleanStaleCache<T>(
  cache: Map<string, { data: T; timestamp: number; ttl: number }>
): Map<string, { data: T; timestamp: number; ttl: number }> {
  const now = Date.now();
  const cleanedCache = new Map();
  
  for (const [key, value] of cache.entries()) {
    if ((now - value.timestamp) <= value.ttl) {
      cleanedCache.set(key, value);
    }
  }
  
  return cleanedCache;
}

/**
 * Limita el tamaño del caché eliminando las entradas más antiguas
 */
export function limitCacheSize<T>(
  cache: Map<string, T>,
  maxSize: number = CACHE_CONFIG.MAX_CACHE_SIZE
): Map<string, T> {
  if (cache.size <= maxSize) {
    return cache;
  }
  
  const entries = Array.from(cache.entries());
  entries.sort((a, b) => {
    // Asumir que T tiene una propiedad timestamp
    const aTime = (a[1] as any).timestamp || 0;
    const bTime = (b[1] as any).timestamp || 0;
    return aTime - bTime;
  });
  
  const toRemove = entries.length - maxSize;
  const limitedCache = new Map(cache);
  
  for (let i = 0; i < toRemove; i++) {
    limitedCache.delete(entries[i][0]);
  }
  
  return limitedCache;
}

/**
 * Debounce para evitar actualizaciones excesivas
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle para limitar la frecuencia de actualizaciones
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Valida si un objeto es válido para el contexto
 */
export function isValidContextData(data: any): boolean {
  return data !== null && data !== undefined && typeof data === 'object';
}

/**
 * Clona profundamente un objeto para evitar mutaciones
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as T;
  }
  
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

/**
 * Crea un hash simple para un objeto
 */
export function createHash(obj: any): string {
  const str = JSON.stringify(obj);
  let hash = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32-bit integer
  }
  
  return hash.toString(36);
}

/**
 * Verifica si dos objetos son iguales (shallow comparison)
 */
export function shallowEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  
  if (obj1 == null || obj2 == null) return false;
  
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (let key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }
  
  return true;
}
