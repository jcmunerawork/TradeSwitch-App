import { Injectable } from '@angular/core';
import { ConfigurationOverview } from '../models/strategy.model';
import { StrategyState } from '../models/strategy.model';

@Injectable({
  providedIn: 'root'
})
export class StrategyCacheService {
  private strategiesCache: Map<string, { overview: ConfigurationOverview; configuration: StrategyState }> = new Map();

  /**
   * Almacenar estrategia en el cache
   */
  setStrategy(strategyId: string, overview: ConfigurationOverview, configuration: StrategyState): void {
    this.strategiesCache.set(strategyId, { overview, configuration });
  }

  /**
   * Obtener estrategia del cache
   */
  getStrategy(strategyId: string): { overview: ConfigurationOverview; configuration: StrategyState } | null {
    return this.strategiesCache.get(strategyId) || null;
  }

  /**
   * Verificar si el cache está cargado
   */
  isCacheLoaded(): boolean {
    return this.strategiesCache.size > 0;
  }

  /**
   * Limpiar todo el cache
   */
  clearCache(): void {
    this.strategiesCache.clear();
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

}
