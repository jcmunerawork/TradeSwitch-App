import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Subscription, combineLatest } from 'rxjs';
import { selectTradeWin, selectTotalTrades, selectNetPnL } from '../../report/store/report.selectors';

/**
 * Puente entre el store de reporte (tradeWin, totalTrades, netPnL) y el componente de estrategias.
 * El componente pasa un callback que recibe los valores y actualiza la card.
 */
@Injectable({
  providedIn: 'root',
})
export class StrategyReportBridgeService {
  constructor(private store: Store) {}

  subscribe(callback: (data: { tradeWin: number; totalTrades: number; netPnL: number }) => void): Subscription {
    return combineLatest({
      tradeWin: this.store.select(selectTradeWin),
      totalTrades: this.store.select(selectTotalTrades),
      netPnL: this.store.select(selectNetPnL),
    }).subscribe(callback);
  }
}
