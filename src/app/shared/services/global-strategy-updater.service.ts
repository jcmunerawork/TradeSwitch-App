import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StrategyDaysUpdaterService } from './strategy-days-updater.service';

/**
 * Service for global strategy updates.
 *
 * This service provides a high-level interface for updating strategy active
 * days. It acts as a wrapper around StrategyDaysUpdaterService, providing
 * convenient methods for updating all strategies or a single strategy.
 *
 * Features:
 * - Update all strategies for a user
 * - Update single strategy by ID
 * - Error handling and logging
 *
 * Relations:
 * - StrategyDaysUpdaterService: Performs the actual updates
 * - Used by components that need to refresh strategy days active
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class GlobalStrategyUpdaterService {
  private isBrowser: boolean;
  private updateInterval?: any;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private strategyDaysUpdater: StrategyDaysUpdaterService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  /**
   * Actualiza los días activos de la estrategia activa del usuario
   * @param userId - ID del usuario
   */
  async updateAllStrategies(userId: string): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    try {
      await this.strategyDaysUpdater.updateActiveStrategyDaysActive(userId);
    } catch (error) {
      console.error('GlobalStrategyUpdaterService: Error al actualizar estrategia activa:', error);
    }
  }

  /**
   * Actualiza una estrategia específica
   * @param strategyId - ID de la estrategia
   * @param userId - ID del usuario
   */
  async updateSingleStrategy(strategyId: string, userId: string): Promise<void> {
    try {
      await this.strategyDaysUpdater.updateStrategyDaysActive(strategyId, userId);
    } catch (error) {
      console.error('GlobalStrategyUpdaterService: Error al actualizar estrategia:', error);
    }
  }
}
