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
    console.log('=== CALENDAR DEBUG ===');
    console.log('Total groupedTrades received:', this.groupedTrades?.length || 0);
    console.log('Target month:', targetMonth);
    
    const tradesByDay: { [date: string]: GroupedTrade[] } = {};

    // Agrupar TODOS los trades por día, no solo los del mes seleccionado
    console.log('=== GROUPING TRADES BY DAY ===');
    console.log('Total trades to group:', this.groupedTrades.length);
    
    this.groupedTrades.forEach((trade) => {
      const d = new Date(Number(trade.updatedAt));
      // ¡IMPORTANTE! Usar métodos UTC para evitar problemas de zona horaria
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;

      if (!tradesByDay[key]) tradesByDay[key] = [];
      tradesByDay[key].push(trade);
    });
    
    console.log('Unique date keys after grouping:', Object.keys(tradesByDay).length);
    console.log('Total trades after grouping:', Object.values(tradesByDay).flat().length);
    
    // Verificar si hay duplicación en el agrupamiento
    const allGroupedTrades = Object.values(tradesByDay).flat();
    console.log('Trades by day keys:', Object.keys(tradesByDay).length);
    console.log('Sample trades by day:', Object.entries(tradesByDay).slice(0, 3));
    
    // Debug: Verificar si hay trades duplicados
    const allTradesInCalendar = Object.values(tradesByDay).flat();
    console.log('Total unique trades in calendar data:', allTradesInCalendar.length);
    console.log('Original groupedTrades length:', this.groupedTrades.length);
    
    // Verificar si hay duplicados por position_Id
    const positionIds = allTradesInCalendar.map(t => t.position_Id);
    const uniquePositionIds = [...new Set(positionIds)];
    console.log('Unique position IDs:', uniquePositionIds.length);
    console.log('Total position IDs (including duplicates):', positionIds.length);
    
    // Verificar si hay duplicados por fecha
    const tradeDates = allTradesInCalendar.map(t => new Date(Number(t.updatedAt)).toISOString().split('T')[0]);
    const uniqueDates = [...new Set(tradeDates)];
    console.log('Unique dates:', uniqueDates.length);
    console.log('Total dates (including duplicates):', tradeDates.length);
    
    // Verificar si hay trades con la misma fecha y position_Id
    const tradeKeys = allTradesInCalendar.map(t => `${t.position_Id}-${new Date(Number(t.updatedAt)).toISOString().split('T')[0]}`);
    const uniqueTradeKeys = [...new Set(tradeKeys)];
    console.log('Unique trade keys (positionId-date):', uniqueTradeKeys.length);
    console.log('Total trade keys (including duplicates):', tradeKeys.length);

    const year = targetMonth.getUTCFullYear();
    const month = targetMonth.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));

    let startDay = new Date(firstDay);
    startDay.setUTCDate(firstDay.getUTCDate() - firstDay.getUTCDay());
    let endDay = new Date(lastDay);
    endDay.setUTCDate(lastDay.getUTCDate() + (6 - lastDay.getUTCDay()));

    const days: CalendarDay[] = [];
    let d = new Date(startDay);
    while (d <= endDay) {
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
      const trades = tradesByDay[key] || [];
      const pnlTotal = trades.reduce((acc, t) => acc + (t.pnl ?? 0), 0);

      const wins = trades.filter((t) => (t.pnl ?? 0) > 0).length;
      const tradesCount = trades.length;
      const tradeWinPercent =
        tradesCount > 0 ? Math.round((wins / tradesCount) * 1000) / 10 : 0;
      let usedPluginToday = false;

      if (this.pluginHistory && this.pluginHistory.length > 0) {
        const foundRecord = this.pluginHistory.find((record) => {
          const dateToCompare = new Date(record.updatedOn);
          const dateToCompareDay = dateToCompare.getDate();
          const dateToCompareMonth = dateToCompare.getMonth();
          const dateToCompareYear = dateToCompare.getFullYear();

          if (
            dateToCompareDay === d.getUTCDate() &&
            dateToCompareMonth === d.getUTCMonth() &&
            dateToCompareYear === d.getUTCFullYear()
          ) {
            return true;
          }
          return false;
        });
        usedPluginToday = foundRecord?.isActive ?? false;
      }

      days.push({
        date: new Date(d),
        trades: trades,
        pnlTotal,
        tradesCount: trades.length,
        followedStrategy: usedPluginToday,
        tradeWinPercent: Math.round(tradeWinPercent),
      });

      d.setUTCDate(d.getUTCDate() + 1);
    }
    this.calendar = [];
    for (let i = 0; i < days.length; i += 7) {
      this.calendar.push(days.slice(i, i + 7));
    }
    
    // Debug: Contar total de trades en el calendario
    const totalTradesInCalendar = days.reduce((sum, day) => sum + day.tradesCount, 0);
    console.log('=== CALENDAR GENERATION DEBUG ===');
    console.log('Total trades counted in calendar:', totalTradesInCalendar);
    console.log('Total trades in ALL days (not just current month):', Object.values(tradesByDay).flat().length);
    console.log('Days generated:', days.length);
    console.log('Days with trades:', days.filter(day => day.tradesCount > 0).length);
    
    // Verificar si hay trades duplicados en el calendario generado
    const allCalendarTrades = days.flatMap(day => day.trades);
    const allCalendarPositionIds = allCalendarTrades.map(t => t.position_Id);
    const uniqueCalendarPositionIds = [...new Set(allCalendarPositionIds)];
    console.log('Unique position IDs in calendar:', uniqueCalendarPositionIds.length);
    console.log('Total position IDs in calendar:', allCalendarPositionIds.length);
    console.log('Calendar duplication check:', allCalendarPositionIds.length === uniqueCalendarPositionIds.length ? 'NO DUPLICATES' : 'DUPLICATES FOUND');
    
    // Debug: Verificar trades por día específico
    console.log('=== TRADES BY DAY DEBUG ===');
    console.log('Target month UTC:', targetMonth.getUTCMonth());
    console.log('All date keys:', Object.keys(tradesByDay));
    
    let totalTradesInCurrentMonth = 0;
    Object.entries(tradesByDay).forEach(([dateKey, trades]) => {
      // Corregir el parseo de la fecha: dateKey es "YYYY-M-D" (UTC)
      const [year, month, day] = dateKey.split('-').map(Number);
      const date = new Date(Date.UTC(year, month, day)); // Usar Date.UTC para consistencia
      const monthNum = date.getUTCMonth();
      const targetMonthNum = targetMonth.getUTCMonth();
      
      console.log(`DateKey: ${dateKey}, Month: ${monthNum}, TargetMonth: ${targetMonthNum}, Trades: ${trades.length}`);
      
      if (monthNum === targetMonthNum) {
        totalTradesInCurrentMonth += trades.length;
        console.log(`✓ Day ${dateKey}: ${trades.length} trades`);
        console.log('  Trades:', trades.map(t => `${t.position_Id}-${new Date(Number(t.updatedAt)).toISOString().split('T')[0]}`));
      }
    });
    
    console.log('Total trades in current month (manual count):', totalTradesInCurrentMonth);
    
    // Debug: Verificar si hay trades duplicados en el mes actual
    const currentMonthTrades = days.filter(day => day.tradesCount > 0).flatMap(day => day.trades);
    const currentMonthPositionIds = currentMonthTrades.map(t => t.position_Id);
    const uniqueCurrentMonthPositionIds = [...new Set(currentMonthPositionIds)];
    console.log('Current month trades count:', currentMonthTrades.length);
    console.log('Current month unique position IDs:', uniqueCurrentMonthPositionIds.length);
    console.log('Current month duplicate check:', currentMonthPositionIds.length === uniqueCurrentMonthPositionIds.length ? 'NO DUPLICATES' : 'DUPLICATES FOUND');
    console.log('========================');
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
    const year = this.selectedMonth.getUTCFullYear();
    return `${month}, ${year}`;
  }

  // Navigation methods
  canNavigateLeft(): boolean {
    if (!this.groupedTrades || this.groupedTrades.length === 0) return false;
    
    const earliestTradeDate = this.getEarliestTradeDate();
    const firstDayOfSelectedMonth = new Date(Date.UTC(this.selectedMonth.getUTCFullYear(), this.selectedMonth.getUTCMonth(), 1));
    
    return earliestTradeDate < firstDayOfSelectedMonth;
  }

  canNavigateRight(): boolean {
    if (!this.groupedTrades || this.groupedTrades.length === 0) return false;
    
    const latestTradeDate = this.getLatestTradeDate();
    const lastDayOfSelectedMonth = new Date(Date.UTC(this.selectedMonth.getUTCFullYear(), this.selectedMonth.getUTCMonth() + 1, 0));
    
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
      console.log('=== NAVIGATING TO PREVIOUS MONTH ===');
      console.log('Current month:', this.selectedMonth);
      this.selectedMonth = new Date(Date.UTC(this.selectedMonth.getUTCFullYear(), this.selectedMonth.getUTCMonth() - 1));
      console.log('New month:', this.selectedMonth);
      this.generateCalendar(this.selectedMonth);
    }
  }

  navigateToNextMonth(): void {
    if (this.canNavigateRight()) {
      console.log('=== NAVIGATING TO NEXT MONTH ===');
      console.log('Current month:', this.selectedMonth);
      this.selectedMonth = new Date(Date.UTC(this.selectedMonth.getUTCFullYear(), this.selectedMonth.getUTCMonth() + 1));
      console.log('New month:', this.selectedMonth);
      this.generateCalendar(this.selectedMonth);
    }
  }

  navigateToCurrentMonth(): void {
    this.selectedMonth = new Date(Date.UTC(this.currentDate.getUTCFullYear(), this.currentDate.getUTCMonth()));
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
