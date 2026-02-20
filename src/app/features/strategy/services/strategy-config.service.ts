import { Injectable } from '@angular/core';
import { initialStrategyState } from '../store/strategy.reducer';
import { StrategyCacheService } from './strategy-cache.service';
import { ConfigurationOverview } from '../models/strategy.model';

/**
 * Carga la configuración (reglas) a mostrar según la estrategia activa y el balance.
 * Solo lectura desde cache; no hace peticiones.
 */
@Injectable({
  providedIn: 'root',
})
export class StrategyConfigService {
  constructor(private strategyCacheService: StrategyCacheService) {}

  loadConfig(balance: number, activeStrategy: ConfigurationOverview | null): any {
    if (!activeStrategy?.id) {
      return {
        ...initialStrategyState,
        riskPerTrade: { ...initialStrategyState.riskPerTrade, balance },
      };
    }
    const cached = this.strategyCacheService.getStrategy(activeStrategy.id);
    if (!cached) return initialStrategyState;
    return {
      ...cached.configuration,
      riskPerTrade: {
        ...cached.configuration.riskPerTrade,
        balance,
      },
    };
  }
}
