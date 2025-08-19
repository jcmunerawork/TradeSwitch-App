import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import {
  getUserKey,
  setAvgWnL,
  setGroupedTrades,
  setNetPnL,
  setProfitFactor,
  setTotalTrades,
  setTradeWin,
  setUserKey,
} from './store/report.actions';
import { selectGroupedTrades, selectReport } from './store/report.selectors';
import { map } from 'rxjs';
import { ReportService } from './service/report.service';
import { GroupedTrade, StatConfig } from './models/report.model';
import {
  calculateAvgWinLossTrades,
  calculateNetPnl,
  calculateProfitFactor,
  calculateTotalTrades,
  calculateTradeWinPercent,
} from './utils/normalization-utils';
import { statCardComponent } from './components/statCard/stat_card.component';
import { PnlGraphComponent } from './components/pnlGraph/pnlGraph.component';

@Component({
  selector: 'app-report',
  templateUrl: './report.component.html',
  styleUrls: ['./report.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    statCardComponent,
    PnlGraphComponent,
  ],
})
export class ReportComponent implements OnInit {
  accessToken: string | null = null;
  accountDetails: any = null;
  accountHistory: GroupedTrade[] = [];
  errorMessage: string | null = null;
  stats?: StatConfig;
  userKey!: string;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private store: Store,
    private reportService: ReportService
  ) {}

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      const container = document.querySelector('.stats-card-container');
      if (container) {
        container.addEventListener('wheel', function (e) {
          if ((e as any).deltaY !== 0) {
            e.preventDefault();
            container.scrollLeft += (e as any).deltaY;
          }
        });
      }
    }
  }

  ngOnInit() {
    this.fetchUserKey();
    this.listenGroupedTrades();
  }

  listenGroupedTrades() {
    this.store.select(selectGroupedTrades).subscribe({
      next: (groupedTrades) => {
        this.accountHistory = groupedTrades;
        this.updateReportStats(this.store, groupedTrades);
      },
    });
  }

  computeStats(trades: { pnl?: number }[]) {
    return {
      netPnl: calculateNetPnl(trades),
      tradeWinPercent: calculateTradeWinPercent(trades),
      profitFactor: calculateProfitFactor(trades),
      avgWinLossTrades: calculateAvgWinLossTrades(trades),
      totalTrades: calculateTotalTrades(trades),
    };
  }

  fetchUserKey() {
    this.reportService
      .getUserKey('crisdamencast@gmail.com', 'FP`{Nlq_T9', 'HEROFX')
      .subscribe({
        next: (key: string) => {
          console.log('reload');
          this.userKey = key;
          this.fetchHistoryData(key, '1234211');

          this.store.dispatch(setUserKey({ userKey: key }));
        },
        error: (err) => {
          this.store.dispatch(setUserKey({ userKey: '' }));
        },
      });
  }
  fetchHistoryData(key: string, accountId: string) {
    this.reportService.getHistoryData(accountId, key).subscribe({
      next: (groupedTrades: GroupedTrade[]) => {
        this.store.dispatch(setGroupedTrades({ groupedTrades }));
      },
      error: (err) => {
        this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
      },
    });
  }

  updateReportStats(store: Store, groupedTrades: GroupedTrade[]) {
    this.stats = this.computeStats(groupedTrades);
    store.dispatch(setNetPnL({ netPnL: this.stats.netPnl }));
    store.dispatch(setTradeWin({ tradeWin: this.stats.tradeWinPercent }));
    store.dispatch(setProfitFactor({ profitFactor: this.stats.profitFactor }));
    store.dispatch(setAvgWnL({ avgWnL: this.stats.avgWinLossTrades }));
    store.dispatch(setTotalTrades({ totalTrades: this.stats.totalTrades }));
  }

  prepareChartData(monthlyPnL: { [month: string]: number }) {
    const labels = Object.keys(monthlyPnL).sort(); // eg: ['2025-01', ..., '2025-12']
    const data = labels.map((month) => monthlyPnL[month]);
    return { labels, data };
  }
}
