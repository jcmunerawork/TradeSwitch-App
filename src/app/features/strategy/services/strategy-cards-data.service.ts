import { Injectable } from '@angular/core';
import { ConfigurationOverview } from '../models/strategy.model';
import { StrategyState } from '../models/strategy.model';
import { SettingsService } from '../service/strategy.service';
import { StrategyCacheService } from './strategy-cache.service';
import { StrategyCardData } from '../../../shared/components';

/**
 * Servicio que construye StrategyCardData a partir de ConfigurationOverview y configuración:
 * formateo de fechas, conteo de reglas activas, carga desde getStrategyView.
 */
@Injectable({
  providedIn: 'root',
})
export class StrategyCardsDataService {
  constructor(
    private strategySvc: SettingsService,
    private strategyCacheService: StrategyCacheService
  ) {}

  formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  parseDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue?.toDate === 'function') return dateValue.toDate();
    if (dateValue.seconds != null) return new Date(dateValue.seconds * 1000 + (dateValue.nanoseconds || 0) / 1e6);
    if (typeof dateValue === 'string' || typeof dateValue === 'number') return new Date(dateValue);
    return new Date();
  }

  countActiveRules(config: any): number {
    let count = 0;
    if (config?.maxDailyTrades?.isActive) count++;
    if (config?.riskReward?.isActive) count++;
    if (config?.riskPerTrade?.isActive) count++;
    if (config?.daysAllowed?.isActive) count++;
    if (config?.hoursAllowed?.isActive) count++;
    if (config?.assetsAllowed?.isActive) count++;
    return count;
  }

  getActiveRuleNames(strategyId: string): string[] {
    const cached = this.strategyCacheService.getStrategy(strategyId);
    if (!cached?.configuration) return [];
    const config = cached.configuration;
    const names: string[] = [];
    if (config.maxDailyTrades?.isActive) names.push('Max Daily Trades');
    if (config.riskReward?.isActive) names.push('Risk Reward Ratio');
    if (config.riskPerTrade?.isActive) names.push('Max Risk Per Trade');
    if (config.daysAllowed?.isActive) names.push('Days Allowed');
    if (config.hoursAllowed?.isActive) names.push('Trading Hours');
    if (config.assetsAllowed?.isActive) names.push('Assets Allowed');
    return names;
  }

  getActiveStrategyIdFromCache(): string | null {
    try {
      const all = this.strategyCacheService.getAllStrategies();
      for (const [id, data] of all.entries()) {
        if (data.overview.status === true) return id;
      }
      const stored = localStorage.getItem('tradeswitch_strategies_cache');
      if (stored) {
        const arr = JSON.parse(stored) as Array<{ id: string; overview: ConfigurationOverview }>;
        const active = arr.find(item => item.overview?.status === true);
        if (active) return active.id;
      }
      return null;
    } catch {
      return null;
    }
  }

  private buildCardData(
    strategyId: string,
    overview: ConfigurationOverview,
    config: StrategyState | null,
    isFavorite = false
  ): StrategyCardData {
    const lastModified = this.formatDate(this.parseDate(overview.updated_at));
    const rules = config ? this.countActiveRules(config) : 0;
    return {
      id: strategyId,
      name: overview.name,
      status: overview.status,
      lastModified,
      rules,
      days_active: overview.days_active ?? 0,
      winRate: 0,
      isFavorite,
      created_at: overview.created_at,
      updated_at: overview.updated_at,
      userId: overview.userId ?? '',
      configurationId: overview.configurationId ?? '',
    };
  }

  async getStrategyCardData(strategy: ConfigurationOverview): Promise<StrategyCardData> {
    const strategyId = strategy.id;
    if (!strategyId) throw new Error('Strategy missing ID');
    try {
      const strategyData = await this.strategySvc.getStrategyView(strategyId);
      if (!strategyData) {
        return this.buildCardData(strategyId, strategy, null);
      }
      return this.buildCardData(
        strategyId,
        strategyData.overview,
        strategyData.configuration
      );
    } catch {
      return this.buildCardData(strategyId, strategy, null);
    }
  }

  async loadStrategyCardsData(strategies: ConfigurationOverview[]): Promise<StrategyCardData[]> {
    const result: StrategyCardData[] = [];
    for (const strategy of strategies) {
      const id = strategy.id;
      if (!id) continue;
      try {
        result.push(await this.getStrategyCardData(strategy));
      } catch {
        result.push(this.buildCardData(id, strategy, null));
      }
    }
    return result;
  }

  /**
   * Carga la card de la estrategia activa. Si activeStrategy no tiene id, intenta resolverlo desde cache.
   * preserveFavoriteFrom se usa para mantener isFavorite de la card actual.
   */
  async loadActiveStrategyCard(
    activeStrategy: ConfigurationOverview,
    preserveFavoriteFrom?: StrategyCardData
  ): Promise<StrategyCardData | null> {
    let activeStrategyId = activeStrategy?.id ?? null;
    if (!activeStrategyId) {
      activeStrategyId = this.getActiveStrategyIdFromCache();
      if (!activeStrategyId) return null;
    }
    try {
      const strategyData = await this.strategySvc.getStrategyView(activeStrategyId);
      if (!strategyData) return null;
      const isFavorite = preserveFavoriteFrom?.isFavorite ?? false;
      return this.buildCardData(
        activeStrategyId,
        strategyData.overview,
        strategyData.configuration,
        isFavorite
      );
    } catch {
      return null;
    }
  }
}
