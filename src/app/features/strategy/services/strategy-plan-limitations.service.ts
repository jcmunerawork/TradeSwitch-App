import { Injectable } from '@angular/core';
import { PlanLimitationsGuard } from '../../../core/guards';

export type CreateStrategyButtonState = 'available' | 'plan_reached' | 'block';

export interface StrategyPlanLimitationsState {
  showPlanBanner: boolean;
  planBannerMessage: string;
  planBannerType: 'info' | 'warning' | 'success';
  isAddStrategyDisabled: boolean;
  allowsMultipleStrategies: boolean;
}

/**
 * Centraliza la lógica de limitaciones del plan para la pantalla de estrategias:
 * banner, botón "Add Strategy" y flag de múltiples estrategias.
 * El componente llama refresh() y lee el estado desde getState().
 */
@Injectable({
  providedIn: 'root',
})
export class StrategyPlanLimitationsService {
  private state: StrategyPlanLimitationsState = {
    showPlanBanner: false,
    planBannerMessage: '',
    planBannerType: 'info',
    isAddStrategyDisabled: true,
    allowsMultipleStrategies: false,
  };

  private lastButtonState: CreateStrategyButtonState | null = null;

  constructor(private planLimitationsGuard: PlanLimitationsGuard) {}

  /**
   * Aplica el estado del botón crear estrategia que viene del backend.
   * available: botón habilitado, sin banner. plan_reached: redirigir a upgrade. block: botón deshabilitado.
   */
  setButtonState(button_state: CreateStrategyButtonState): void {
    this.lastButtonState = button_state;
    if (button_state === 'block') {
      this.state.isAddStrategyDisabled = true;
      this.state.showPlanBanner = true;
      this.state.planBannerMessage = `You've reached the maximum number of strategies (8).`;
      this.state.planBannerType = 'warning';
      this.state.allowsMultipleStrategies = false;
    } else if (button_state === 'plan_reached') {
      this.state.isAddStrategyDisabled = false;
      this.state.showPlanBanner = true;
      this.state.planBannerMessage = `You've reached the strategy limit for your plan. Move to a higher plan and keep growing your account.`;
      this.state.planBannerType = 'warning';
      this.state.allowsMultipleStrategies = true;
    } else {
      this.state.isAddStrategyDisabled = false;
      this.state.showPlanBanner = false;
      this.state.planBannerMessage = '';
      this.state.planBannerType = 'info';
      this.state.allowsMultipleStrategies = true;
    }
  }

  getState(): StrategyPlanLimitationsState {
    return { ...this.state };
  }

  get showPlanBanner(): boolean { return this.state.showPlanBanner; }
  get planBannerMessage(): string { return this.state.planBannerMessage; }
  get planBannerType(): 'info' | 'warning' | 'success' { return this.state.planBannerType; }
  get isAddStrategyDisabled(): boolean { return this.state.isAddStrategyDisabled; }
  get allowsMultipleStrategies(): boolean { return this.state.allowsMultipleStrategies; }

  /**
   * Actualiza el estado. Si se pasa button_state (del backend), se usa ese; si no, se usa lógica de plan.
   */
  async refresh(
    userId: string | null,
    accountsLength: number,
    getTotalStrategiesCount: () => Promise<number>,
    button_state?: CreateStrategyButtonState
  ): Promise<void> {
    try {
      if (!userId) {
        this.applyState(null, 0, accountsLength);
        return;
      }
      if (accountsLength === 0) {
        // Sin cuentas: botón habilitado para que al hacer clic redirija a añadir trading account
        this.state = {
          showPlanBanner: false,
          planBannerMessage: '',
          planBannerType: 'info',
          isAddStrategyDisabled: false,
          allowsMultipleStrategies: false,
        };
        this.lastButtonState = null;
        return;
      }
      if (button_state != null) {
        this.setButtonState(button_state);
        return;
      }
      if (this.lastButtonState != null) {
        this.setButtonState(this.lastButtonState);
        return;
      }
      const limitations = await this.planLimitationsGuard.checkUserLimitations(userId);
      const totalStrategies = await getTotalStrategiesCount();
      this.applyState(limitations, totalStrategies, accountsLength);
    } catch (error) {// 
      this.state = {
        showPlanBanner: false,
        planBannerMessage: '',
        planBannerType: 'info',
        isAddStrategyDisabled: true,
        allowsMultipleStrategies: false,
      };
    }
  }

  /**
   * Solo actualiza el estado del botón Add Strategy. Si tenemos button_state del backend, lo usamos.
   */
  async refreshButtonOnly(userId: string | null, accountsLength: number, getTotalStrategiesCount: () => Promise<number>): Promise<void> {
    if (!userId) {
      this.state.isAddStrategyDisabled = true;
      return;
    }
    if (accountsLength === 0) {
      this.state.isAddStrategyDisabled = false;
      return;
    }
    if (this.lastButtonState != null) {
      this.setButtonState(this.lastButtonState);
      return;
    }
    try {
      const total = await getTotalStrategiesCount();
      this.state.isAddStrategyDisabled = total >= 8;
    } catch {
      this.state.isAddStrategyDisabled = true;
    }
  }

  private applyState(
    limitations: { planName: string; maxStrategies: number; needsSubscription?: boolean; isBanned?: boolean; isCancelled?: boolean } | null,
    totalStrategies: number,
    accountsLength: number
  ): void {
    this.state.allowsMultipleStrategies = limitations ? limitations.maxStrategies > 1 : false;
    this.state.showPlanBanner = false;
    this.state.planBannerMessage = '';
    this.state.planBannerType = 'info';

    if (!limitations) {
      this.state.isAddStrategyDisabled = accountsLength === 0;
      return;
    }

    if (limitations.needsSubscription || limitations.isBanned || limitations.isCancelled) {
      this.state.isAddStrategyDisabled = true;
      this.state.allowsMultipleStrategies = false;
      if (accountsLength > 0) {
        this.state.showPlanBanner = true;
        this.state.planBannerMessage = this.getBlockedMessage(limitations);
        this.state.planBannerType = 'warning';
      }
      return;
    }

    if (totalStrategies >= 8) {
      this.state.isAddStrategyDisabled = true;
      this.state.showPlanBanner = true;
      this.state.planBannerMessage = `You've reached the maximum number of strategies (8).`;
      this.state.planBannerType = 'warning';
    } else if (totalStrategies >= limitations.maxStrategies) {
      this.state.isAddStrategyDisabled = false;
      this.state.showPlanBanner = true;
      this.state.planBannerMessage = `You've reached the strategy limit for your ${limitations.planName} plan. Move to a higher plan and keep growing your account.`;
      this.state.planBannerType = 'warning';
    } else {
      this.state.isAddStrategyDisabled = false;
      this.state.showPlanBanner = false;
    }
  }

  private getBlockedMessage(limitations: { isBanned?: boolean; isCancelled?: boolean; needsSubscription?: boolean }): string {
    if (limitations.isBanned) {
      return 'Your account has been banned. Please contact support for assistance.';
    }
    if (limitations.isCancelled) {
      return 'Your subscription has been cancelled. Please purchase a plan to access this functionality.';
    }
    if (limitations.needsSubscription) {
      return 'You need to purchase a plan to access this functionality.';
    }
    return 'Access denied. Please contact support for assistance.';
  }
}
