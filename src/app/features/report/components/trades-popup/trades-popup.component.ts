import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CalendarDay } from '../../models/report.model';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';
import { GroupedTradeFinal } from '../../models/report.model';
import { ConfigurationOverview } from '../../../strategy/models/strategy.model';

export interface TradeDetail {
  openTime: string;
  ticker: string;
  side: 'Long' | 'Short';
  netPnl: number;
  followedStrategy: boolean;
  strategyName: string;
}

@Component({
  selector: 'app-trades-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trades-popup.component.html',
  styleUrls: ['./trades-popup.component.scss']
})
export class TradesPopupComponent {
  @Input() visible: boolean = false;
  @Input() selectedDay: CalendarDay | null = null;
  @Input() strategies: ConfigurationOverview[] = [];
  @Output() close = new EventEmitter<void>();

  trades: TradeDetail[] = [];
  netPnl: number = 0;
  netRoi: number = 0;
  private numberFormatter = new NumberFormatterService();
  selectedDate: string = '';

  // Expose Math to template
  Math = Math;

  ngOnChanges() {
    if (this.selectedDay && this.visible) {
      this.loadTradesData();
    }
  }

  loadTradesData() {
    if (!this.selectedDay) return;

    this.selectedDate = this.formatDate(this.selectedDay.date);
    this.netPnl = this.selectedDay.pnlTotal;

    console.log(this.selectedDay.trades);
    
    // Convertir trades del día a formato de detalle
    this.trades = this.selectedDay.trades.map((trade, index) => ({
      openTime: this.formatTime(new Date(Number(trade.lastModified))),
      ticker: trade.instrument ?? 'N/A',
      side: this.determineSide(trade),
      netPnl: trade.pnl ?? 0,
      followedStrategy: this.selectedDay?.followedStrategy ?? false,
      strategyName: this.getStrategyNameForTrade(trade)
    }));

    // Ordenar por tiempo (más reciente primero)
    this.trades.sort((a, b) => b.openTime.localeCompare(a.openTime));
  }

  formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }

  determineSide(trade: GroupedTradeFinal): 'Long' | 'Short' {
    // Usar el campo side real del trade para determinar Long/Short
    if (trade.side === 'buy') {
      return 'Long';
    } else if (trade.side === 'sell') {
      return 'Short';
    }
    // Fallback basado en PnL si no hay side
    return (trade.pnl ?? 0) >= 0 ? 'Long' : 'Short';
  }

  getStrategyNameForTrade(trade: GroupedTradeFinal): string {
    // Si no se siguió estrategia, no mostrar nombre
    if (!this.selectedDay?.followedStrategy) {
      return '';
    }

    if (!this.strategies || this.strategies.length === 0) {
      return '-';
    }

    const tradeDate = new Date(Number(trade.lastModified));
    const today = new Date();
    today.setHours(23, 59, 59, 999); // 11:59 PM del día actual
    
    // Buscar la estrategia que estaba activa en la fecha del trade
    for (const strategy of this.strategies) {
      // IMPORTANTE: NO filtrar estrategias eliminadas aquí
      // Las estrategias eliminadas (soft delete) SÍ deben considerarse
      // porque en el momento del trade existían y podrían haber sido seguidas
      
      if (strategy.dateActive && strategy.dateActive.length > 0) {
        // Revisar cada período de activación de esta estrategia
        for (let i = 0; i < strategy.dateActive.length; i++) {
          const activeDate = new Date(strategy.dateActive[i]);
          let inactiveDate: Date;
          
          // Si hay fecha de desactivación correspondiente, usarla
          if (strategy.dateInactive && strategy.dateInactive.length > i) {
            inactiveDate = new Date(strategy.dateInactive[i]);
          } else {
            // No hay fecha de desactivación, verificar si está activa actualmente
            // Si dateActive tiene más elementos que dateInactive, está activa
            const isCurrentlyActive = strategy.dateActive.length > (strategy.dateInactive?.length || 0);
            if (isCurrentlyActive) {
              inactiveDate = today;
            } else {
              continue; // Esta activación ya fue desactivada
            }
          }
          
          // Verificar si el trade está dentro de este rango de actividad
          if (tradeDate >= activeDate && tradeDate <= inactiveDate) {
            return strategy.name;
          }
        }
      }
    }
    
    return '-';
  }

  getTickerColor(ticker: string): string {
    // Asignar colores a diferentes tickers con transparencia
    const colors: { [key: string]: string } = {
      'YM': 'rgba(139, 92, 246, 0.8)',
      'MYM': 'rgba(139, 92, 246, 0.6)',
      'ES': 'rgba(59, 130, 246, 0.8)',
      'NQ': 'rgba(16, 185, 129, 0.8)',
      'RTY': 'rgba(245, 158, 11, 0.8)'
    };
    return colors[ticker] || 'rgba(107, 114, 128, 0.8)';
  }

  getPnlColor(pnl: number): string {
    return pnl >= 0 ? '#10B981' : '#EF4444';
  }

  getStrategyIcon(followed: boolean): string {
    return followed ? 'icon-check-box' : 'icon-uncheck-box';
  }

  getStrategyColor(followed: boolean): string {
    return followed ? '#10B981' : '#EF4444';
  }

  onClose() {
    this.close.emit();
  }

  onSortByTime() {
    // Implementar lógica de ordenamiento
    this.trades.sort((a, b) => b.openTime.localeCompare(a.openTime));
  }

  onFilter() {
    // Implementar lógica de filtrado
    console.log('Filter clicked');
  }

  formatCurrency(value: number): string {
    return this.numberFormatter.formatCurrency(value);
  }

  formatPercentage(value: number): string {
    return this.numberFormatter.formatPercentage(value);
  }
}
