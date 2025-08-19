import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CalendarDay, GroupedTrade } from '../../models/report.model';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class calendarComponent {
  @Input() groupedTrades!: GroupedTrade[];
  calendar: CalendarDay[][] = [];
  currentDate!: Date;

  constructor() {}

  ngOnChanges() {
    this.currentDate = new Date();
    this.generateCalendar(
      new Date(this.currentDate.getFullYear(), this.currentDate.getMonth())
    );
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
    startDay.setDate(firstDay.getDate() - firstDay.getDay()); // primer domingo visible
    let endDay = new Date(lastDay);
    endDay.setDate(lastDay.getDate() + (6 - lastDay.getDay())); // último sábado visible

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

      days.push({
        date: new Date(d),
        trades: trades,
        pnlTotal,
        tradesCount: trades.length,
        followedStrategy: pnlTotal > 0 ? true : false,
        tradeWinPercent: Math.round(tradeWinPercent),
      });

      d.setDate(d.getDate() + 1);
    }
    this.calendar = [];
    for (let i = 0; i < days.length; i += 7) {
      this.calendar.push(days.slice(i, i + 7));
    }
  }

  get currentMonthYear(): string {
    const options: Intl.DateTimeFormatOptions = { month: 'short' };
    const month = this.currentDate.toLocaleString('en-US', options);
    const year = this.currentDate.getFullYear();
    return `${month}, ${year}`;
  }
}
