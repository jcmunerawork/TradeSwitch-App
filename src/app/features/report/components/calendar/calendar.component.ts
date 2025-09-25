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
  GroupedTrade,
  PluginHistoryRecord,
} from '../../models/report.model';
import { ReportService } from '../../service/report.service';
import { TradesPopupComponent } from '../trades-popup/trades-popup.component';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
  standalone: true,
  imports: [CommonModule, TradesPopupComponent],
})
export class CalendarComponent {
  @Input() groupedTrades!: GroupedTrade[];
  @Input() pluginHistory!: PluginHistoryRecord[];
  @Output() strategyFollowedPercentageChange = new EventEmitter<number>();

  calendar: CalendarDay[][] = [];
  currentDate!: Date;
  selectedMonth!: Date;
  
  // Popup properties
  showTradesPopup = false;
  selectedDay: CalendarDay | null = null;

  constructor(private reportSvc: ReportService) {}

  ngOnChanges(changes: SimpleChanges) {
    this.currentDate = new Date();
    this.selectedMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth());

    this.generateCalendar(this.selectedMonth);

    if (this.pluginHistory && this.pluginHistory.length > 0) {
      this.getPercentageStrategyFollowedLast30Days();
    }
  }

  emitStrategyFollowedPercentage(value: number): void {
    this.strategyFollowedPercentageChange.emit(value);
  }

  generateCalendar(targetMonth: Date) {
    const tradesByDay: { [date: string]: GroupedTrade[] } = {};

    // Agrupar trades por día usando la zona horaria del dispositivo
    this.groupedTrades.forEach((trade) => {
      const tradeDate = new Date(Number(trade.updatedAt));
      // Usar la zona horaria local del dispositivo
      const key = `${tradeDate.getFullYear()}-${tradeDate.getMonth()}-${tradeDate.getDate()}`;

      if (!tradesByDay[key]) tradesByDay[key] = [];
      tradesByDay[key].push(trade);
    });

    // Verificar duplicados de manera simple
    const allTrades = Object.values(tradesByDay).flat();
    const uniqueTrades = allTrades.filter((trade, index, self) => 
      index === self.findIndex(t => t.position_Id === trade.position_Id)
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
      const tradesCount = trades.length;
      const tradeWinPercent = tradesCount > 0 ? Math.round((wins / tradesCount) * 1000) / 10 : 0;
      
      let usedPluginToday = false;
      if (this.pluginHistory && this.pluginHistory.length > 0) {
        const foundRecord = this.pluginHistory.find((record) => {
          const recordDate = new Date(record.updatedOn);
          return recordDate.getFullYear() === currentDay.getFullYear() &&
                 recordDate.getMonth() === currentDay.getMonth() &&
                 recordDate.getDate() === currentDay.getDate();
        });
        usedPluginToday = foundRecord?.isActive ?? false;
      }

      days.push({
        date: new Date(currentDay),
        trades: trades,
        pnlTotal,
        tradesCount: trades.length,
        followedStrategy: usedPluginToday,
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
    
    const dates = this.groupedTrades.map(trade => new Date(Number(trade.updatedAt)));
    return new Date(Math.min(...dates.map(d => d.getTime())));
  }

  private getLatestTradeDate(): Date {
    if (!this.groupedTrades || this.groupedTrades.length === 0) return new Date();
    
    const dates = this.groupedTrades.map(trade => new Date(Number(trade.updatedAt)));
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
}
