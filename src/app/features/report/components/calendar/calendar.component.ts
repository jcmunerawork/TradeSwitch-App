import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
} from '@angular/core';
import {
  CalendarDay,
  GroupedTradeFinal,
  PluginHistoryRecord,
} from '../../models/report.model';
import { ReportService } from '../../service/report.service';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';
import { TradesPopupComponent } from '../trades-popup/trades-popup.component';
import { ConfigurationOverview } from '../../../strategy/models/strategy.model';
import { PluginHistoryService, PluginHistory } from '../../../../shared/services/plugin-history.service';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
  standalone: true,
  imports: [CommonModule, TradesPopupComponent],
})
export class CalendarComponent {
  @Input() groupedTrades!: GroupedTradeFinal[];
  @Output() strategyFollowedPercentageChange = new EventEmitter<number>();
  @Input() strategies!: ConfigurationOverview[];
  @Input() userId!: string; // Necesario para obtener el plugin history

  calendar: CalendarDay[][] = [];
  currentDate!: Date;
  selectedMonth!: Date;
  
  // Popup properties
  showTradesPopup = false;
  selectedDay: CalendarDay | null = null;
  
  // Plugin history properties
  pluginHistory: PluginHistory | null = null;

  constructor(
    private reportSvc: ReportService,
    private pluginHistoryService: PluginHistoryService
  ) {}
  private numberFormatter = new NumberFormatterService();

  ngOnChanges(changes: SimpleChanges) {
    this.currentDate = new Date();
    this.selectedMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth());

    // Cargar plugin history si tenemos userId
    if (this.userId) {
      this.loadPluginHistory();
    }

    this.generateCalendar(this.selectedMonth);

    if (this.strategies && this.strategies.length > 0) {
      this.getPercentageStrategyFollowedLast30Days();
    }
  }

  emitStrategyFollowedPercentage(value: number): void {
    this.strategyFollowedPercentageChange.emit(value);
  }

  /**
   * Cargar plugin history para el usuario
   */
  async loadPluginHistory() {
    try {
      const pluginHistoryArray = await this.pluginHistoryService.getPluginUsageHistory(this.userId);
      if (pluginHistoryArray.length > 0) {
        this.pluginHistory = pluginHistoryArray[0];
        console.log('Plugin history loaded:', this.pluginHistory);
      } else {
        this.pluginHistory = null;
        console.log('No plugin history found for user');
      }
    } catch (error) {
      console.error('Error loading plugin history:', error);
      this.pluginHistory = null;
    }
  }

  /**
   * Determinar si se siguió la estrategia basándose en los rangos de fechas del plugin
   * @param tradeDate - Fecha del trade a validar
   * @returns true si se siguió la estrategia, false si no
   */
  didFollowStrategy(tradeDate: Date): boolean {
    if (!this.pluginHistory || !this.pluginHistory.dateActive || !this.pluginHistory.dateInactive) {
      return false; // Sin plugin history, no se siguió estrategia
    }

    const dateActive = this.pluginHistory.dateActive;
    const dateInactive = this.pluginHistory.dateInactive;
    const now = new Date();

    // Si dateActive tiene más elementos que dateInactive, está activo hasta ahora
    if (dateActive.length > dateInactive.length) {
      // El último rango activo va desde la última fecha de active hasta ahora
      const lastActiveDate = new Date(dateActive[dateActive.length - 1]);
      return tradeDate >= lastActiveDate && tradeDate <= now;
    }

    // Si tienen la misma cantidad, crear rangos de fechas
    if (dateActive.length === dateInactive.length) {
      // Crear rangos: active[0] -> inactive[0], active[1] -> inactive[1], etc.
      for (let i = 0; i < dateActive.length; i++) {
        const activeStart = new Date(dateActive[i]);
        const inactiveEnd = new Date(dateInactive[i]);
        
        // Si el trade está dentro de este rango activo
        if (tradeDate >= activeStart && tradeDate <= inactiveEnd) {
          return true;
        }
      }
    }

    return false; // No está en ningún rango activo
  }

  generateCalendar(targetMonth: Date) {
    const tradesByDay: { [date: string]: GroupedTradeFinal[] } = {};

    // Agrupar trades por día usando la zona horaria del dispositivo
    this.groupedTrades.forEach((trade) => {
      const tradeDate = new Date(Number(trade.lastModified));
      // Usar la zona horaria local del dispositivo
      const key = `${tradeDate.getFullYear()}-${tradeDate.getMonth()}-${tradeDate.getDate()}`;

      if (!tradesByDay[key]) tradesByDay[key] = [];
      tradesByDay[key].push(trade);
    });

    // Verificar duplicados de manera simple
    const allTrades = Object.values(tradesByDay).flat();
    const uniqueTrades = allTrades.filter((trade, index, self) => 
      index === self.findIndex(t => t.positionId === trade.positionId)
    );

    // Generar calendario del mes objetivo
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Calcular inicio y fin de la semana
    let startDay = new Date(firstDay);
    startDay.setDate(firstDay.getDate() - firstDay.getDay());
    let endDay = new Date(lastDay);
    endDay.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

    const days: CalendarDay[] = [];
    let currentDay = new Date(startDay);
    
    while (currentDay <= endDay) {
      const key = `${currentDay.getFullYear()}-${currentDay.getMonth()}-${currentDay.getDate()}`;
      const trades = tradesByDay[key] || [];
      const pnlTotal = trades.reduce((acc, t) => acc + (t.pnl ?? 0), 0);

      const wins = trades.filter((t) => (t.pnl ?? 0) > 0).length;
      const losses = trades.filter((t) => (t.pnl ?? 0) < 0).length;
      const tradesCount = trades.length;
      const tradeWinPercent = tradesCount > 0 ? Math.round((wins / tradesCount) * 1000) / 10 : 0;
      
      // Determinar si se siguió la estrategia basándose en los rangos de fechas del plugin
      const followedStrategy = tradesCount > 0 ? this.didFollowStrategy(currentDay) : false;

      days.push({
        date: new Date(currentDay),
        trades: trades as GroupedTradeFinal[],
        pnlTotal,
        tradesCount: trades.length,
        followedStrategy: followedStrategy,
        tradeWinPercent: Math.round(tradeWinPercent),
      });

      currentDay.setDate(currentDay.getDate() + 1);
    }

    // Organizar en semanas
    this.calendar = [];
    for (let i = 0; i < days.length; i += 7) {
      this.calendar.push(days.slice(i, i + 7));
    }
  }

  getDateNDaysAgo(daysAgo: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  }

  filterDaysInRange(
    days: CalendarDay[],
    fromDate: Date,
    toDate: Date
  ): CalendarDay[] {
    return days.filter((day) => day.date >= fromDate && day.date <= toDate);
  }

  countStrategyFollowedDays(days: CalendarDay[]): number {
    return days.filter((day) => day.followedStrategy && day.tradesCount > 0)
      .length;
  }

  calculateStrategyFollowedPercentage(
    days: CalendarDay[],
    periodDays: number
  ): number {
    if (days.length === 0) return 0;

    const fromDate = this.getDateNDaysAgo(periodDays - 1);
    const toDate = new Date();

    const daysInRange = this.filterDaysInRange(days, fromDate, toDate);
    const count = this.countStrategyFollowedDays(daysInRange);

    const percentage = (count / periodDays) * 100;

    return Math.round(percentage * 10) / 10;
  }

  getPercentageStrategyFollowedLast30Days() {
    const percentage = this.calculateStrategyFollowedPercentage(
      this.calendar.flat(),
      30
    );
    this.emitStrategyFollowedPercentage(percentage);
  }

  get currentMonthYear(): string {
    const options: Intl.DateTimeFormatOptions = { month: 'short' };
    const month = this.selectedMonth.toLocaleString('en-US', options);
    const year = this.selectedMonth.getFullYear();
    return `${month}, ${year}`;
  }

  // Navigation methods
  canNavigateLeft(): boolean {
    if (!this.groupedTrades || this.groupedTrades.length === 0) return false;
    
    const earliestTradeDate = this.getEarliestTradeDate();
    const firstDayOfSelectedMonth = new Date(this.selectedMonth.getFullYear(), this.selectedMonth.getMonth(), 1);
    
    return earliestTradeDate < firstDayOfSelectedMonth;
  }

  canNavigateRight(): boolean {
    if (!this.groupedTrades || this.groupedTrades.length === 0) return false;
    
    const latestTradeDate = this.getLatestTradeDate();
    const lastDayOfSelectedMonth = new Date(this.selectedMonth.getFullYear(), this.selectedMonth.getMonth() + 1, 0);
    
    return latestTradeDate > lastDayOfSelectedMonth;
  }

  private getEarliestTradeDate(): Date {
    if (!this.groupedTrades || this.groupedTrades.length === 0) return new Date();
    
    const dates = this.groupedTrades.map(trade => new Date(Number(trade.lastModified)));
    return new Date(Math.min(...dates.map(d => d.getTime())));
  }

  private getLatestTradeDate(): Date {
    if (!this.groupedTrades || this.groupedTrades.length === 0) return new Date();
    
    const dates = this.groupedTrades.map(trade => new Date(Number(trade.lastModified)));
    return new Date(Math.max(...dates.map(d => d.getTime())));
  }

  navigateToPreviousMonth(): void {
    if (this.canNavigateLeft()) {
      this.selectedMonth = new Date(this.selectedMonth.getFullYear(), this.selectedMonth.getMonth() - 1);
      this.generateCalendar(this.selectedMonth);
    }
  }

  navigateToNextMonth(): void {
    if (this.canNavigateRight()) {
      this.selectedMonth = new Date(this.selectedMonth.getFullYear(), this.selectedMonth.getMonth() + 1);
      this.generateCalendar(this.selectedMonth);
    }
  }

  navigateToCurrentMonth(): void {
    this.selectedMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth());
    this.generateCalendar(this.selectedMonth);
  }

  // Export functionality
  exportData() {
    const csvData = this.generateCSVData();
    this.downloadCSV(csvData, `trading-data-${this.currentMonthYear.replace(', ', '-').toLowerCase()}.csv`);
  }

  generateCSVData(): string {
    const headers = ['Date', 'PnL Total', 'Trades Count', 'Win Percentage', 'Strategy Followed'];
    const rows = [headers.join(',')];

    this.calendar.flat().forEach(day => {
      const date = day.date.toISOString().split('T')[0];
      const pnlTotal = day.pnlTotal.toFixed(2);
      const tradesCount = day.tradesCount;
      const winPercentage = day.tradeWinPercent;
      const strategyFollowed = day.followedStrategy ? 'Yes' : 'No';

      rows.push([date, pnlTotal, tradesCount, winPercentage, strategyFollowed].join(','));
    });

    return rows.join('\n');
  }

  downloadCSV(csvData: string, filename: string) {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Weekly summary methods
  getWeekTotal(week: CalendarDay[]): number {
    return week.reduce((total, day) => total + day.pnlTotal, 0);
  }

  getWeekActiveDays(week: CalendarDay[]): number {
    return week.filter(day => day.tradesCount > 0).length;
  }

  // Popup methods
  onDayClick(day: CalendarDay) {
    if (day.tradesCount > 0) {
      this.selectedDay = day;
      this.showTradesPopup = true;
    }
  }

  onClosePopup() {
    this.showTradesPopup = false;
    this.selectedDay = null;
  }

  formatCurrency(value: number): string {
    return this.numberFormatter.formatCurrency(value);
  }

  formatPercentage(value: number): string {
    return this.numberFormatter.formatPercentage(value);
  }
}
