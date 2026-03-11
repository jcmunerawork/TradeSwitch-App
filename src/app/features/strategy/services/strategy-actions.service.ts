import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ConfigurationOverview, StrategyState } from '../models/strategy.model';
import { SettingsService } from '../service/strategy.service';
import { PlanLimitationsGuard } from '../../../core/guards';
import { AlertService } from '../../../core/services';
import { ToastNotificationService } from '../../../shared/services/toast-notification.service';

export type CopyStrategyResult = 'success' | 'limit_reached' | 'navigate_plan' | 'not_found';

/**
 * Service for strategy actions: activate, delete (mark deleted), copy.
 * Encapsulates the business logic and API calls; the component handles UI state and refresh.
 */
@Injectable({ providedIn: 'root' })
export class StrategyActionsService {

  constructor(
    private strategySvc: SettingsService,
    private planLimitationsGuard: PlanLimitationsGuard,
    private alertService: AlertService,
    private toastService: ToastNotificationService,
    private router: Router
  ) {}

  /**
   * Activa una estrategia (endpoint transaccional en backend).
   */
  async activateStrategy(userId: string, strategyId: string): Promise<void> {
    await this.strategySvc.activateStrategyView(userId, strategyId);
  }

  /**
   * Marca la estrategia como eliminada (soft delete).
   */
  async markStrategyAsDeleted(strategyId: string): Promise<void> {
    await this.strategySvc.markStrategyAsDeleted(strategyId);
  }

  /**
   * Copia una estrategia. Verifica límites del plan, genera nombre único y crea la copia.
   * @returns 'success' | 'limit_reached' | 'navigate_plan' | 'not_found'
   */
  async copyStrategy(
    userId: string,
    strategyId: string,
    userStrategies: ConfigurationOverview[],
    activeStrategy: ConfigurationOverview | null,
    getTotalStrategiesCount: () => Promise<number>,
    setAddStrategyDisabled?: (disabled: boolean) => void
  ): Promise<CopyStrategyResult> {
    const totalStrategies = await getTotalStrategiesCount();
    const accessCheck = await this.planLimitationsGuard.checkStrategyCreationWithModal(userId, totalStrategies);

    if (!accessCheck.canCreate) {
      const limitations = await this.planLimitationsGuard.checkUserLimitations(userId);
      const isProPlanWithMaxStrategies =
        limitations.planName.toLowerCase().includes('pro') &&
        limitations.maxStrategies === 8 &&
        totalStrategies >= 8;

      if (isProPlanWithMaxStrategies) {
        setAddStrategyDisabled?.(true);
        this.alertService.showWarning(
          'You have reached the maximum number of strategies (8) for your Pro plan.',
          'Strategy Limit Reached'
        );
        return 'limit_reached';
      }
      this.router.navigate(['/account'], { queryParams: { tab: 'plan' } });
      return 'navigate_plan';
    }

    let strategy = userStrategies.find(s => s.id === strategyId);
    if (!strategy && activeStrategy?.id === strategyId) {
      strategy = activeStrategy;
    }
    if (!strategy) {// 
      return 'not_found';
    }

    const activeStrategyId = activeStrategy?.id;
    const isActiveStrategy = !!(activeStrategy && activeStrategyId === strategyId);
    const allStrategies = [...(activeStrategy ? [activeStrategy] : []), ...userStrategies];
    const newName = this.strategySvc.generateUniqueStrategyName(strategy.name, allStrategies);

    const strategyToCopyId = strategy.id;
    if (!strategyToCopyId) {// 
      return 'not_found';
    }

    const strategyData = await this.strategySvc.getStrategyView(strategyToCopyId);
    if (!strategyData?.configuration) {// 
      return 'not_found';
    }

    const strategyConfig: StrategyState = { ...strategyData.configuration };
    await this.strategySvc.createStrategyView(
      userId,
      newName,
      strategyConfig,
      isActiveStrategy ? false : undefined
    );

    // El backend crea la copia como inactiva si isActiveStrategy; timeline lo gestiona el backend
    return 'success';
  }

  /**
   * Actualiza el nombre de una estrategia.
   */
  async updateStrategyName(strategyId: string, newName: string): Promise<void> {
    if (!newName.trim()) {
      this.alertService.showWarning('Please enter a valid strategy name', 'Invalid Strategy Name');
      return;
    }
    await this.strategySvc.updateStrategyView(strategyId, { name: newName.trim() });
  }
}
