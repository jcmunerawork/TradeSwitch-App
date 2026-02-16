import { Injectable } from '@angular/core';
import { ConfigurationOverview } from '../models/strategy.model';
import { SettingsService } from '../service/strategy.service';

/**
 * Conteo de estrategias del usuario en configuration-overview (todas activas).
 * Usa backend cuando hay userId; fallback a conteo local.
 */
@Injectable({
  providedIn: 'root',
})
export class StrategyCountService {
  constructor(private strategySvc: SettingsService) {}

  async getTotalStrategiesCount(
    userId: string | null,
    userStrategies: ConfigurationOverview[],
    activeStrategy: ConfigurationOverview | null
  ): Promise<number> {
    if (!userId) {
      return this.countLocal(userStrategies, activeStrategy);
    }
    try {
      return await this.strategySvc.getAllLengthConfigurationsOverview(userId);
    } catch (error) {
      console.error('❌ getTotalStrategiesCount: Error from backend, using local count:', error);
      return this.countLocal(userStrategies, activeStrategy);
    }
  }

  private countLocal(
    userStrategies: ConfigurationOverview[],
    activeStrategy: ConfigurationOverview | null
  ): number {
    const ids = new Set<string>();
    userStrategies.forEach(s => {
      if (s.id) ids.add(s.id);
    });
    if (activeStrategy?.id) ids.add(activeStrategy.id);
    return ids.size;
  }
}
