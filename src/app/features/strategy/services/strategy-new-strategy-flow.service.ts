import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { PlanLimitationsGuard } from '../../../core/guards';
import { AlertService } from '../../../core/services';

export interface RunNewStrategyFlowParams {
  userId: string;
  accountsLength: number;
  getTotalStrategiesCount: () => Promise<number>;
  showStrategyGuide: () => void;
  createGenericStrategy: () => Promise<void>;
  /** Estado del botón desde el backend: available | plan_reached | block */
  button_state: 'available' | 'plan_reached' | 'block';
}

export type RunNewStrategyFlowResult = 'show_guide' | 'created' | 'redirect_accounts' | 'redirect_plan' | 'max_reached';

/**
 * Flujo de "Add Strategy": validar cuentas, límites, plan y decidir si mostrar guía,
 * crear estrategia genérica o redirigir a account/plan.
 */
@Injectable({
  providedIn: 'root',
})
export class StrategyNewStrategyFlowService {
  constructor(
    private router: Router,
    private planLimitationsGuard: PlanLimitationsGuard,
    private alertService: AlertService
  ) {}

  async run(params: RunNewStrategyFlowParams): Promise<RunNewStrategyFlowResult> {
    const { userId, accountsLength, getTotalStrategiesCount, showStrategyGuide, createGenericStrategy, button_state } = params;

    if (button_state === 'block') {
      return 'max_reached';
    }
    // Sin cuentas: redirigir a la página de trading accounts para añadir una
    if (accountsLength === 0) {
      this.alertService.showWarning(
        'You need to add a trading account before creating strategies.',
        'No Trading Accounts'
      );
      this.router.navigate(['/trading-accounts']);
      return 'redirect_accounts';
    }
    if (button_state === 'plan_reached') {
      await new Promise(r => setTimeout(r, 500));
      this.router.navigate(['/account'], { queryParams: { tab: 'plan' } });
      return 'redirect_plan';
    }

    const totalStrategies = await getTotalStrategiesCount();
    if (totalStrategies >= 8) return 'max_reached';

    const limitations = await this.planLimitationsGuard.checkUserLimitations(userId);
    if (totalStrategies >= limitations.maxStrategies) {
      await new Promise(r => setTimeout(r, 500));
      this.router.navigate(['/account'], { queryParams: { tab: 'plan' } });
      return 'redirect_plan';
    }

    const accessCheck = await this.planLimitationsGuard.checkStrategyCreationWithModal(userId, totalStrategies);
    if (!accessCheck.canCreate) {
      await new Promise(r => setTimeout(r, 500));
      this.router.navigate(['/account'], { queryParams: { tab: 'plan' } });
      return 'redirect_plan';
    }

    if (totalStrategies === 0) {
      showStrategyGuide();
      return 'show_guide';
    }

    await createGenericStrategy();
    return 'created';
  }
}
