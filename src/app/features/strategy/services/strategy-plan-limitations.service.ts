import { Injectable } from '@angular/core';
import { PlanLimitationsGuard } from '../../../core/guards';

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

  constructor(private planLimitationsGuard: PlanLimitationsGuard) {}

  getState(): StrategyPlanLimitationsState {
    return { ...this.state };
  }

  get showPlanBanner(): boolean { return this.state.showPlanBanner; }
  get planBannerMessage(): string { return this.state.planBannerMessage; }
  get planBannerType(): 'info' | 'warning' | 'success' { return this.state.planBannerType; }
  get isAddStrategyDisabled(): boolean { return this.state.isAddStrategyDisabled; }
  get allowsMultipleStrategies(): boolean { return this.state.allowsMultipleStrategies; }

  /**
   * Actualiza el estado según userId, número de cuentas y total de estrategias.
   * getTotalStrategiesCount debe ser una función que devuelva el conteo actual (p. ej. desde el componente).
   */
  async refresh(
    userId: string | null,
    accountsLength: number,
    getTotalStrategiesCount: () => Promise<number>
  ): Promise<void> {
    try {
      if (!userId) {
        this.applyState(null, 0, accountsLength);
        return;
      }
      if (accountsLength === 0) {
        this.state = {
          showPlanBanner: false,
          planBannerMessage: '',
          planBannerType: 'info',
          isAddStrategyDisabled: true,
          allowsMultipleStrategies: false,
        };
        return;
      }
      const limitations = await this.planLimitationsGuard.checkUserLimitations(userId);
      const totalStrategies = await getTotalStrategiesCount();
      this.applyState(limitations, totalStrategies, accountsLength);
    } catch (error) {
      console.error('❌ checkPlanLimitations: Error checking plan limitations:', error);
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
   * Solo actualiza el estado del botón Add Strategy (p. ej. cuando se alcanza el máximo absoluto 8).
   */
  async refreshButtonOnly(userId: string | null, accountsLength: number, getTotalStrategiesCount: () => Promise<number>): Promise<void> {
    if (!userId || accountsLength === 0) {
      this.state.isAddStrategyDisabled = true;
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
