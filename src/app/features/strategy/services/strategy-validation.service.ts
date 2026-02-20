import { Injectable } from '@angular/core';
import { ConfigurationOverview } from '../models/strategy.model';
import { SettingsService } from '../service/strategy.service';
import { AlertService } from '../../../core/services';
import { ToastNotificationService } from '../../../shared/services/toast-notification.service';

/**
 * Service for strategy-related validations.
 * Used by StrategyComponent to resolve and validate strategy IDs before navigation or actions.
 */
@Injectable({ providedIn: 'root' })
export class StrategyValidationService {

  constructor(
    private strategySvc: SettingsService,
    private alertService: AlertService,
    private toastService: ToastNotificationService
  ) {}

  /**
   * Resuelve y valida el ID de estrategia (soporta '1' o vacío usando la estrategia activa).
   * Muestra alertas y retorna null si no hay estrategia válida.
   */
  async validateAndResolveStrategyId(
    strategyId: string,
    activeStrategy: ConfigurationOverview | null,
    getStrategyId: (s: ConfigurationOverview) => string
  ): Promise<string | null> {
    if ((strategyId === '1' || !strategyId) && activeStrategy) {
      const activeStrategyId = getStrategyId(activeStrategy);
      if (activeStrategyId) {
        strategyId = activeStrategyId;
      } else {
        this.alertService.showWarning('No strategy found. Please create a strategy first.', 'No Strategy Found');
        return null;
      }
    }
    if (!strategyId || strategyId === '1') {
      this.alertService.showWarning('No strategy found. Please create a strategy first.', 'No Strategy Found');
      return null;
    }
    const isValid = await this.validateStrategyExists(strategyId);
    return isValid ? strategyId : null;
  }

  /**
   * Valida que la estrategia existe y tiene overview y configuración.
   * Muestra mensajes de error y retorna false en caso contrario.
   */
  async validateStrategyExists(strategyId: string): Promise<boolean> {
    try {
      const strategyData = await this.strategySvc.getStrategyView(strategyId);

      if (!strategyData) {
        this.toastService.showError('Strategy not found. The strategy may have been deleted or does not exist.');
        return false;
      }

      if (!strategyData.overview) {
        this.toastService.showError('Strategy overview not found. The strategy metadata is missing.');
        return false;
      }

      if (!strategyData.configuration) {
        this.toastService.showError('Strategy configuration not found. The strategy rules are missing.');
        return false;
      }

      return true;
    } catch (error: unknown) {
      const err = error as { status?: number };
      console.error('Error validating strategy:', error);
      if (err?.status === 404) {
        this.toastService.showError('Strategy not found. The strategy may have been deleted or does not exist.');
      } else {
        this.toastService.showBackendError(error, 'Error loading strategy');
      }
      return false;
    }
  }
}
