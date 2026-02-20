import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

const STRATEGY_ROUTES = ['/strategy', '/'];
const DELAY_MS = 300;

/**
 * Gestiona el listener de navegación a /strategy o / y ejecuta recarga desde backend o cache
 * según estado actual (cuentas, cache, estrategias en UI).
 */
@Injectable({
  providedIn: 'root',
})
export class StrategyNavigationService {
  constructor(private router: Router) {}

  private static readonly CACHE_MAX_AGE_MS = 5 * 60 * 1000;

  register(handlers: {
    invalidateAndReload: () => Promise<void>;
    loadFromCache: () => Promise<void>;
    getCacheSize: () => number;
    getCacheTimestamp: () => number | null;
    getAccountsLength: () => number;
    hasStrategiesInUI: () => boolean;
    hasActiveStrategy: () => boolean;
  }): Subscription {
    return this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.url ?? '';
      const urlAfter = event.urlAfterRedirects ?? '';
      if (!STRATEGY_ROUTES.some(r => url === r || urlAfter === r)) return;
      setTimeout(() => {
        const accountsLength = handlers.getAccountsLength();
        const cacheSize = handlers.getCacheSize();
        const ts = handlers.getCacheTimestamp();
        const isCacheValid = ts != null && Date.now() - ts < StrategyNavigationService.CACHE_MAX_AGE_MS;
        const hasStrategies = handlers.hasStrategiesInUI();
        const hasActive = handlers.hasActiveStrategy();
        if (accountsLength > 0 && (cacheSize === 0 || !isCacheValid || (!hasStrategies && !hasActive))) {
          handlers.invalidateAndReload();
        } else if (cacheSize > 0 && isCacheValid && (!hasStrategies || !hasActive)) {
          handlers.loadFromCache();
        }
      }, DELAY_MS);
    });
  }
}
