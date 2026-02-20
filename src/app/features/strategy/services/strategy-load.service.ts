import { Injectable } from '@angular/core';
import { ConfigurationOverview } from '../models/strategy.model';
import { StrategyState } from '../models/strategy.model';
import { SettingsService } from '../service/strategy.service';
import { StrategyCacheService } from './strategy-cache.service';
import { StrategyFilterService } from './strategy-filter.service';
import { AppContextService } from '../../../shared/context';
import { AlertService } from '../../../core/services';

const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos

export interface LoadStrategiesResult {
  userStrategies: ConfigurationOverview[];
  activeStrategy: ConfigurationOverview | null;
  /** Estado del botón crear estrategia desde el backend: available | plan_reached | block */
  button_state: 'available' | 'plan_reached' | 'block';
}

/**
 * Servicio que centraliza la carga de estrategias al cache (desde cache o backend)
 * y devuelve userStrategies + activeStrategy. El componente asigna el resultado
 * y se encarga de loadStrategyCardsData, updateStrategyCard y checkStrategyLimitations.
 */
@Injectable({
  providedIn: 'root',
})
export class StrategyLoadService {
  constructor(
    private strategyCacheService: StrategyCacheService,
    private strategySvc: SettingsService,
    private appContext: AppContextService,
    private strategyFilterService: StrategyFilterService,
    private alertService: AlertService
  ) {}

  /**
   * Carga todas las estrategias completas (desde cache si es válido, si no desde backend),
   * actualiza el cache, el contexto y el filtro. Devuelve la lista para "Other Strategies"
   * y la estrategia activa.
   */
  async loadAllStrategiesToCache(userId: string): Promise<LoadStrategiesResult> {
    try {
      const cacheSize = this.strategyCacheService.getCacheSize();
      const cacheTimestamp = this.strategyCacheService.getCacheTimestamp();
      const isCacheValid = cacheTimestamp != null && Date.now() - cacheTimestamp < CACHE_MAX_AGE_MS;

      if (cacheSize > 0 && isCacheValid) {
        return this.loadFromCache();
      }

      const { strategies, button_state } = await this.strategySvc.getStrategiesWithButtonState(userId);
      this.strategySvc.setCreateStrategyButtonState(button_state);

      if (!strategies?.length) {
        this.strategyFilterService.setStrategies([]);
        return { userStrategies: [], activeStrategy: null, button_state };
      }

      const strategiesCache = new Map<string, { overview: ConfigurationOverview; configuration: StrategyState }>();
      strategies.forEach(s => {
        if (s.overview.id) strategiesCache.set(s.overview.id, s);
      });
      this.strategyCacheService.setAllStrategies(strategiesCache);

      const activeStrategyData = strategies.find(s => s.overview.status === true);
      const activeStrategy = activeStrategyData ? activeStrategyData.overview : null;
      const activeStrategyId = activeStrategy ? (activeStrategy.id || '') : null;

      const userStrategies = strategies
        .map(s => s.overview)
        .filter(s => !activeStrategyId || (s.id || '') !== activeStrategyId);

      this.strategyFilterService.setStrategies(userStrategies);
      this.appContext.setUserStrategies(strategies.map(s => s.overview));

      return { userStrategies, activeStrategy, button_state };
    } catch (error: any) {
      console.error('❌ Error loading strategies to cache:', error);
      if (error?.status === 429) {
        this.alertService.showWarning(
          'Too many requests. Please wait a moment and try again.',
          'Rate Limit Exceeded'
        );
      }
      this.strategyFilterService.setStrategies([]);
      return { userStrategies: [], activeStrategy: null, button_state: this.strategySvc.getCreateStrategyButtonState() };
    }
  }

  private loadFromCache(): LoadStrategiesResult {
    const cachedStrategies = this.strategyCacheService.getAllStrategies();
    const strategiesWithConfigs: Array<{ overview: ConfigurationOverview; configuration: StrategyState }> = [];

    for (const [strategyId, strategyData] of cachedStrategies.entries()) {
      strategiesWithConfigs.push({
        overview: { ...strategyData.overview, id: strategyId } as ConfigurationOverview,
        configuration: strategyData.configuration
      });
    }

    const activeStrategyData = strategiesWithConfigs.find(s => s.overview.status === true);
    const activeStrategy = activeStrategyData ? activeStrategyData.overview : null;
    const activeStrategyId = activeStrategy ? (activeStrategy.id || '') : null;

    const userStrategies = strategiesWithConfigs
      .filter(s => !activeStrategyId || (s.overview.id || '') !== activeStrategyId)
      .map(s => s.overview);

    this.strategyFilterService.setStrategies(userStrategies);
    this.appContext.setUserStrategies(strategiesWithConfigs.map(s => s.overview));

    return { userStrategies, activeStrategy, button_state: this.strategySvc.getCreateStrategyButtonState() };
  }
}
