import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AppContextService } from '../../../shared/context';
import { ConfigurationOverview } from '../models/strategy.model';
import { StrategyFilterService } from './strategy-filter.service';

export interface StrategyContextBridgeHandlers {
  setUser: (user: any) => void;
  setAccounts: (accounts: any[]) => void;
  setUserStrategies: (strategies: ConfigurationOverview[]) => void;
  setLoading: (loading: { strategies?: boolean }) => void;
  onErrors: (errors: { strategies?: string }) => void;
  onPlanChange: () => void | Promise<void>;
  getActiveStrategyId: () => string | null;
  getCurrentUserStrategiesLength: () => number;
  /** Opcional: cuando cambia el número de cuentas (para recargar estrategias si aplica). */
  onAccountsCountChange?: (newCount: number) => void;
}

/**
 * Suscripciones al AppContext (user, accounts, strategies, loading, errors, plan).
 * Filtra strategies (excluye eliminadas y activa) y actualiza StrategyFilterService.
 * El componente pasa un objeto con callbacks y recibe las actualizaciones.
 */
@Injectable({
  providedIn: 'root',
})
export class StrategyContextBridgeService {
  constructor(
    private appContext: AppContextService,
    private strategyFilterService: StrategyFilterService
  ) {}

  subscribe(handlers: StrategyContextBridgeHandlers): Subscription[] {
    const subs: Subscription[] = [];

    subs.push(
      this.appContext.currentUser$.subscribe(user => handlers.setUser(user))
    );

    let previousAccountsCount = 0;
    subs.push(
      this.appContext.userAccounts$.subscribe(async accounts => {
        const current = accounts?.length ?? 0;
        handlers.setAccounts(accounts ?? []);
        if (previousAccountsCount !== current) {
          await handlers.onPlanChange();
          handlers.onAccountsCountChange?.(current);
        }
        previousAccountsCount = current;
      })
    );

    subs.push(
      this.appContext.userStrategies$.pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => a?.length === b?.length)
      ).subscribe(async strategies => {
        if (strategies.length === 0 && handlers.getCurrentUserStrategiesLength() > 0) return;
        const activeId = handlers.getActiveStrategyId();
        const filtered = (strategies ?? []).filter(s => {
          if (s.deleted === true) return false;
          if (activeId && (s.id ?? '') === activeId) return false;
          return true;
        });
        handlers.setUserStrategies(filtered);
        this.strategyFilterService.setStrategies(filtered);
        await handlers.onPlanChange();
      })
    );

    subs.push(
      this.appContext.isLoading$.subscribe(loading => handlers.setLoading(loading))
    );

    subs.push(
      this.appContext.errors$.subscribe(errors => {
        if (errors?.strategies) console.error('Error en estrategias:', errors.strategies);
        const e = errors ?? {};
        handlers.onErrors({ strategies: e.strategies ?? undefined });
      })
    );

    subs.push(
      this.appContext.userPlan$.pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) =>
          a?.planName === b?.planName && a?.maxStrategies === b?.maxStrategies && a?.maxAccounts === b?.maxAccounts)
      ).subscribe(async plan => {
        if (plan) await handlers.onPlanChange();
      })
    );

    return subs;
  }
}
