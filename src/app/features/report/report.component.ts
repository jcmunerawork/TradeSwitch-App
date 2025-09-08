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
import { interval, last, map, Subscription } from 'rxjs';
import { ReportService } from './service/report.service';
import {
  displayConfigData,
  GroupedTrade,
  MonthlyReport,
  PluginHistoryRecord,
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
import { CalendarComponent } from './components/calendar/calendar.component';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { SettingsService } from '../strategy/service/strategy.service';
import { resetConfig } from '../strategy/store/strategy.actions';
import { RuleType, StrategyState } from '../strategy/models/strategy.model';
import { RuleShortComponent } from './components/rule-short/rule-short.component';
import moment from 'moment-timezone';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { User } from '../overview/models/overview';
import { selectUser } from '../auth/store/user.selectios';
import { AuthService } from '../auth/service/authService';
import { getBestTrade, getTotalSpend } from './utils/firebase-data-utils';
import { Timestamp } from 'firebase/firestore';
import { initialStrategyState } from '../strategy/store/strategy.reducer';
import { AccountData } from '../auth/models/userModel';

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
    CalendarComponent,
    LoadingPopupComponent,
    RuleShortComponent,
    RouterLink,
  ],
})
export class ReportComponent implements OnInit {
  accessToken: string | null = null;
  accountDetails: any = null;
  accountsData: AccountData[] = [];
  accountHistory: GroupedTrade[] = [];
  errorMessage: string | null = null;
  stats?: StatConfig;
  userKey!: string;
  config!: displayConfigData[];
  loading = false;
  fromDate = '';
  toDate = '';
  user: User | null = null;
  requestYear: number = 0;
  private updateSubscription?: Subscription;
  pluginHistory: PluginHistoryRecord[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private store: Store,
    private reportService: ReportService,
    private userService: AuthService,
    private strategySvc: SettingsService,
    private router: Router
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
    this.getUserData();
    this.getHistoryPluginUsage();
    this.listenGroupedTrades();
    this.fetchUserRules();

    this.updateSubscription = interval(120000).subscribe(() => {
      if (this.userKey) {
        this.loading = true;
        if (this.user) {
          this.fetchUserAccounts();
        }
      }
    });
  }

  ngOnDestroy() {
    this.updateSubscription?.unsubscribe();
  }

  getHistoryPluginUsage() {
    this.reportService.getPluginUsageHistory(this.user?.id).then((history) => {
      this.pluginHistory = [...history];
    });
  }

  getUserData() {
    this.store.select(selectUser).subscribe({
      next: (user) => {
        this.user = user.user;
        if (this.user) {
          this.fetchUserAccounts();
        }
      },
      error: (err) => {
        console.error('Error fetching user data', err);
      },
    });
  }

  fetchUserAccounts() {
    this.userService.getUserAccounts(this.user?.id).then((accounts) => {
      if (!accounts || accounts.length === 0) {
        this.accountsData = [];
        this.loading = false;
      } else {
        this.accountsData = accounts;
        if (this.accountsData.length === 0) {
          this.loading = false;
        } else {
          this.accountsData.forEach((account) => {
            setTimeout(() => {
              this.fetchUserKey(account);
            }, 1000);
          });
        }
      }
    });
  }

  fetchUserRules() {
    this.strategySvc
      .getStrategyConfig(this.user?.id)
      .then((docSnap) => {
        if (docSnap && docSnap['exists']()) {
          const data = docSnap['data']() as StrategyState;
          this.store.dispatch(resetConfig({ config: data }));

          this.config = this.prepareConfigDisplayData(data);
        } else {
          this.store.dispatch(resetConfig({ config: initialStrategyState }));
          this.config = this.prepareConfigDisplayData(initialStrategyState);

          console.warn('No config');
        }
      })
      .catch((err) => {
        this.store.dispatch(resetConfig({ config: initialStrategyState }));
        this.config = this.prepareConfigDisplayData(initialStrategyState);

        this.loading = false;

        console.error('Error to get the config', err);
      });
  }

  onStrategyPercentageChange(percentage: number) {
    if (this.user) {
      this.updateFirebaseUserData(percentage);
    }
  }

  updateFirebaseUserData(percentage: number) {
    if (this.user) {
      const updatedUser = {
        ...this.user,
        best_trade: getBestTrade(this.accountHistory),
        netPnl: this.stats?.netPnl ?? 0,
        lastUpdated: new Date().getTime() as unknown as Timestamp,
        number_trades: this.stats?.totalTrades ?? 0,
        strategy_followed: percentage,
        profit: this.stats?.netPnl ?? 0,
        total_spend: getTotalSpend(this.accountHistory),
      };

      const actualYear = new Date().getFullYear();

      const requestYear = this.requestYear;
      if (actualYear === requestYear) {
        this.userService.createUser(updatedUser as unknown as User);
      }

      const monthlyReport = {
        id: this.user?.id,
        best_trade: getBestTrade(this.accountHistory),
        netPnl: this.stats?.netPnl ?? 0,
        number_trades: this.stats?.totalTrades ?? 0,
        profit: this.stats?.netPnl ?? 0,
        strategy_followed: percentage,
        total_spend: getTotalSpend(this.accountHistory),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      };

      this.reportService.updateMonthlyReport(
        monthlyReport as unknown as MonthlyReport
      );
    }
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

  fetchUserKey(account: AccountData) {
    this.reportService
      .getUserKey(
        account.emailTradingAccount,
        account.brokerPassword,
        account.server
      )
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
          this.requestYear = currentYear;

          this.fetchHistoryData(
            key,
            account.accountID,
            account.accountNumber,
            this.fromDate,
            this.toDate
          );

          this.store.dispatch(setUserKey({ userKey: key }));
        },
        error: (err) => {
          this.store.dispatch(setUserKey({ userKey: '' }));
        },
      });
  }
  fetchHistoryData(
    key: string,
    accountId: string,
    accNum: number,
    from: string,
    to: string
  ) {
    this.reportService
      .getHistoryData(accountId, key, accNum, from, to)
      .subscribe({
        next: (groupedTrades: GroupedTrade[]) => {
          const actualGroupedTrades = this.accountHistory;

          this.store.dispatch(
            setGroupedTrades({
              groupedTrades: [...actualGroupedTrades, ...groupedTrades],
            })
          );

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
    this.requestYear = Number($event);

    if (this.user) {
      this.fetchUserAccounts();
    }
  }
}
