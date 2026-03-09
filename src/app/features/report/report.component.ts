import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { AppContextService } from '../../shared/context';
import {
  setAvgWnL,
  setGroupedTrades,
  setNetPnL,
  setProfitFactor,
  setTotalTrades,
  setTradeWin,
  setUserKey,
} from './store/report.actions';
import { selectGroupedTrades } from './store/report.selectors';
import { Subscription } from 'rxjs';
import { ReportService } from './service/report.service';
import {
  displayConfigData,
  GroupedTradeFinal,
  MonthlyReport,
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
import { ConfigurationOverview, RuleType, StrategyState } from '../strategy/models/strategy.model';
import { WinLossChartComponent } from './components/winLossChart/win-loss-chart.component';
import moment from 'moment-timezone';
import { Router } from '@angular/router';
import { User } from '../overview/models/overview';
import { selectUser } from '../auth/store/user.selectios';
import { AuthService } from '../auth/service/authService';
import { initialStrategyState } from '../strategy/store/strategy.reducer';
import { AccountData } from '../auth/models/userModel';
import { PlanLimitationsGuard } from '../../core/guards';
import { PlanLimitationModalData } from '../../shared/interfaces/plan-limitation-modal.interface';
import { PlanLimitationModalComponent } from '../../shared/components/plan-limitation-modal/plan-limitation-modal.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { TradingHistorySyncService } from './services/trading-history-sync.service';
import { BackendApiService } from '../../core/services/backend-api.service';
import { PositionData } from './models/trading-history.model';
import { ToastNotificationService } from '../../shared/services/toast-notification.service';

/**
 * Main component for displaying trading reports and analytics.
 *
 * This component is the central hub for displaying comprehensive trading data including:
 * - Trading statistics (Net PnL, Win Rate, Profit Factor, etc.)
 * - PnL charts with monthly/yearly views
 * - Calendar view of trades with strategy compliance
 * - Win/Loss ratio visualization
 * - Account balance information
 * - Strategy configuration display
 *
 * Key Features:
 * - Fetches trading history from TradeLocker API
 * - Processes and groups trades by position
 * - Calculates trading statistics
 * - Manages multiple trading accounts
 * - Caches data in localStorage for performance
 * - Updates monthly reports in Firebase
 * - Handles plan limitations and access control
 *
 * Data Flow:
 * 1. Component initializes and loads saved data from localStorage
 * 2. Subscribes to AppContextService for user, accounts, and strategies
 * 3. Fetches fresh data from API for current account
 * 4. Processes trades and calculates statistics
 * 5. Updates NgRx store and AppContextService
 * 6. Displays data in child components (charts, calendar, stats)
 *
 * Relations:
 * - ReportService: Fetches trading data from API
 * - AppContextService: Global state management
 * - Store (NgRx): Local state for report data
 * - AuthService: User authentication and account management
 * - SettingsService: Strategy configuration
 * - CalendarComponent: Calendar view of trades
 * - PnlGraphComponent: PnL chart visualization
 * - WinLossChartComponent: Win/loss ratio chart
 * - statCardComponent: Individual statistic cards
 *
 * @component
 * @selector app-report
 * @standalone true
 */
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
    PlanLimitationModalComponent,
    LoadingSpinnerComponent,
  ],
})
export class ReportComponent implements OnInit {
  accessToken: string | null = null;
  accountDetails: any = null;
  accountsData: AccountData[] = [];
  accountHistory: GroupedTradeFinal[] = [];
  filteredAccountHistory: GroupedTradeFinal[] | null = null;
  errorMessage: string | null = null;
  stats: StatConfig = {
    netPnl: 0,
    tradeWinPercent: 0,
    profitFactor: 0,
    avgWinLossTrades: 0,
    totalTrades: 0,
    activePositions: 0
  };
  userKey!: string;
  config!: displayConfigData[];
  loading = false;
  fromDate = '';
  toDate = '';
  user: User | null = null;
  requestYear: number = 0;
  private updateSubscription?: Subscription;
  private loadingTimeout?: any;
  strategies: ConfigurationOverview[] = [];
  
  // Account management
  currentAccount: AccountData | null = null;
  showAccountDropdown = false;
  showReloadButton = false;
  
  // Balance data from API (mantener para compatibilidad)
  balanceData: any = null;
  
  // Balance from REST (context updated by loadAccountBalancesOnLogin / loadAccountMetricsFromBackend)
  realTimeBalance: number | null = null;
  
  // Flag para rastrear si hay peticiones en curso
  private hasPendingRequests = false;
  
  // Flag para evitar cargar la misma cuenta múltiples veces
  private isLoadingAccount: string | null = null;
  
  // Flag para evitar mostrar toast duplicado en la carga inicial
  private hasShownInitialToast = false;
  
  // Sync status text for UI display
  syncStatusText: string = '';
  

  // Plan limitation modal
  planLimitationModal: PlanLimitationModalData = {
    showModal: false,
    modalType: 'blocked',
    title: '',
    message: '',
    primaryButtonText: '',
    onPrimaryAction: () => {}
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private store: Store,
    private reportService: ReportService,
    private userService: AuthService,
    private strategySvc: SettingsService,
    private router: Router,
    private planLimitationsGuard: PlanLimitationsGuard,
    private appContext: AppContextService,
    private tradingHistorySync: TradingHistorySyncService,
    private backendApi: BackendApiService,
    private toastService: ToastNotificationService,
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
    this.startLoading();
    this.loadSavedData();
    this.subscribeToContextData();
    this.getUserData();
    this.initializeStrategies();
    this.listenGroupedTrades();
    this.fetchUserRules();
    this.checkUserAccess();
  }

  private subscribeToContextData() {
    // Suscribirse a los datos del usuario
    this.appContext.currentUser$.subscribe(user => {
      this.user = user;
    });

    this.appContext.userAccounts$.subscribe(accounts => {
      if (accounts.length > 0) {
        const currentAccountInList = accounts[0];
        
        if (this.currentAccount && 
            this.currentAccount.accountID === currentAccountInList.accountID &&
            (!this.balanceData || !this.stats || this.accountHistory.length === 0)) {
          this.loading = true;
          this.fetchHistoryData(this.currentAccount.accountID, this.currentAccount.accountNumber);
          return;
        }
      }
      
      if (JSON.stringify(this.accountsData) === JSON.stringify(accounts)) {
        return;
      }
      
      this.accountsData = accounts;
      if (accounts.length > 0) {
        const newAccount = accounts[0];
        const accountChanged = !this.currentAccount || 
                               this.currentAccount.accountID !== newAccount.accountID;
        
        if (accountChanged) {
          this.currentAccount = newAccount;
          this.isLoadingAccount = null;
          const isNew = this.isNewAccount(this.currentAccount);
          
          if (isNew) {
            this.startInternalLoading();
            this.fetchUserKey(this.currentAccount);
          } else {
            this.startInternalLoading();
            this.loadSavedReportData(this.currentAccount.accountID);
          }
        }
      } else {
        this.currentAccount = null;
        this.accountHistory = [];
        this.stats = {
          netPnl: 0,
          tradeWinPercent: 0,
          profitFactor: 0,
          avgWinLossTrades: 0,
          totalTrades: 0,
          activePositions: 0
        };
        this.balanceData = null;
        this.stopInternalLoading();
      }
    });

    // Suscribirse a las estrategias del usuario
    this.appContext.userStrategies$.subscribe(strategies => {
      this.strategies = strategies;
    });
    
    // Suscribirse a balances en tiempo real
    this.appContext.accountBalances$.subscribe(balances => {
      if (this.currentAccount) {
        const accountId = this.currentAccount.accountID || this.currentAccount.id;
        const realTimeBalance = balances.get(accountId);
        
        if (realTimeBalance !== undefined && realTimeBalance !== null) {
          this.realTimeBalance = realTimeBalance;
          
          // Actualizar balanceData si existe
          if (this.balanceData) {
            this.balanceData = {
              ...this.balanceData,
              balance: realTimeBalance
            };
          } else {
            // Crear balanceData básico si no existe
            this.balanceData = {
              balance: realTimeBalance
            };
          }
        }
      }
    });
  }

  private startLoading() {
    // Loading general solo para cuentas
    this.loading = true;
    
    // Timeout de seguridad - increased to 15 seconds to allow all data to load
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    
    this.loadingTimeout = setTimeout(() => {
      // Only force-stop loading if we have basic data, otherwise keep loading
      if (this.currentAccount && this.stats) {
        this.loading = false;
      }
    }, 15000);
  }

  private startInternalLoading() {
    // Loading interno para datos de reporte
    this.hasPendingRequests = true;
    this.loading = true;
    
    // Reset data - use empty/null to indicate "not loaded yet"
    this.accountHistory = [];
    this.syncStatusText = '';
    // Don't reset stats to 0 values here - keep them null/undefined until real data arrives
    // This prevents showing partial data (balance card with empty stats)
    
    this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
    this.store.dispatch(setNetPnL({ netPnL: 0 }));
    this.store.dispatch(setTradeWin({ tradeWin: 0 }));
    this.store.dispatch(setProfitFactor({ profitFactor: 0 }));
    this.store.dispatch(setAvgWnL({ avgWnL: 0 }));
    this.store.dispatch(setTotalTrades({ totalTrades: 0 }));
  }

  private stopLoading() {
    this.hasPendingRequests = false;
    this.checkIfAllDataLoaded();
  }

  private stopInternalLoading() {
    this.hasPendingRequests = false;
    this.checkIfAllDataLoaded();
  }

  private isNewAccount(account: AccountData): boolean {
    if (!account || !isPlatformBrowser(this.platformId)) {
      return false;
    }

    try {
      const savedData = this.appContext.getTradingHistoryForAccount(account.id);
      return !savedData || !savedData.accountHistory || !savedData.stats;
    } catch (error) {
      console.error('Error verificando si la cuenta es nueva:', error);
      return true;
    }
  }

  private checkIfAllDataLoaded() {
    if (this.hasPendingRequests) {
      return;
    }

    // Verify ALL required data is loaded before removing loading state
    const hasAccount = !!this.currentAccount;
    const hasHistory = Array.isArray(this.accountHistory); // Can be empty array, that's ok
    const hasStats = this.stats !== null && 
                     this.stats.netPnl !== undefined &&
                     this.stats.totalTrades !== undefined;
    const hasStrategies = Array.isArray(this.strategies);
    
    // Only remove loading when all data is ready
    const allDataReady = hasAccount && hasHistory && hasStats && hasStrategies;

    if (allDataReady) {
      setTimeout(() => {
        this.loading = false;
      }, 300);
    }
  }


  private loadSavedReportData(accountID: string) {
    if (!isPlatformBrowser(this.platformId) || !accountID) {
      this.stopInternalLoading();
      return;
    }
        
    try {
      const savedData = this.appContext.getTradingHistoryForAccount(accountID);
      
      if (savedData && savedData.accountHistory && savedData.stats) {
        setTimeout(() => {
          this.accountHistory = savedData.accountHistory;
          this.stats = savedData.stats;
          this.balanceData = savedData.balanceData;
          
          const groupedTrades = Array.isArray(savedData.accountHistory) ? 
            savedData.accountHistory.map((trade: any) => ({
              ...trade,
              pnl: trade.pnl ?? 0,
              isWon: trade.isWon ?? false,
              isOpen: trade.isOpen ?? false
            })) : [];
          this.store.dispatch(setGroupedTrades({ groupedTrades }));
          
          // No hay status de sync desde cache ya que siempre es fresco o in-memory
          this.syncStatusText = '';
          
          this.hasPendingRequests = false;
          this.checkIfAllDataLoaded();
        }, 800);
      } else {
        // Si no hay datos en contexto, disparar carga desde API
        console.log('🔄 [Context] No hay datos en memoria para el reporte, iniciando carga desde API...');
        if (this.currentAccount) {
          this.fetchHistoryData(this.currentAccount.accountID, this.currentAccount.accountNumber);
        } else {
          this.stopInternalLoading();
        }
      }
    } catch (error) {
      console.error('Error cargando datos de reporte:', error);
      this.stopInternalLoading();
    }
  }

  private loadSavedData() {
    if (!isPlatformBrowser(this.platformId)) return;
  }

  private clearSavedData() {
    if (!isPlatformBrowser(this.platformId)) return;
  } 

  private async initializeStrategies(): Promise<void> {
    if (this.user?.id) {
      try {
        this.strategies = await this.strategySvc.getUserStrategyViews(this.user.id);
        this.checkIfAllDataLoaded();
      } catch (error) {
        console.error('Error loading strategies:', error);
        this.checkIfAllDataLoaded();
      }
      } else {
        this.checkIfAllDataLoaded();
      }
  }

  ngOnDestroy() {
    this.updateSubscription?.unsubscribe();

    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
  }

  getUserData() {
    this.store.select(selectUser).subscribe({
      next: (user) => {
        this.user = user.user;
        if (this.user) {
          this.useAccountsFromContext();
        }
      },
      error: (err) => {
        console.error('Error fetching user data', err);
        this.checkIfAllDataLoaded();
      },
    });
  }

  useAccountsFromContext() {
    const contextAccounts = this.appContext.userAccounts();
    if (contextAccounts && contextAccounts.length > 0) {
      if (JSON.stringify(this.accountsData) === JSON.stringify(contextAccounts)) {
        return;
      }
      
      this.accountsData = contextAccounts;
      this.currentAccount = this.accountsData[0];
      this.checkIfAllDataLoaded();
      this.loading = true;
      this.fetchHistoryData(this.currentAccount.accountID, this.currentAccount.accountNumber);
    } else {
      this.startLoading();
      this.fetchUserAccounts();
    }
  }


  fetchUserAccounts() {
    this.userService.getUserAccounts(this.user?.id).then((accounts) => {
      if (!accounts || accounts.length === 0) {
        this.accountsData = [];
        this.currentAccount = null;
        this.accountHistory = [];
        this.stats = {
          netPnl: 0,
          tradeWinPercent: 0,
          profitFactor: 0,
          avgWinLossTrades: 0,
          totalTrades: 0,
          activePositions: 0
        };
        this.balanceData = null;
        // No accounts = stop loading (nothing to load)
        this.hasPendingRequests = false;
        this.loading = false;
      } else {
        this.accountsData = accounts;
        this.currentAccount = accounts[0];
        // Keep loading = true, fetchHistoryData will handle it
        this.fetchHistoryData(this.currentAccount.accountID, this.currentAccount.accountNumber);
      }
    }).catch((error) => {
      console.error('Error fetching user accounts:', error);
      this.accountsData = [];
      this.currentAccount = null;
      this.accountHistory = [];
      this.stats = {
        netPnl: 0,
        tradeWinPercent: 0,
        profitFactor: 0,
        avgWinLossTrades: 0,
        totalTrades: 0,
        activePositions: 0
      };
      this.balanceData = null;
      // Error = stop loading
      this.hasPendingRequests = false;
      this.loading = false;
    });
  }

  fetchUserRules() {
    const userId = this.user?.id;
    if (!userId) {
      this.store.dispatch(resetConfig({ config: initialStrategyState }));
      this.config = this.prepareConfigDisplayData(initialStrategyState);
      this.checkIfAllDataLoaded();
      return;
    }
    this.strategySvc
      .getConfiguration(userId)
      .then((data) => {
        if (data) {
          this.store.dispatch(resetConfig({ config: data }));
          this.config = this.prepareConfigDisplayData(data);
        } else {
          this.store.dispatch(resetConfig({ config: initialStrategyState }));
          this.config = this.prepareConfigDisplayData(initialStrategyState);
        }
        this.checkIfAllDataLoaded();
      })
      .catch((err) => {
        console.error('Error to get the config', err);
        this.store.dispatch(resetConfig({ config: initialStrategyState }));
        this.config = this.prepareConfigDisplayData(initialStrategyState);
        this.checkIfAllDataLoaded();
      });
  }

  onStrategyPercentageChange(percentage: number) {
    if (this.user) {
      this.updateFirebaseUserData(percentage);
    }
  }

  onDataFiltered(filteredData: GroupedTradeFinal[]) {
    if (filteredData.length === 0) {
      this.filteredAccountHistory = null;
    } else {
      this.filteredAccountHistory = filteredData;
    }
  }

  private clearDataFilter() {
    this.filteredAccountHistory = null;
  }

  updateFirebaseUserData(percentage: number) {
    if (this.user?.id) {
      const actualYear = new Date().getFullYear();
      const requestYear = this.requestYear;
      
      if (actualYear === requestYear) {
        this.userService.updateUser(this.user.id, {
          strategy_followed: Number(percentage),
          lastUpdated: new Date().getTime()
        }).catch(error => {
          console.error('Error updating user strategy_followed:', error);
        });
      }

      const monthlyReport = {
        id: this.user?.id,
        strategy_followed: percentage,
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
        this.clearDataFilter();
        this.updateReportStats(this.store, groupedTrades);
      },
    });
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
          this.checkIfAllDataLoaded();
          
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
            account.accountID,
            account.accountNumber
          );

          this.store.dispatch(setUserKey({ userKey: key }));
        },
        error: (err) => {
          console.error('Error fetching user key:', err);
          this.store.dispatch(setUserKey({ userKey: '' }));
          this.checkIfAllDataLoaded();
          this.hasPendingRequests = false;
        },
      });
  }

  async fetchHistoryData(
    accountId: string,
    accNum: number
  ) {
    // Evitar cargar la misma cuenta múltiples veces
    if (this.isLoadingAccount === accountId) {
      return;
    }

    if (!this.user?.id) {
      this.toastService.showError('User ID not available');
      this.hasPendingRequests = false;
      this.checkIfAllDataLoaded();
      return;
    }

    this.isLoadingAccount = accountId;
    this.hasPendingRequests = true;
    this.loading = true;

    const startTime = Date.now();
    try {
      const response = await this.reportService.getHistoryData(accountId, accNum).toPromise();
      
      if (response && response.trades && response.trades.length > 0) {
        this.accountHistory = response.trades;
        
        if (response.metrics) {
          this.stats = {
            netPnl: response.metrics.totalPnL || 0,
            tradeWinPercent: response.metrics.percentageTradeWin || 0,
            profitFactor: response.metrics.profitFactor || 0,
            totalTrades: response.metrics.totalTrades || 0,
            avgWinLossTrades: response.metrics.averageWinLossTrades || 0,
            activePositions: response.metrics.openPositions || this.accountHistory.filter(t => t.isOpen).length
          };
        } else {
          this.updateReportStats(this.store, response.trades);
        }
        
        this.store.dispatch(setGroupedTrades({ groupedTrades: this.accountHistory }));
        this.store.dispatch(setNetPnL({ netPnL: this.stats.netPnl }));
        this.store.dispatch(setTradeWin({ tradeWin: this.stats.tradeWinPercent }));
        this.store.dispatch(setProfitFactor({ profitFactor: this.stats.profitFactor }));
        this.store.dispatch(setAvgWnL({ avgWnL: this.stats.avgWinLossTrades }));
        this.store.dispatch(setTotalTrades({ totalTrades: this.stats.totalTrades }));
        
        if (this.currentAccount) {
          const contextData = {
            accountHistory: this.accountHistory,
            stats: this.stats,
            balanceData: this.balanceData,
            lastUpdated: Date.now()
          };
          this.appContext.setTradingHistoryForAccount(this.currentAccount.id, contextData);
          // Se eliminó el guardado en caché persistente
        }
        
        // Update sync status text based on data source
        const responseTime = Date.now() - startTime;
        const source = response.source || 'tradelocker';
        
        if (source === 'firebase') {
          // Data came from Firebase (TradeLocker was unavailable)
          const syncAt = response.syncMetadata?.sync_at;
          if (syncAt) {
            this.syncStatusText = `Synced from Firebase (last updated: ${this.formatSyncDate(syncAt)}) in ${this.toastService.formatResponseTime(responseTime)}`;
          } else {
            this.syncStatusText = `Synced from Firebase in ${this.toastService.formatResponseTime(responseTime)}`;
          }
          
          // Show warning toast only once about TradeLocker being unavailable
          if (!this.hasShownInitialToast) {
            this.toastService.showWarning(
              'TradeLocker unavailable. Showing cached data from Firebase.',
              'Data Source Warning'
            );
            this.hasShownInitialToast = true;
          }
        } else {
          // Data came from TradeLocker API
          this.syncStatusText = `Synced from TradeLocker API in ${this.toastService.formatResponseTime(responseTime)}`;
        }
        
        // Handle any additional warnings from backend
        if (response.warning && !this.hasShownInitialToast) {
          this.toastService.showFallbackWarning(response.warning, responseTime);
          this.hasShownInitialToast = true;
        }
        
        this.hasPendingRequests = false;
        this.checkIfAllDataLoaded();
      } else {
        // Se eliminó la recuperación desde caché persistente en caso de error o datos vacíos
        this.setInitialValues();
        this.hasPendingRequests = false;
        this.checkIfAllDataLoaded();
      }
    } catch (error) {
      console.error('Error in fetchHistoryData:', error);
      
      // Se eliminó la recuperación desde caché persistente en caso de error
      this.setInitialValues();
      this.syncStatusText = 'Error loading data';
      this.toastService.showError('Failed to load trading history');
      this.hasPendingRequests = false;
      this.checkIfAllDataLoaded();
    } finally {
      this.isLoadingAccount = null;
    }
  }

  /**
   * Formats the sync_at date from backend to a human-readable relative time.
   * @param syncAt - The sync date string from backend (ISO format or formatted string)
   * @returns Human-readable relative time (e.g., "2 hours ago", "yesterday at 3:45 PM")
   */
  private formatSyncDate(syncAt: string): string {
    try {
      const syncMoment = moment(syncAt);
      if (!syncMoment.isValid()) {
        return syncAt;
      }
      return syncMoment.fromNow();
    } catch {
      return syncAt;
    }
  }

  /**
   * Formats the local cache status message with the last updated timestamp.
   * @param lastUpdated - The timestamp (in milliseconds) when data was last saved to localStorage
   * @returns Human-readable message (e.g., "Loaded from local cache (last updated: 2 hours ago)")
   */
  private formatLocalCacheStatus(lastUpdated?: number): string {
    if (!lastUpdated) {
      return 'Loaded from local cache';
    }
    
    try {
      const lastUpdatedMoment = moment(lastUpdated);
      if (!lastUpdatedMoment.isValid()) {
        return 'Loaded from local cache';
      }
      return `Loaded from local cache (last updated: ${lastUpdatedMoment.fromNow()})`;
    } catch {
      return 'Loaded from local cache';
    }
  }

  private setInitialValues(): void {
    this.accountHistory = [];
    this.stats = {
      netPnl: 0,
      tradeWinPercent: 0,
      profitFactor: 0,
      totalTrades: 0,
      avgWinLossTrades: 0,
      activePositions: 0
    };

    this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
    this.store.dispatch(setNetPnL({ netPnL: 0 }));
    this.store.dispatch(setTradeWin({ tradeWin: 0 }));
    this.store.dispatch(setProfitFactor({ profitFactor: 0 }));
    this.store.dispatch(setAvgWnL({ avgWnL: 0 }));
    this.store.dispatch(setTotalTrades({ totalTrades: 0 }));
  }

  updateReportStats(store: Store, groupedTrades: GroupedTradeFinal[]) {
    const normalizedTrades = groupedTrades.map(trade => ({
      ...trade,
      pnl: trade.pnl ?? 0,
      entryPrice: trade.avgPrice ?? 0,
      exitPrice: trade.avgPrice ?? 0,
      buy_price: trade.side === 'buy' ? trade.price : '0',
      sell_price: trade.side === 'sell' ? trade.price : '0',
      quantity: Number(trade.qty) ?? 0
    }));
    
    this.stats = {
      netPnl: calculateNetPnl(normalizedTrades),
      tradeWinPercent: calculateTradeWinPercent(normalizedTrades),
      profitFactor: calculateProfitFactor(normalizedTrades),
      avgWinLossTrades: calculateAvgWinLossTrades(normalizedTrades),
      totalTrades: calculateTotalTrades(normalizedTrades),
      activePositions: groupedTrades.filter(trade => trade.isOpen === true).length
    };
    
    store.dispatch(setNetPnL({ netPnL: this.stats?.netPnl || 0 }));
    store.dispatch(setTradeWin({ tradeWin: this.stats?.tradeWinPercent || 0 }));
    store.dispatch(setProfitFactor({ profitFactor: this.stats?.profitFactor || 0 }));
    store.dispatch(setAvgWnL({ avgWnL: this.stats?.avgWinLossTrades || 0 }));
    store.dispatch(setTotalTrades({ totalTrades: this.stats?.totalTrades || 0 }));
    
    setTimeout(() => {
      this.checkIfAllDataLoaded();
    }, 800);
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

  getCurrentAccountName(): string {
    return this.currentAccount?.accountName || 'No Account Selected';
  }

  getCurrentAccountServer(): string {
    return this.currentAccount?.server || 'No Server';
  }

  async getCurrentAccountPlan(): Promise<string> {
    return await this.getAccountPlan(this.currentAccount);
  }

  async getAccountPlan(account: AccountData | null): Promise<string> {
    if (!account || !this.user?.id) return 'Free';
    return await this.getUserPlanName();
  }

  private async getUserPlanName(): Promise<string> {
    if (!this.user?.id) return 'Free';
    
    try {
      const limitations = await this.planLimitationsGuard.checkUserLimitations(this.user.id);
      return limitations.planName;
    } catch (error) {
      console.error('Error getting user plan name:', error);
      return 'Free';
    }
  }

  toggleAccountDropdown() {
    this.showAccountDropdown = !this.showAccountDropdown;
  }

  async selectAccount(account: AccountData) {
    if (this.currentAccount?.accountID === account.accountID) {
      this.showAccountDropdown = false;
      return;
    }

    this.currentAccount = account;
    this.showAccountDropdown = false;
    this.clearDataFilter();
    
    // Reset toast flag when user manually changes account
    this.hasShownInitialToast = false;
    
    this.loading = true;
    this.startInternalLoading();
    this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
    this.accountHistory = [];
    this.stats = {
      netPnl: 0,
      tradeWinPercent: 0,
      profitFactor: 0,
      avgWinLossTrades: 0,
      totalTrades: 0,
      activePositions: 0
    };
    this.balanceData = null;
    this.realTimeBalance = null;
    
    if (this.currentAccount?.accountID) {
      this.appContext.clearTradingHistoryForAccount(this.currentAccount.accountID);
    }
    
    this.loading = true;
    this.hasPendingRequests = true;

    try {
      await this.fetchHistoryData(account.accountID, account.accountNumber);
      
      // Se eliminó el guardado en caché persistente
    } catch (error) {
      console.error('❌ [REPORT LOAD] selectAccount - Error al cargar datos de la nueva cuenta:', error);
      
      // Se eliminó la recuperación desde caché persistente en caso de error
      this.setInitialValues();
      this.syncStatusText = 'Error loading data';
      this.toastService.showError('Failed to load account data');
    } finally {
      this.hasPendingRequests = false;
      this.checkIfAllDataLoaded();
    }
  }

  goToStrategy() {
    this.router.navigate(['/strategy']);
  }

  async exportAllData() {
    const csvData = await this.generateAllReportsCSV();
    this.downloadCSV(csvData, `my-reports-${new Date().toISOString().split('T')[0]}.csv`);
  }

  async generateAllReportsCSV(): Promise<string> {
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
    const currentPlan = await this.getCurrentAccountPlan();
    const summaryRow = [
      new Date().toISOString().split('T')[0],
      this.getCurrentAccountName(),
      currentPlan,
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
      const tradeDate = new Date(Number(trade.lastModified)).toISOString().split('T')[0];
      const tradeRow = [
        tradeDate,
        this.getCurrentAccountName(),
        currentPlan, // Use the same plan for all trades
        (trade.pnl || 0).toFixed(2), // P&L calculado correctamente
        '1',
        trade.pnl && trade.pnl > 0 ? '100' : '0', // Win percentage basado en P&L real
        'Yes',
        '1.00',
        (trade.pnl || 0).toFixed(2) // P&L neto (mismo que P&L ya que no hay fees en el cálculo)
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

  navigateToTradingAccounts() {
    this.router.navigate(['/trading-accounts']);
  }

  refreshAccounts() {
    if (this.user) {
      this.fetchUserAccounts();
    }
  }

  reloadData() {
    this.showReloadButton = false;
    this.startLoading();
    
    // Reset toast flag when user manually reloads
    this.hasShownInitialToast = false;
    
    this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
    this.accountHistory = [];
    this.stats = {
      netPnl: 0,
      tradeWinPercent: 0,
      profitFactor: 0,
      avgWinLossTrades: 0,
      totalTrades: 0,
      activePositions: 0
    };
    this.balanceData = null;
    this.clearSavedData();
    if (this.user) {
      this.useAccountsFromContext();
    } else {
      this.getUserData();
    }
  }

  async checkUserAccess() {
    if (!this.user?.id) return;

    try {
      const accessCheck = await this.planLimitationsGuard.checkReportAccessWithModal(this.user.id);
      
      if (!accessCheck.canAccess && accessCheck.modalData && this.accountsData.length > 0) {
        this.planLimitationModal = accessCheck.modalData;
      }
    } catch (error) {
      console.error('Error checking user access:', error);
    }
  }

  onClosePlanLimitationModal() {
    this.planLimitationModal.showModal = false;
  }

  private async loadAccountData(account: AccountData): Promise<void> {
    try {
      const response = await this.reportService.getHistoryData(
        account.accountID,
        account.accountNumber
      ).toPromise();

      let balanceData = null;
      let tradingHistory: GroupedTradeFinal[] = [];

      if (response && response.trades) {
        tradingHistory = response.trades;
        
        if (response.metrics) {
          this.stats = {
            netPnl: response.metrics.totalPnL || 0,
            tradeWinPercent: response.metrics.percentageTradeWin || 0,
            profitFactor: response.metrics.profitFactor || 0,
            totalTrades: response.metrics.totalTrades || 0,
            avgWinLossTrades: response.metrics.averageWinLossTrades || 0,
            activePositions: response.metrics.openPositions || tradingHistory.filter(t => t.isOpen).length
          };
        }
      }

      const hasBackendData = tradingHistory && tradingHistory.length > 0;
      
      // Removed fallback to cached data
      
      // Removed saveAccountDataToLocalStorage call
 
      if (tradingHistory && tradingHistory.length > 0) {
        this.appContext.setTradingHistoryForAccount(account.id, {
          accountHistory: tradingHistory,
          stats: this.stats || null,
          balanceData: balanceData || this.balanceData || null,
          lastUpdated: Date.now()
        });
      }

      if (tradingHistory && tradingHistory.length > 0) {
        this.accountHistory = tradingHistory;
        this.clearDataFilter();
        
        this.store.dispatch(setGroupedTrades({ groupedTrades: tradingHistory }));
      }
    } catch (error: any) {
      console.error('❌ [REPORT LOAD] loadAccountData - ERROR:', error);
      console.error('   Error details:', {
        status: error?.status,
        statusText: error?.statusText,
        message: error?.message,
        stack: error?.stack
      });
      
      if (error?.status === 404 || error?.statusText === 'Not Found') {
        console.warn(`⚠️ No trading history found for account ${account.accountID}. This may be normal if the account has no trades.`);
        console.warn(`⚠️ No trading history found for account ${account.accountID}. This may be normal if the account has no trades.`);
      } else {
        console.error(`❌ Error loading data for account ${account.accountID}:`, error);
        this.syncStatusText = 'Error loading data';
        this.toastService.showError('Failed to load account data');
      }
    }
  }


  /**
   * Métodos de localStorage eliminados para asegurar que los datos del reporte
   * siempre sean frescos y no persistan localmente.
   */

  async refreshCurrentAccountData() {
    if (!this.currentAccount) {
      console.warn('⚠️ ReportComponent: No hay cuenta seleccionada para refrescar');
      return;
    }

    this.loading = true;
    this.startInternalLoading();
    this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
    this.accountHistory = [];
    this.stats = {
      netPnl: 0,
      tradeWinPercent: 0,
      profitFactor: 0,
      avgWinLossTrades: 0,
      totalTrades: 0,
      activePositions: 0
    };
    this.balanceData = null;
    
    this.appContext.clearTradingHistoryForAccount(this.currentAccount.accountID);
    
    try {
      await this.loadAccountData(this.currentAccount);
      await this.loadAccountMetricsFromBackend(this.currentAccount.id);
      await this.loadStrategyFollowedFromBackend();
      
    } catch (error) {
      console.error('❌ [REPORT LOAD] refreshCurrentAccountData - Error al refrescar datos desde el backend:', error);
    } finally {
      this.hasPendingRequests = false;
      this.checkIfAllDataLoaded();
    }
  }

  private async loadAccountMetricsFromBackend(accountId: string): Promise<void> {
    try {
      const auth = await import('firebase/auth');
      const { getAuth } = auth;
      const authInstance = getAuth();
      const user = authInstance.currentUser;
      
      if (!user) {
        console.warn('⚠️ [AUTH] No user authenticated');
        return;
      }

      const idToken = await user.getIdToken();
      const response = await this.backendApi.getAccountMetrics(accountId, idToken);

      if (response.success && response.data) {
        let accountMetricsData: any;
        
        if ((response.data as any).accountMetrics && Array.isArray((response.data as any).accountMetrics)) {
          const accountMetricsArray = (response.data as any).accountMetrics;
          accountMetricsData = accountMetricsArray.find((m: any) => m.accountId === accountId) || accountMetricsArray[0];
        } else {
          accountMetricsData = response.data;
        }
        
        if (!accountMetricsData) {
          console.warn('⚠️ [METRICS] No se encontraron métricas para la cuenta');
          return;
        }
        
        const metricsAreZero = accountMetricsData.netPnl === 0 && 
                               accountMetricsData.profit === 0 && 
                               accountMetricsData.bestTrade === 0;
        
        // Se eliminó la recuperación de métricas desde caché para asegurar datos frescos

        this.appContext.updateAccountMetrics(accountId, {
          netPnl: accountMetricsData.netPnl,
          profit: accountMetricsData.profit,
          bestTrade: accountMetricsData.bestTrade
        });
        
        let balanceFromBackend: number | null = null;
        if (accountMetricsData.balance !== undefined && accountMetricsData.balance !== null) {
          const balance = Number(accountMetricsData.balance);
          if (!isNaN(balance)) {
            balanceFromBackend = balance;
            if (this.currentAccount?.accountID) {
              this.appContext.updateAccountBalance(this.currentAccount.accountID, balance);
            }
            if (this.currentAccount?.id === accountId) {
              this.balanceData = {
                balance: balance,
                equity: balance,
                margin: 0,
                marginLevel: 0
              };
            }
          }
        }
        
        // Se eliminó el uso de balance desde caché

        if (this.currentAccount?.id === accountId && accountMetricsData.stats) {
          this.updateStatsFromMetrics(accountMetricsData.stats);
        }

      } else {
        console.warn('⚠️ [API] Respuesta no exitosa:', response);
      }
    } catch (error) {
      console.error(`❌ [REPORT LOAD] loadAccountMetricsFromBackend - ERROR para account ${accountId}:`, error);
      console.error('   Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      this.toastService.showBackendError(error, 'Error loading account metrics');
    }
  }

  private async loadStrategyFollowedFromBackend(): Promise<void> {
    if (!this.user?.id) {
      return;
    }

    try {
      const auth = await import('firebase/auth');
      const { getAuth } = auth;
      const authInstance = getAuth();
      const user = authInstance.currentUser;
      
      if (!user) {
        console.warn('No user authenticated');
        return;
      }

      const idToken = await user.getIdToken();
      const response = await this.backendApi.getStrategyFollowed(this.user.id, idToken);

      if (response.success && response.data) {
        this.appContext.updateUserData({
          strategy_followed: response.data.strategy_followed
        });
      }
    } catch (error) {
      console.error('Error loading strategy_followed:', error);
    }
  }

  private addTradeToCalendar(accountId: string, trade: any): void {
    try {
      if (!trade || !trade.positionId || !trade.createdDate || !trade.lastModified) {
        console.warn('⚠️ ReportComponent: Invalid trade for calendar:', trade);
        return;
      }

      // Solo procesar si es la cuenta actual
      if (this.currentAccount?.id !== accountId) {
        return;
      }

      const groupedTrade: GroupedTradeFinal = {
        id: trade.id || trade.positionId,
        positionId: trade.positionId,
        tradableInstrumentId: trade.tradableInstrumentId,
        routeId: trade.routeId,
        qty: trade.qty || '0',
        side: trade.side || '',
        type: trade.type || '',
        status: trade.status || '',
        filledQty: trade.filledQty || '0',
        avgPrice: trade.avgPrice || '0',
        price: trade.price || '0',
        stopPrice: trade.stopPrice || '0',
        validity: trade.validity || '',
        expireDate: trade.expireDate || '',
        createdDate: trade.createdDate?.toString() || Date.now().toString(),
        lastModified: trade.lastModified?.toString() || trade.closedDate?.toString() || Date.now().toString(),
        closedDate: trade.closedDate?.toString(),
        isOpen: false,
        stopLoss: trade.stopLoss || '',
        stopLossType: trade.stopLossType || '',
        takeProfit: trade.takeProfit || '',
        takeProfitType: trade.takeProfitType || '',
        strategyId: trade.strategyId || '',
        instrument: trade.instrument || trade.tradableInstrumentId || '',
        pnl: trade.pnl || 0,
        isWon: trade.isWon ?? (trade.pnl > 0)
      };

      const existingIndex = this.accountHistory.findIndex(t => t.positionId === groupedTrade.positionId);
      
      if (existingIndex >= 0) {
        this.accountHistory[existingIndex] = groupedTrade;
      } else {
        this.accountHistory.push(groupedTrade);
      }

      this.store.dispatch(setGroupedTrades({ groupedTrades: [...this.accountHistory] }));
      this.updateReportStats(this.store, this.accountHistory);
    } catch (error) {
      console.error('❌ ReportComponent: Error adding trade to calendar:', error, trade);
    }
  }

  private convertPositionToCalendarTrade(position: PositionData): GroupedTradeFinal | null {
    try {
      if (!position || !position.positionId) {
        return null;
      }

      const groupedTrade: GroupedTradeFinal = {
        id: position.id || position.positionId,
        positionId: position.positionId,
        tradableInstrumentId: position.tradableInstrumentId || position.instrumentCode || '',
        routeId: position.routeId || '1',
        qty: position.qty || '0',
        side: position.side?.toLowerCase() || '',
        type: position.type || 'market',
        status: position.status || 'Filled',
        filledQty: position.filledQty || position.qty || '0',
        avgPrice: position.avgPrice || position.price || '0',
        price: position.price || '0',
        stopPrice: position.stopPrice || '0',
        validity: position.validity || 'GTC',
        expireDate: position.expireDate || '',
        createdDate: position.createdDate || (position.openDate 
          ? position.openDate.toString()
          : Date.now().toString()),
        lastModified: position.lastModified || (position.closeDate 
          ? position.closeDate.toString()
          : Date.now().toString()),
        closedDate: position.closeDate?.toString(),
        isOpen: position.isOpen ?? false,
        stopLoss: position.stopLoss || '',
        stopLossType: position.stopLossType || '',
        takeProfit: position.takeProfit || '',
        takeProfitType: position.takeProfitType || '',
        strategyId: position.strategyId || '',
        instrument: position.instrumentName || position.instrumentCode || position.tradableInstrumentId || '',
        pnl: position.pnl || 0,
        isWon: position.isWon ?? ((position.pnl || 0) > 0)
      };

      return groupedTrade;
    } catch (error) {
      console.error('❌ ReportComponent: Error converting position to calendar trade:', error, position);
      return null;
    }
  }

  private updateStatsFromMetrics(stats: {
    netPnl: number;
    tradeWinPercent: number;
    profitFactor: number;
    avgWinLossTrades: number;
    totalTrades: number;
    activePositions: number;
  }): void {
    if (!this.stats) {
      this.stats = {} as StatConfig;
    }

    this.stats.netPnl = stats.netPnl;
    this.stats.tradeWinPercent = stats.tradeWinPercent;
    this.stats.profitFactor = stats.profitFactor;
    this.stats.avgWinLossTrades = stats.avgWinLossTrades;
    this.stats.totalTrades = stats.totalTrades;
    
    this.store.dispatch(setNetPnL({ netPnL: this.stats.netPnl }));
    this.store.dispatch(setTradeWin({ tradeWin: this.stats.tradeWinPercent }));
    this.store.dispatch(setProfitFactor({ profitFactor: this.stats.profitFactor }));
    this.store.dispatch(setAvgWnL({ avgWnL: this.stats.avgWinLossTrades }));
    this.store.dispatch(setTotalTrades({ totalTrades: this.stats.totalTrades }));
  }

  isBalancesLoading(): boolean {
    return this.appContext.balancesLoading();
  }
}