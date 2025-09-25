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
import { SettingsService } from '../strategy/service/strategy.service';
import { resetConfig } from '../strategy/store/strategy.actions';
import { RuleType, StrategyState } from '../strategy/models/strategy.model';
import { WinLossChartComponent } from './components/winLossChart/win-loss-chart.component';
import moment from 'moment-timezone';
import { Router } from '@angular/router';
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
    WinLossChartComponent,
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
  private loadingTimeout?: any;
  pluginHistory: PluginHistoryRecord[] = [];
  
  // Account management
  currentAccount: AccountData | null = null;
  showAccountDropdown = false;
  showReloadButton = false;
  
  // Local storage keys
  private readonly STORAGE_KEYS = {
    REPORT_DATA: 'tradeSwitch_reportData',
    ACCOUNTS_DATA: 'tradeSwitch_accountsData',
    CURRENT_ACCOUNT: 'tradeSwitch_currentAccount',
    USER_DATA: 'tradeSwitch_userData'
  };

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
    // Cargar datos guardados primero para mostrar inmediatamente
    this.loadSavedData();
    
    // Luego obtener datos frescos en background
    this.getUserData();
    this.getHistoryPluginUsage();
    this.listenGroupedTrades();
    this.fetchUserRules();

    // Deshabilitado temporalmente para evitar recargas automáticas que causan duplicación de datos
    // this.updateSubscription = interval(120000).subscribe(() => {
    //   if (this.userKey) {
    //     this.startLoading();
    //     if (this.user) {
    //       this.fetchUserAccounts();
    //     }
    //   }
    // });
  }

  private startLoading() {
    this.loading = true;
    
    // Timeout de seguridad más agresivo para evitar loading infinito
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    
    this.loadingTimeout = setTimeout(() => {
      console.warn('Loading timeout reached, forcing stop');
      this.loading = false;
      this.showReloadButton = true;
    }, 10000); // 10 segundos máximo
  }

  private stopLoading() {
    this.loading = false;
    this.showReloadButton = false;
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
  }

  // Métodos para persistencia local
  private loadSavedData() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    try {
      // Cargar datos de reporte
      const savedReportData = localStorage.getItem(this.STORAGE_KEYS.REPORT_DATA);
      if (savedReportData) {
        const reportData = JSON.parse(savedReportData);
        if (reportData.accountHistory && reportData.stats) {
          this.accountHistory = reportData.accountHistory;
          this.stats = reportData.stats;
          this.store.dispatch(setGroupedTrades({ groupedTrades: this.accountHistory }));
          console.log('Datos de reporte cargados desde localStorage:', this.accountHistory.length, 'trades');
        }
      }

      // Cargar cuentas guardadas
      const savedAccountsData = localStorage.getItem(this.STORAGE_KEYS.ACCOUNTS_DATA);
      if (savedAccountsData) {
        this.accountsData = JSON.parse(savedAccountsData);
        console.log('Cuentas cargadas desde localStorage:', this.accountsData.length, 'cuentas');
      }

      // Cargar cuenta actual
      const savedCurrentAccount = localStorage.getItem(this.STORAGE_KEYS.CURRENT_ACCOUNT);
      if (savedCurrentAccount) {
        this.currentAccount = JSON.parse(savedCurrentAccount);
        console.log('Cuenta actual cargada desde localStorage:', this.currentAccount?.accountName);
      }

      // Cargar datos de usuario
      const savedUserData = localStorage.getItem(this.STORAGE_KEYS.USER_DATA);
      if (savedUserData) {
        this.user = JSON.parse(savedUserData);
        console.log('Datos de usuario cargados desde localStorage');
      }

    } catch (error) {
      console.error('Error cargando datos guardados:', error);
      this.clearSavedData();
    }
  }

  private saveDataToStorage() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    try {
      // Guardar datos de reporte
      if (this.accountHistory.length > 0 && this.stats) {
        const reportData = {
          accountHistory: this.accountHistory,
          stats: this.stats,
          lastUpdated: Date.now()
        };
        localStorage.setItem(this.STORAGE_KEYS.REPORT_DATA, JSON.stringify(reportData));
      }

      // Guardar cuentas
      if (this.accountsData.length > 0) {
        localStorage.setItem(this.STORAGE_KEYS.ACCOUNTS_DATA, JSON.stringify(this.accountsData));
      }

      // Guardar cuenta actual
      if (this.currentAccount) {
        localStorage.setItem(this.STORAGE_KEYS.CURRENT_ACCOUNT, JSON.stringify(this.currentAccount));
      }

      // Guardar datos de usuario
      if (this.user) {
        localStorage.setItem(this.STORAGE_KEYS.USER_DATA, JSON.stringify(this.user));
      }

      console.log('Datos guardados en localStorage');
    } catch (error) {
      console.error('Error guardando datos:', error);
    }
  }

  private clearSavedData() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    try {
      localStorage.removeItem(this.STORAGE_KEYS.REPORT_DATA);
      localStorage.removeItem(this.STORAGE_KEYS.ACCOUNTS_DATA);
      localStorage.removeItem(this.STORAGE_KEYS.CURRENT_ACCOUNT);
      localStorage.removeItem(this.STORAGE_KEYS.USER_DATA);
      console.log('Datos guardados limpiados');
    } catch (error) {
      console.error('Error limpiando datos guardados:', error);
    }
  }

  private isDataStale(): boolean {
    if (!isPlatformBrowser(this.platformId)) return true;
    
    try {
      const savedReportData = localStorage.getItem(this.STORAGE_KEYS.REPORT_DATA);
      if (savedReportData) {
        const reportData = JSON.parse(savedReportData);
        const lastUpdated = reportData.lastUpdated || 0;
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000; // 5 minutos
        
        return (now - lastUpdated) > fiveMinutes;
      }
    } catch (error) {
      console.error('Error verificando antigüedad de datos:', error);
    }
    
    return true;
  }

  ngOnDestroy() {
    this.updateSubscription?.unsubscribe();
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
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
          // Guardar datos de usuario en localStorage
          this.saveDataToStorage();
          
          // Siempre recargar cuentas para obtener las más recientes
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
        this.currentAccount = null;
        this.stopLoading();
      } else {
        this.accountsData = accounts;
        
        // Verificar si la cuenta actual sigue existiendo
        if (this.currentAccount) {
          const currentAccountExists = this.accountsData.find(acc => acc.id === this.currentAccount?.id);
          if (!currentAccountExists) {
            // Si la cuenta actual ya no existe, seleccionar la primera
            this.currentAccount = this.accountsData[0];
          }
        } else {
          // Si no hay cuenta actual, seleccionar la primera
          this.currentAccount = this.accountsData[0];
        }
        
        // Guardar cuentas en localStorage
        this.saveDataToStorage();
        
        if (this.accountsData.length === 0) {
          this.stopLoading();
        } else {
          // Procesar la cuenta actual
          const accountToProcess = this.currentAccount || this.accountsData[0];
          setTimeout(() => {
            this.fetchUserKey(accountToProcess);
          }, 1000);
        }
      }
    }).catch((error) => {
      console.error('Error fetching user accounts:', error);
      this.accountsData = [];
      this.currentAccount = null;
      this.stopLoading();
    });
  }

  fetchUserRules() {
    this.strategySvc
      .getStrategyConfig(this.user?.id)
      .then((data) => {
        if (data) {
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
        this.stopLoading();
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
    const stats = {
      netPnl: calculateNetPnl(trades),
      tradeWinPercent: calculateTradeWinPercent(trades),
      profitFactor: calculateProfitFactor(trades),
      avgWinLossTrades: calculateAvgWinLossTrades(trades),
      totalTrades: calculateTotalTrades(trades),
    };
    
    return stats;
  }

  fetchUserKey(account: AccountData) {
    console.log('Fetching user key for account:', account.accountName);
    
    // Timeout de seguridad para getUserKey
    const userKeyTimeout = setTimeout(() => {
      console.error('getUserKey timeout - forcing stop');
      this.stopLoading();
    }, 8000);

    this.reportService
      .getUserKey(
        account.emailTradingAccount,
        account.brokerPassword,
        account.server
      )
      .subscribe({
        next: (key: string) => {
          clearTimeout(userKeyTimeout);
          console.log('User key received:', key ? 'Success' : 'Empty');
          
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
            account.accountNumber
          );

          this.store.dispatch(setUserKey({ userKey: key }));
        },
        error: (err) => {
          clearTimeout(userKeyTimeout);
          console.error('Error fetching user key:', err);
          this.store.dispatch(setUserKey({ userKey: '' }));
          this.stopLoading();
        },
      });
  }

  fetchHistoryData(
    key: string,
    accountId: string,
    accNum: number
  ) {
    console.log('Fetching history data for account:', accountId);
    
    // Timeout de seguridad para getHistoryData
    const historyTimeout = setTimeout(() => {
      console.error('getHistoryData timeout - forcing stop');
      this.stopLoading();
    }, 8000);

    this.reportService
      .getHistoryData(accountId, key, accNum)
      .subscribe({
        next: (groupedTrades: GroupedTrade[]) => {
          clearTimeout(historyTimeout);
          console.log('History data received:', groupedTrades.length, 'trades');
          
          // Reemplazar en lugar de acumular para evitar duplicados
          this.store.dispatch(
            setGroupedTrades({
              groupedTrades: groupedTrades,
            })
          );

          // Guardar datos en localStorage después de recibir respuesta exitosa
          this.saveDataToStorage();

          // Siempre ocultar loading después de recibir respuesta
          this.stopLoading();
        },
        error: (err) => {
          clearTimeout(historyTimeout);
          console.error('Error fetching history data:', err);
          this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
          this.stopLoading();
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
    
    // Guardar stats actualizados en localStorage
    this.saveDataToStorage();
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
    this.startLoading();
    this.fromDate = Date.UTC(Number($event), 0, 1, 0, 0, 0, 0).toString();
    this.toDate = Date.UTC(Number($event), 11, 31, 23, 59, 59, 999).toString();
    this.requestYear = Number($event);

    if (this.user) {
      this.fetchUserAccounts();
    }
  }

  // Account management methods
  getCurrentAccountName(): string {
    return this.currentAccount?.accountName || 'No Account Selected';
  }

  getCurrentAccountServer(): string {
    return this.currentAccount?.server || 'No Server';
  }

  getCurrentAccountPlan(): string {
    return this.getAccountPlan(this.currentAccount);
  }

  getPlanInfo(planName: string): { name: string; price: string; accounts: number; strategies: number } {
    const plans = {
      'Free': { name: 'Free', price: '$0/month', accounts: 1, strategies: 1 },
      'Starter': { name: 'Starter', price: '$35/month', accounts: 2, strategies: 3 },
      'Pro': { name: 'Pro', price: '$99/month', accounts: 6, strategies: 8 }
    };
    
    return plans[planName as keyof typeof plans] || plans['Free'];
  }

  getAccountPlan(account: AccountData | null): string {
    if (!account) return 'Free';
    
    // Determine plan based on user data and account information
    return this.determineUserPlan(account);
  }

  private determineUserPlan(account: AccountData): string {
    // Check if user has subscription_date (indicates paid plan)
    if (this.user?.subscription_date && this.user.subscription_date > 0) {
      // Check subscription status
      if (this.user.status === 'purchased') {
        // Determine plan based on number of accounts and other factors
        const accountCount = this.accountsData.length;
        const hasMultipleStrategies = this.config && this.config.length > 1;
        
        // Pro Plan: 6 accounts, 8 strategies, or high usage indicators
        if (accountCount >= 6 || (accountCount >= 2 && this.user.number_trades > 100)) {
          return 'Pro';
        }
        // Starter Plan: 2 accounts, 3 strategies, or moderate usage
        else if (accountCount >= 2 || (accountCount >= 1 && this.user.number_trades > 20)) {
          return 'Starter';
        }
        // Free Plan: 1 account, 1 strategy
        else {
          return 'Free';
        }
      }
    }
    
    // Check if user has any trading activity (might indicate a trial or free tier)
    if (this.user?.number_trades && this.user.number_trades > 0) {
      const accountCount = this.accountsData.length;
      
      // If user has multiple accounts but no subscription, they might be on trial
      if (accountCount >= 2) {
        return 'Starter';
      }
    }
    
    // Default to Free plan if no subscription and no activity
    return 'Free';
  }

  toggleAccountDropdown() {
    this.showAccountDropdown = !this.showAccountDropdown;
  }

  selectAccount(account: AccountData) {
    this.currentAccount = account;
    this.showAccountDropdown = false;
    
    // Guardar cuenta seleccionada en localStorage
    this.saveDataToStorage();
    
    this.startLoading();
    
    // Limpiar datos anteriores
    this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
    
    // Fetch data for the selected account
    this.fetchUserKey(account);
  }

  goToEditStrategy() {
    this.router.navigate(['/edit-strategy']);
  }

  exportAllData() {
    const csvData = this.generateAllReportsCSV();
    this.downloadCSV(csvData, `my-reports-${new Date().toISOString().split('T')[0]}.csv`);
  }

  generateAllReportsCSV(): string {
    const headers = [
      'Date', 
      'Account Name', 
      'Plan', 
      'Net P&L', 
      'Trades Count', 
      'Win Percentage', 
      'Strategy Followed',
      'Profit Factor',
      'Avg Win/Loss Trades'
    ];
    const rows = [headers.join(',')];

    // Add summary data
    const summaryRow = [
      new Date().toISOString().split('T')[0],
      this.getCurrentAccountName(),
      this.getCurrentAccountPlan(),
      this.stats?.netPnl?.toFixed(2) || '0',
      this.stats?.totalTrades?.toString() || '0',
      `${this.stats?.tradeWinPercent?.toFixed(1) || '0'}%`,
      'Yes',
      this.stats?.profitFactor?.toFixed(2) || '0',
      this.stats?.avgWinLossTrades?.toFixed(2) || '0'
    ];
    rows.push(summaryRow.join(','));

    // Add detailed trade data
    this.accountHistory.forEach(trade => {
      const tradeDate = new Date(Number(trade.updatedAt)).toISOString().split('T')[0];
      const tradeRow = [
        tradeDate,
        this.getCurrentAccountName(),
        this.getCurrentAccountPlan(),
        (trade.pnl || 0).toFixed(2),
        '1',
        trade.pnl && trade.pnl > 0 ? '100' : '0',
        'Yes',
        '1.00',
        (trade.pnl || 0).toFixed(2)
      ];
      rows.push(tradeRow.join(','));
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

  // Navegar a trading accounts
  navigateToTradingAccounts() {
    this.router.navigate(['/trading-accounts']);
  }

  // Método para recargar datos manualmente
  reloadData() {
    console.log('Manual reload triggered');
    this.showReloadButton = false;
    this.startLoading();
    
    // Limpiar datos anteriores y localStorage
    this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
    this.accountHistory = [];
    this.stats = undefined;
    this.clearSavedData();
    
    // Reiniciar el proceso de carga
    if (this.user) {
      this.fetchUserAccounts();
    } else {
      this.getUserData();
    }
  }

  // Método para forzar recarga de cuentas
  refreshAccounts() {
    console.log('Refreshing accounts...');
    if (this.user) {
      this.fetchUserAccounts();
    }
  }
}
