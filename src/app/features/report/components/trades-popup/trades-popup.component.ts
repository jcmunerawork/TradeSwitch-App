import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CalendarDay } from '../../models/report.model';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';
import { GroupedTradeFinal } from '../../models/report.model';
import { ConfigurationOverview } from '../../../strategy/models/strategy.model';
import { ReportService } from '../../service/report.service';
import { AppContextService } from '../../../../shared/context';

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
  originalTrades: TradeDetail[] = [];
  isReversed: boolean = false;
  netPnl: number = 0;
  netRoi: number = 0;
  private numberFormatter = new NumberFormatterService();
  selectedDate: string = '';

  Math = Math;

  constructor(
    private reportService: ReportService,
    private appContext: AppContextService
  ) {}

  ngOnChanges() {
    if (this.selectedDay && this.visible) {
      this.loadTradesData();
    }
  }

  async loadTradesData() {
    if (!this.selectedDay) return;

    this.selectedDate = this.formatDate(this.selectedDay.date);
    this.netPnl = this.selectedDay.pnlTotal;
    
    // Obtener cache de instrumentos una sola vez para todos los trades del día
    const accounts = this.appContext.userAccounts();
    let instrumentsCache: any[] | null = null;
    
    if (accounts && accounts.length > 0) {
      const currentAccount = accounts[0];
      const accountId = currentAccount.accountID;
      instrumentsCache = this.getInstrumentsFromCache(accountId);
    }
    
    // Convertir trades del día a formato de detalle (sin ordenar, aparecen como llegan)
    this.trades = this.selectedDay.trades.map((trade) => {
      const openedDate = trade.createdDate 
        ? new Date(Number(trade.createdDate))
        : new Date(Number(trade.lastModified));
      
      const closedDate = (trade as any).closedDate 
        ? new Date(Number((trade as any).closedDate))
        : new Date(Number(trade.lastModified));
      
      // Obtener nombre del instrumento desde la cache
      let instrumentName = trade.instrument ?? 'N/A';
      
      // Si el instrument es un número (ID) o no es un nombre válido, buscarlo en la cache
      if (trade.tradableInstrumentId && instrumentsCache) {
        const isNumericId = !isNaN(Number(instrumentName)) || instrumentName === trade.tradableInstrumentId;
        
        if (isNumericId || !instrumentName || instrumentName === 'N/A') {
          // Buscar en la cache comparando el tradableInstrumentId con el id de cada instrumento
          const instrumentId = Number(trade.tradableInstrumentId);
          const cachedInstrument = instrumentsCache.find(
            (inst: any) => inst.id === instrumentId
          );
          
          if (cachedInstrument && cachedInstrument.name) {
            instrumentName = cachedInstrument.name;
          } else {
            // Si no se encuentra en cache, usar el ID como fallback
            instrumentName = trade.tradableInstrumentId;
          }
        }
      }
      
      return {
        positionOpened: this.formatDateTime(openedDate),
        positionClosed: this.formatDateTime(closedDate),
        ticker: instrumentName,
        side: this.determineSide(trade),
        netPnl: trade.pnl ?? 0,
        followedStrategy: this.selectedDay?.followedStrategy ?? false,
        strategyName: this.getStrategyNameForTrade(trade)
      };
    });

    // Guardar orden original (sin ordenar, aparecen como llegan)
    this.originalTrades = [...this.trades];
    this.isReversed = false;
  }

  /**
   * Obtener instrumentos desde localStorage cache
   * Los instrumentos son iguales para todas las cuentas, así que se usa key genérica
   * @param accountId - Parámetro mantenido por compatibilidad, pero no se usa
   * @returns array de instrumentos o null si no existe
   */
  private getInstrumentsFromCache(accountId: string): any[] | null {
    try {
      // Key genérica sin accountId ya que los instrumentos son iguales para todas las cuentas
      const key = 'tradeswitch_instruments';
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.instruments && Array.isArray(parsed.instruments)) {
          return parsed.instruments;
        }
      }
    } catch (error) {
      console.warn('Error obteniendo instrumentos desde cache:', error);
    }
    
    return null;
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
    // Restaurar orden original al cerrar
    this.trades = [...this.originalTrades];
    this.isReversed = false;
    this.close.emit();
  }

  onFilter() {
    // Invertir el orden de la lista
    this.trades.reverse();
    this.isReversed = !this.isReversed;
  }

  formatCurrency(value: number): string {
    return this.numberFormatter.formatCurrency(value);
  }

  formatPercentage(value: number): string {
    return this.numberFormatter.formatPercentage(value);
  }
}
