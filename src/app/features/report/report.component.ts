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
import {
  displayConfigData,
  GroupedTrade,
  StatConfig,
} from './models/report.model';
import {
  calculateAvgWinLossTrades,
  calculateNetPnl,
  calculateProfitFactor,
  calculateTotalTrades,
  calculateTradeWinPercent,
} from './utils/normalization-utils';
import { statCardComponent } from './components/statCard/stat_card.component';
import { PnlGraphComponent } from './components/pnlGraph/pnlGraph.component';
import { calendarComponent } from './components/calendar/calendar.component';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { SettingsService } from '../strategy/service/strategy.service';
import { resetConfig } from '../strategy/store/strategy.actions';
import { RuleType, StrategyState } from '../strategy/models/strategy.model';
import { RuleShortComponent } from './components/rule-short/rule-short.component';
import moment from 'moment-timezone';
import { RouterLink, RouterLinkActive } from '@angular/router';

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
    calendarComponent,
    LoadingPopupComponent,
    RuleShortComponent,
    RouterLink,
  ],
})
export class ReportComponent implements OnInit {
  accessToken: string | null = null;
  accountDetails: any = null;
  accountHistory: GroupedTrade[] = [];
  errorMessage: string | null = null;
  stats?: StatConfig;
  userKey!: string;
  config!: displayConfigData[];
  loading = false;
  fromDate = '';
  toDate = '';

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private store: Store,
    private reportService: ReportService,
    private strategySvc: SettingsService
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
    this.loading = true;
    this.fetchUserKey();
    this.listenGroupedTrades();
    this.fetchUserRules();
  }

  fetchUserRules() {
    this.strategySvc
      .getStrategyConfig()
      .then((docSnap) => {
        if (docSnap && docSnap['exists']()) {
          const data = docSnap['data']() as StrategyState;
          this.store.dispatch(resetConfig({ config: data }));

          this.config = this.prepareConfigDisplayData(data);
        } else {
          console.warn('No config');
        }
      })
      .catch((err) => {
        this.loading = false;

        console.error('Error to get the config', err);
      });
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
          this.userKey = key;
          const now = new Date();
          const currentYear = now.getUTCFullYear();
          this.fromDate = Date.UTC(currentYear, 0, 1, 0, 0, 0, 0).toString();
          this.toDate = Date.UTC(
            currentYear,
            11,
            31,
            23,
            59,
            59,
            999
          ).toString();

          this.fetchHistoryData(key, '1234211', this.fromDate, this.toDate);

          this.store.dispatch(setUserKey({ userKey: key }));
        },
        error: (err) => {
          this.store.dispatch(setUserKey({ userKey: '' }));
        },
      });
  }
  fetchHistoryData(key: string, accountId: string, from: string, to: string) {
    this.reportService.getHistoryData(accountId, key, from, to).subscribe({
      next: (groupedTrades: GroupedTrade[]) => {
        this.store.dispatch(setGroupedTrades({ groupedTrades }));
        this.loading = false;
      },
      error: (err) => {
        this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
        this.loading = false;
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

  prepareConfigDisplayData(strategyState: StrategyState) {
    return this.transformStrategyStateToDisplayData(strategyState);
  }

  transformStrategyStateToDisplayData(
    strategyState: StrategyState
  ): displayConfigData[] {
    console.log(strategyState);

    const newConfig: displayConfigData[] = [];

    Object.entries(strategyState).forEach(([key, value]) => {
      if (value.type) {
        let title = '';

        if (value.type === RuleType.MAX_DAILY_TRADES) {
          title = 'Max Daily Trades';
        } else if (value.type === RuleType.RISK_REWARD_RATIO) {
          title = `${value.riskRewardRatio} Risk Reward`;
        } else if (value.type === RuleType.MAX_RISK_PER_TRADE) {
          title = `Limit my Risk per Trade: $${value.maxRiskPerTrade}`;
        } else if (value.type === RuleType.DAYS_ALLOWED) {
          const abbreviationsMap: { [key: string]: string } = {
            Monday: 'Mon',
            Tuesday: 'Tues',
            Wednesday: 'Wed',
            Thursday: 'Thurs',
            Friday: 'Fri',
            Saturday: 'Sat',
            Sunday: 'Sun',
          };

          const formattedText = value.tradingDays
            .map((day: string) => abbreviationsMap[day] ?? day)
            .join(', ');

          title = `Only allow trades on: ${formattedText}.`;
        } else if (value.type === RuleType.ASSETS_ALLOWED) {
          const formattedText = value.assetsAllowed.join(', ');
          title = `Only allow trades on the following assets: ${formattedText}`;
        } else if (value.type === RuleType.TRADING_HOURS) {
          const abbreviation = moment.tz(value.timezone).zoneAbbr();
          title = `Only allow trades between: ${value.tradingOpenTime} - ${value.tradingCloseTime} ${abbreviation}`;
        }

        newConfig.push({
          title,
          type: value.type,
          isActive: value.isActive,
        });
      }
    });

    return newConfig.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return 0;
    });
  }
  onYearChange($event: string) {
    this.loading = true;
    this.fromDate = Date.UTC(Number($event), 0, 1, 0, 0, 0, 0).toString();
    this.toDate = Date.UTC(Number($event), 11, 31, 23, 59, 59, 999).toString();

    this.fetchHistoryData(this.userKey, '1234211', this.fromDate, this.toDate);
  }
}
