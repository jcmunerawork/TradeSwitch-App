import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CalendarDay, GroupedTrade } from '../../models/report.model';

export interface TradeDetail {
  openTime: string;
  ticker: string;
  side: 'Long' | 'Short';
  instrument: string;
  netPnl: number;
  netRoi: number;
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
  @Output() close = new EventEmitter<void>();

  trades: TradeDetail[] = [];
  netPnl: number = 0;
  netRoi: number = 0;
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
    this.netRoi = this.calculateNetRoi();
    
    // Convertir trades del día a formato de detalle
    this.trades = this.selectedDay.trades.map((trade, index) => ({
      openTime: this.formatTime(new Date(Number(trade.updatedAt))),
      ticker: this.generateTicker(index),
      side: this.determineSide(trade),
      instrument: this.generateInstrument(index),
      netPnl: trade.pnl || 0,
      netRoi: this.calculateTradeRoi(trade),
      followedStrategy: this.selectedDay?.followedStrategy || false,
      strategyName: 'Swing Trading Strategy'
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

  generateTicker(index: number): string {
    // Generar tickers simulados basados en el índice
    const tickers = ['YM', 'MYM', 'ES', 'NQ', 'RTY'];
    return tickers[index % tickers.length];
  }

  generateInstrument(index: number): string {
    // Generar instrumentos simulados basados en el índice
    const ticker = this.generateTicker(index);
    const currentDate = new Date();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const year = currentDate.getFullYear();
    return `${ticker} ${month}-${day}-${year}`;
  }

  determineSide(trade: GroupedTrade): 'Long' | 'Short' {
    // Lógica para determinar si es Long o Short basado en el trade
    // Por ahora asumimos que si el PnL es positivo es Long, si es negativo es Short
    return (trade.pnl || 0) >= 0 ? 'Long' : 'Short';
  }

  calculateNetRoi(): number {
    // Calcular ROI neto del día (simplificado)
    return this.netPnl !== 0 ? (this.netPnl / Math.abs(this.netPnl)) * 100 : 0;
  }

  calculateTradeRoi(trade: GroupedTrade): number {
    // Calcular ROI individual del trade (simplificado)
    const pnl = trade.pnl || 0;
    return pnl !== 0 ? (pnl / Math.abs(pnl)) * 100 : 0;
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
}
