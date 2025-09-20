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
  
  // Popup properties
  showTradesPopup = false;
  selectedDay: CalendarDay | null = null;

  constructor(private reportSvc: ReportService) {}

  ngOnChanges(changes: SimpleChanges) {
    this.currentDate = new Date();

    this.generateCalendar(
      new Date(this.currentDate.getFullYear(), this.currentDate.getMonth())
    );

    if (this.pluginHistory && this.pluginHistory.length > 0) {
      this.getPercentageStrategyFollowedLast30Days();
    }
  }

  emitStrategyFollowedPercentage(value: number): void {
    this.strategyFollowedPercentageChange.emit(value);
  }

  generateCalendar(targetMonth: Date) {
    const tradesByDay: { [date: string]: GroupedTrade[] } = {};

    this.groupedTrades.forEach((trade) => {
      const d = new Date(Number(trade.updatedAt));

      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

      if (!tradesByDay[key]) tradesByDay[key] = [];
      tradesByDay[key].push(trade);
    });

    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDay = new Date(firstDay);
    startDay.setDate(firstDay.getDate() - firstDay.getDay());
    let endDay = new Date(lastDay);
    endDay.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

    const days: CalendarDay[] = [];
    let d = new Date(startDay);
    while (d <= endDay) {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
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
            dateToCompareDay === d.getDate() &&
            dateToCompareMonth === d.getMonth() &&
            dateToCompareYear === d.getFullYear()
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

      d.setDate(d.getDate() + 1);
    }
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
    const month = this.currentDate.toLocaleString('en-US', options);
    const year = this.currentDate.getFullYear();
    return `${month}, ${year}`;
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
