import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CalendarDay } from '../../models/report.model';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';
import { GroupedTradeFinal } from '../../models/report.model';
import { ConfigurationOverview } from '../../../strategy/models/strategy.model';

/**
 * Interface representing a trade detail for display in the popup.
 *
 * @interface TradeDetail
 */
export interface TradeDetail {
  positionOpened: string; // Date and time when position was opened
  positionClosed: string; // Date and time when position was closed
  ticker: string;
  side: 'Long' | 'Short';
  netPnl: number;
  followedStrategy: boolean;
  strategyName: string;
}

/**
 * Component for displaying trades in a popup modal.
 *
 * This component displays detailed information about trades for a selected day,
 * including trade time, ticker, side (Long/Short), PnL, and strategy compliance.
 *
 * Features:
 * - Displays all trades for a selected calendar day
 * - Shows trade details: time, ticker, side, PnL
 * - Indicates if trades followed a strategy
 * - Color-coded tickers and PnL values
 * - Formatted currency and percentage values
 *
 * Relations:
 * - CalendarComponent: Receives selected day data
 * - NumberFormatterService: Value formatting
 *
 * @component
 * @selector app-trades-popup
 * @standalone true
 */
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

    (this.selectedDay.trades);
    
    // Convertir trades del día a formato de detalle
    this.trades = this.selectedDay.trades.map((trade, index) => {
      // Position Opened: usar createdDate (cuando se abrió la posición)
      const openedDate = trade.createdDate 
        ? new Date(Number(trade.createdDate))
        : new Date(Number(trade.lastModified)); // Fallback a lastModified si no hay createdDate
      
      // Position Closed: usar closedDate (nuevo campo del backend) o lastModified como fallback
      const closedDate = (trade as any).closedDate 
        ? new Date(Number((trade as any).closedDate))
        : new Date(Number(trade.lastModified)); // Fallback a lastModified si no hay closedDate
      
      return {
        positionOpened: this.formatDateTime(openedDate),
        positionClosed: this.formatDateTime(closedDate),
        ticker: trade.instrument ?? 'N/A',
        side: this.determineSide(trade),
        netPnl: trade.pnl ?? 0,
        followedStrategy: this.selectedDay?.followedStrategy ?? false,
        strategyName: this.getStrategyNameForTrade(trade)
      };
    });

    // Ordenar por tiempo de cierre (más reciente primero)
    this.trades.sort((a, b) => b.positionClosed.localeCompare(a.positionClosed));
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

  /**
   * Format date and time for position opened/closed display
   * Format: "MM/DD/YYYY HH:MM:SS"
   */
  formatDateTime(date: Date): string {
    const dateStr = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    return `${dateStr} ${timeStr}`;
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
    // Sort by position closed time (most recent first)
    this.trades.sort((a, b) => b.positionClosed.localeCompare(a.positionClosed));
  }

  onFilter() {
    // Implementar lógica de filtrado
    ('Filter clicked');
  }

  formatCurrency(value: number): string {
    return this.numberFormatter.formatCurrency(value);
  }

  formatPercentage(value: number): string {
    return this.numberFormatter.formatPercentage(value);
  }
}
