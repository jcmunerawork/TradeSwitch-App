import { Injectable } from '@angular/core';
import { ConfigurationOverview } from '../models/strategy.model';
import { StrategyState } from '../models/strategy.model';

/**
 * Service for caching strategy data in memory and localStorage.
 *
 * This service provides a centralized cache for storing complete strategy data
 * (both overview and configuration) to avoid redundant backend queries.
 * Strategies are cached by their ID for quick access.
 *
 * Features:
 * - In-memory caching of strategies
 * - localStorage persistence for offline access
 * - Cache size tracking
 * - Cache clearing functionality
 * - Automatic cache synchronization
 *
 * Used in:
 * - StrategyComponent: Caching strategies during initialization
 * - EditStrategyComponent: Loading strategies from cache
 * - All CRUD operations: Refreshing cache after changes
 *
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class StrategyCacheService {
  private readonly STORAGE_KEY = 'tradeswitch_strategies_cache';
  private readonly STORAGE_TIMESTAMP_KEY = 'tradeswitch_strategies_cache_timestamp';
  private strategiesCache: Map<string, { overview: ConfigurationOverview; configuration: StrategyState }> = new Map();

  constructor() {
    // Cargar cache desde localStorage al inicializar
    this.loadFromLocalStorage();
  }

  /**
   * Almacenar estrategia en el cache (memoria y localStorage)
   */
  setStrategy(strategyId: string, overview: ConfigurationOverview, configuration: StrategyState): void {
    this.strategiesCache.set(strategyId, { overview, configuration });
    this.saveToLocalStorage();
  }

  /**
   * Obtener estrategia del cache (primero memoria, luego localStorage)
   */
  getStrategy(strategyId: string): { overview: ConfigurationOverview; configuration: StrategyState } | null {
    // Primero intentar desde memoria
    const cached = this.strategiesCache.get(strategyId);
    if (cached) {
      return cached;
    }

    // Si no está en memoria, intentar desde localStorage
    this.loadFromLocalStorage();
    return this.strategiesCache.get(strategyId) || null;
  }

  /**
   * Guardar todas las estrategias en el cache (memoria y localStorage)
   */
  setAllStrategies(strategies: Map<string, { overview: ConfigurationOverview; configuration: StrategyState }>): void {
    this.strategiesCache = new Map(strategies);
    this.saveToLocalStorage();
  }

  /**
   * Verificar si el cache está cargado
   */
  isCacheLoaded(): boolean {
    return this.strategiesCache.size > 0;
  }

  /**
   * Limpiar todo el cache (memoria y localStorage)
   */
  clearCache(): void {
    this.strategiesCache.clear();
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.STORAGE_TIMESTAMP_KEY);
    } catch (error) {
      console.warn('Error clearing localStorage cache:', error);
    }
  }

  /**
   * Obtener todas las estrategias del cache
   */
  getAllStrategies(): Map<string, { overview: ConfigurationOverview; configuration: StrategyState }> {
    return this.strategiesCache;
  }

  /**
   * Obtener el tamaño del cache
   */
  getCacheSize(): number {
    return this.strategiesCache.size;
  }

  /**
   * Guardar cache en localStorage
   */
  private saveToLocalStorage(): void {
    try {
      const cacheArray = Array.from(this.strategiesCache.entries()).map(([id, data]) => ({
        id,
        overview: data.overview,
        configuration: data.configuration
      }));

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheArray));
      localStorage.setItem(this.STORAGE_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.warn('Error saving strategies to localStorage:', error);
      // Si hay error (por ejemplo, quota exceeded), limpiar cache antiguo
      try {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.STORAGE_TIMESTAMP_KEY);
      } catch (clearError) {
        console.error('Error clearing localStorage:', clearError);
      }
    }
  }

  /**
   * Cargar cache desde localStorage
   */
  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const cacheArray = JSON.parse(stored) as Array<{
          id: string;
          overview: ConfigurationOverview;
          configuration: StrategyState;
        }>;

        this.strategiesCache = new Map(
          cacheArray.map(item => [item.id, { overview: item.overview, configuration: item.configuration }])
        );
      }
    } catch (error) {
      console.warn('Error loading strategies from localStorage:', error);
      this.strategiesCache.clear();
    }
  }

  /**
   * Obtener timestamp del último guardado del cache
   */
  getCacheTimestamp(): number | null {
    try {
      const timestamp = localStorage.getItem(this.STORAGE_TIMESTAMP_KEY);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch (error) {
      return null;
    }
  }
}
