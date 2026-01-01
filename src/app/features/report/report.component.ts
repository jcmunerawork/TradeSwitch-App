import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { AppContextService } from '../../shared/context';
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
import { interval, last, map, Subscription, firstValueFrom } from 'rxjs';
import { ReportService } from './service/report.service';
import {
  displayConfigData,
  GroupedTrade,
  GroupedTradeFinal,
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
import { ConfigurationOverview, RuleType, StrategyState } from '../strategy/models/strategy.model';
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
import { PlanLimitationsGuard } from '../../core/guards';
import { PlanLimitationModalData } from '../../shared/interfaces/plan-limitation-modal.interface';
import { PlanLimitationModalComponent } from '../../shared/components/plan-limitation-modal/plan-limitation-modal.component';
import { StrategyCardData } from '../../shared/components/strategy-card/strategy-card.interface';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { PluginHistoryService, PluginHistory } from '../../shared/services/plugin-history.service';
import { TimezoneService } from '../../shared/services/timezone.service';
import { TradingHistorySyncService } from './services/trading-history-sync.service';
import { takeUntil } from 'rxjs/operators';
import { BackendApiService } from '../../core/services/backend-api.service';
import { AccountStatusService } from '../../shared/services/account-status.service';
import {
  AccountMetricsEvent,
  PositionClosedEvent,
  StrategyFollowedUpdateEvent
} from '../../shared/services/metrics-events.interface';
import { PositionData } from './models/trading-history.model';

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
  strategies: ConfigurationOverview[] = [];
  
  // Account management
  currentAccount: AccountData | null = null;
  showAccountDropdown = false;
  showReloadButton = false;
  
  // Balance data from API (mantener para compatibilidad)
  balanceData: any = null;
  
  // Real-time balance from streams
  realTimeBalance: number | null = null;
  
  // Loading state tracking for complete data loading
  loadingStates = {
    userData: false,
    accounts: false,
    strategies: false,
    userKey: false,
    historyData: false,
    balanceData: false,
    metricsData: false, // Estado de carga específico para las métricas
    config: false,
    calendarData: false // Estado de carga específico para el calendario
  };

  // Flag para rastrear si hay peticiones en curso
  private hasPendingRequests = false;
  
  // Flag para rastrear si las estadísticas están completamente procesadas
  private statsProcessed = false;
  
  // Flag para rastrear si las gráficas están completamente renderizadas
  private chartsRendered = false;
  
  // Local storage keys
  private readonly STORAGE_KEYS = {
    REPORT_DATA: 'tradeSwitch_reportData',
    ACCOUNTS_DATA: 'tradeSwitch_accountsData',
    CURRENT_ACCOUNT: 'tradeSwitch_currentAccount',
    USER_DATA: 'tradeSwitch_userData'
  };

  // Plan limitation modal
  planLimitationModal: PlanLimitationModalData = {
    showModal: false,
    modalType: 'blocked',
    title: '',
    message: '',
    primaryButtonText: '',
    onPrimaryAction: () => {}
  };

  // Flag para rastrear si los listeners de Socket.IO están configurados
  private socketListenersSetup = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private store: Store,
    private reportService: ReportService,
    private userService: AuthService,
    private strategySvc: SettingsService,
    private router: Router,
    private planLimitationsGuard: PlanLimitationsGuard,
    private appContext: AppContextService,
    private pluginHistoryService: PluginHistoryService,
    private timezoneService: TimezoneService,
    private tradingHistorySync: TradingHistorySyncService,
    private backendApi: BackendApiService,
    private accountStatusService: AccountStatusService,
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
    // SIEMPRE iniciar loading al entrar a la ventana
    this.startLoading();
    
    // Cargar datos básicos
    this.loadSavedData();
    
    // Suscribirse a los datos del contexto
    this.subscribeToContextData();
    
    // Obtener datos frescos
    this.getUserData();
    this.initializeStrategies();
    this.listenGroupedTrades();
    this.fetchUserRules();
    this.checkUserAccess();
    
    // Cargar datos de todas las cuentas
    this.loadAllAccountsData();
    
    // Configurar listeners de Socket.IO para métricas en tiempo real
    this.setupSocketListeners();
  }

  private subscribeToContextData() {
    // Suscribirse a los datos del usuario
    this.appContext.currentUser$.subscribe(user => {
      this.user = user;
    });

    // Suscribirse a las cuentas del usuario - SIEMPRE cargar la primera
    this.appContext.userAccounts$.subscribe(accounts => {
      // PRIMERO: Verificar si faltan datos antes de salir
      if (accounts.length > 0) {
        const currentAccountInList = accounts[0];
        
        // Si tenemos la misma cuenta pero nos faltan datos, cargarlos
        if (this.currentAccount && 
            this.currentAccount.accountID === currentAccountInList.accountID &&
            (!this.balanceData || !this.stats || this.accountHistory.length === 0)) {
          this.startInternalLoading();
          this.loadSavedReportData(this.currentAccount.accountID);
          return; // Salir después de cargar
        }
      }
      
      // Evitar bucles infinitos - solo procesar si hay cambios reales
      if (JSON.stringify(this.accountsData) === JSON.stringify(accounts)) {
        return;
      }
      
      this.accountsData = accounts;
      if (accounts.length > 0) {
        // Solo procesar si la cuenta actual cambió o si no hay cuenta actual
        const newAccount = accounts[0];
        const accountChanged = !this.currentAccount || 
                               this.currentAccount.accountID !== newAccount.accountID;
        
        if (accountChanged) {
          this.currentAccount = newAccount;
          
          // Verificar si es una cuenta nueva (recién registrada)
          const isNew = this.isNewAccount(this.currentAccount);
          
          if (isNew) {
            // Cuenta nueva - hacer peticiones a la API
            this.startInternalLoading();
            this.fetchUserKey(this.currentAccount);
          } else {
            // Cuenta existente - SIEMPRE mostrar loading
            this.startInternalLoading();
            this.loadSavedReportData(this.currentAccount.accountID);
          }
        }
      } else {
        // Si no hay cuentas, limpiar datos y parar loading
        this.currentAccount = null;
        this.accountHistory = [];
        this.stats = undefined;
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
    
    // Timeout de seguridad para cuentas
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    
    this.loadingTimeout = setTimeout(() => {
      this.loading = false;
    }, 2000); // 10 segundos máximo para cuentas
  }

  private startInternalLoading() {
    // Loading interno para datos de reporte
    this.hasPendingRequests = true;
    this.statsProcessed = false;
    this.chartsRendered = false;
    
    // Reset account-related loading states
    this.loadingStates = {
      userData: this.loadingStates.userData,
      accounts: this.loadingStates.accounts,
      strategies: this.loadingStates.strategies,
      userKey: false,
      historyData: false,
      balanceData: false,
      metricsData: false, // Resetear métricas al cambiar de cuenta
      config: this.loadingStates.config,
      calendarData: false
    };
    
    // Limpiar datos temporales para evitar mostrar valores 0
    this.accountHistory = [];
    this.stats = undefined;
    // NO limpiar balanceData aquí - se mantendrá del localStorage
    
    // Limpiar el store para evitar mostrar datos anteriores
    this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
    this.store.dispatch(setNetPnL({ netPnL: 0 }));
    this.store.dispatch(setTradeWin({ tradeWin: 0 }));
    this.store.dispatch(setProfitFactor({ profitFactor: 0 }));
    this.store.dispatch(setAvgWnL({ avgWnL: 0 }));
    this.store.dispatch(setTotalTrades({ totalTrades: 0 }));
    
    // Aumentar el tiempo de loading para evitar parpadeos
    setTimeout(() => {
      this.checkIfAllDataLoaded();
    }, 800); // Esperar 1 segundo antes de verificar
  }

  private stopLoading() {
    // Solo para loading interno
    this.hasPendingRequests = false;
    this.statsProcessed = true; // Marcar que las estadísticas están procesadas
    this.chartsRendered = true; // Marcar que las gráficas están renderizadas
  }

  private stopInternalLoading() {
    // Parar loading interno
    this.hasPendingRequests = false;
    this.statsProcessed = true;
    this.chartsRendered = true;
  }

  /**
   * Verificar si una cuenta es nueva (recién registrada)
   * Una cuenta es nueva si no tiene datos guardados en localStorage
   */
  private isNewAccount(account: AccountData): boolean {
    if (!account || !isPlatformBrowser(this.platformId)) {
      return false;
    }

    try {
      // Verificar si existe datos guardados para esta cuenta
      const savedData = this.appContext.loadReportDataFromLocalStorage(account.accountID);
      
      // Si no hay datos guardados, es una cuenta nueva
      return !savedData || !savedData.accountHistory || !savedData.stats;
    } catch (error) {
      console.error('Error verificando si la cuenta es nueva:', error);
      // En caso de error, asumir que es nueva
      return true;
    }
  }

  private setLoadingState(key: keyof typeof this.loadingStates, value: boolean) {
    this.loadingStates[key] = value;
    
    // Si historyData se marca como cargado, también marcar calendarData
    if (key === 'historyData' && value === true) {
      // El calendario necesita un poco más de tiempo para procesar los datos
      setTimeout(() => {
        this.setLoadingState('calendarData', true);
      }, 500); // Dar tiempo para que el calendario procese los datos
    }
    
    // Si historyData se resetea, también resetear calendarData
    if (key === 'historyData' && value === false) {
      this.setLoadingState('calendarData', false);
    }
    this.checkIfAllDataLoaded();
  }

  private checkIfAllDataLoaded() {
    // Verificar si todos los datos críticos están cargados
    const criticalDataLoaded = 
      this.loadingStates.userData &&
      this.loadingStates.accounts &&
      this.loadingStates.strategies &&
      this.loadingStates.config;

    // Si hay cuenta actual, verificar que los datos necesarios estén cargados
    // Balance e historial son independientes - no requieren ambos
    const accountDataLoaded = !this.currentAccount || 
      (this.loadingStates.userKey && 
       (this.loadingStates.historyData || this.loadingStates.balanceData));

    // Verificar que los datos estén realmente disponibles para mostrar en la UI
    const uiDataReady = this.isUIDataReady();

    // Verificar que no haya peticiones pendientes
    const noPendingRequests = !this.hasPendingRequests;
    
    // Verificar que las estadísticas estén completamente procesadas
    const statsReady = this.statsProcessed || !this.currentAccount;
    
    // Verificar que las gráficas estén completamente renderizadas
    const chartsReady = this.chartsRendered || !this.currentAccount;

    // Verificación adicional: asegurar que los datos estén realmente en localStorage
    const dataInLocalStorage = !this.currentAccount || this.isDataInLocalStorage();

    // Evitar bucles infinitos - solo procesar si no está ya procesado
    const shouldProcess = !this.statsProcessed || !this.chartsRendered;

    if (criticalDataLoaded && accountDataLoaded && uiDataReady && noPendingRequests && statsReady && chartsReady && dataInLocalStorage && shouldProcess) {
      // Todos los datos están cargados y listos para mostrar
      this.loadSavedReportData(this.currentAccount?.accountID || '');
    }
  }

  private isDataInLocalStorage(): boolean {
    if (!this.currentAccount || !isPlatformBrowser(this.platformId)) {
      return true;
    }

    try {
      const reportDataKey = `${this.STORAGE_KEYS.REPORT_DATA}_${this.currentAccount.accountID}`;
      const savedReportData = localStorage.getItem(reportDataKey);
      if (savedReportData) {
        const data = JSON.parse(savedReportData);
        return data.accountHistory && data.stats && data.balanceData !== null;
      }
    } catch (error) {
      console.error('Error checking localStorage data:', error);
    }

    return false;
  }

  private isUIDataReady(): boolean {
    // Verificar que todos los datos necesarios para la UI estén disponibles
    
    // Si no hay cuenta, no necesitamos datos de trading
    if (!this.currentAccount) {
      return true;
    }

    // Verificar que tenemos datos de balance (puede ser 0, pero debe estar cargado)
    const hasBalanceData = this.balanceData !== null && this.balanceData !== undefined;
    
    // Verificar que tenemos datos de trading history (puede ser array vacío, pero debe estar cargado)
    const hasHistoryData = Array.isArray(this.accountHistory);
    
    // Verificar que tenemos estadísticas completamente calculadas
    const hasStats = this.stats !== null && 
                     this.stats !== undefined && 
                     typeof this.stats.netPnl === 'number' &&
                     typeof this.stats.tradeWinPercent === 'number' &&
                     typeof this.stats.profitFactor === 'number' &&
                     typeof this.stats.totalTrades === 'number' &&
                     typeof this.stats.avgWinLossTrades === 'number';
    
    // Verificar que tenemos estrategias (puede ser array vacío, pero debe estar cargado)
    const hasStrategies = Array.isArray(this.strategies);

    // Para cuentas nuevas, no verificar datos reales - solo que estén cargados
    const hasProcessedData = this.statsProcessed && this.chartsRendered;

    // Balance e historial son independientes - al menos uno debe estar disponible
    const hasAccountData = hasBalanceData || hasHistoryData;

    return hasAccountData && hasStats && hasStrategies && hasProcessedData;
  }

  private hasRealChartData(): boolean {
    // Si no hay datos de trading history, las gráficas mostrarán valores por defecto
    if (!this.accountHistory || this.accountHistory.length === 0) {
      return true; // Es válido mostrar gráficas vacías si no hay datos
    }

    // Verificar que los datos de trading history tengan valores reales
    const hasRealTradingData = this.accountHistory.some(trade => 
      trade.pnl !== undefined && 
      trade.pnl !== null && 
      trade.lastModified !== undefined &&
      trade.lastModified !== null
    );

    // Verificar que las estadísticas no sean solo valores por defecto
    const hasRealStats = this.stats ? (
      this.stats.netPnl !== 0 || 
      this.stats.totalTrades > 0 ||
      this.stats.tradeWinPercent !== 0 ||
      this.stats.profitFactor !== 0
    ) : false;

    return hasRealTradingData && hasRealStats;
  }

  private loadSavedReportData(accountID: string) {
    if (!isPlatformBrowser(this.platformId) || !accountID) {
      // Si no hay accountID, parar loading interno
      this.stopInternalLoading();
      return;
    }
        
    try {
      const savedData = this.appContext.loadReportDataFromLocalStorage(accountID);
      if (savedData && savedData.accountHistory && savedData.stats) {
        // Simular tiempo de loading para mostrar el spinner
        setTimeout(() => {
          this.accountHistory = savedData.accountHistory;
          this.stats = savedData.stats;
          this.balanceData = savedData.balanceData;
          
          // Actualizar el store
          const groupedTrades = Array.isArray(savedData.accountHistory) ? 
            savedData.accountHistory.map((trade: any) => ({
              ...trade,
              pnl: trade.pnl ?? 0,
              isWon: trade.isWon ?? false,
              isOpen: trade.isOpen ?? false
            })) : [];
          this.store.dispatch(setGroupedTrades({ groupedTrades }));
          
          // Marcar como cargados
          this.setLoadingState('userKey', true);
          this.setLoadingState('historyData', true);
          // Marcar balance como cargado si existe (incluso si es null, pero está cargado)
          this.setLoadingState('balanceData', true);
          // Marcar métricas como cargadas si hay stats disponibles
          if (this.stats) {
            this.setLoadingState('metricsData', true);
          }
          // Marcar calendario como cargado después de un delay
          setTimeout(() => {
            this.setLoadingState('calendarData', true);
          }, 500);
          this.hasPendingRequests = false;
        }, 800); // Esperar 2 segundos para mostrar loading
      } else {
        // No hay datos guardados, parar loading interno
        this.stopInternalLoading();
      }
    } catch (error) {
      console.error('Error cargando datos de reporte guardados:', error);
      // En caso de error, parar loading interno
      this.stopInternalLoading();
    }
  }

  // Métodos para persistencia local
  private loadSavedData() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    try {
      // Solo cargar datos básicos para inicialización
      // Los datos de reporte se cargarán desde el contexto
      
      // Cargar cuentas guardadas (solo para inicialización)
      const savedAccountsData = localStorage.getItem(this.STORAGE_KEYS.ACCOUNTS_DATA);
      if (savedAccountsData) {
        this.accountsData = JSON.parse(savedAccountsData);
      }

      // Cargar cuenta actual (solo para inicialización)
      const savedCurrentAccount = localStorage.getItem(this.STORAGE_KEYS.CURRENT_ACCOUNT);
      if (savedCurrentAccount) {
        this.currentAccount = JSON.parse(savedCurrentAccount);
      }

      // Cargar datos de usuario (solo para inicialización)
      const savedUserData = localStorage.getItem(this.STORAGE_KEYS.USER_DATA);
      if (savedUserData) {
        this.user = JSON.parse(savedUserData);
      }

      if (this.currentAccount) {
        const savedAccountHistory = localStorage.getItem(`Balance_${this.currentAccount.accountID}`);
        if (savedAccountHistory) {
          this.balanceData = JSON.parse(savedAccountHistory);
        }
      }

    } catch (error) {
      console.error('Error cargando datos guardados:', error);
      this.clearSavedData();
    }
  }

  private saveDataToStorage() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    try {
      // Guardar datos de reporte usando el contexto
      if (this.accountHistory.length > 0 && this.stats && this.currentAccount) {
        const reportData = {
          accountHistory: this.accountHistory,
          stats: this.stats,
          balanceData: this.balanceData,
          lastUpdated: Date.now()
        };
        this.appContext.saveReportDataToLocalStorage(
          this.currentAccount.accountID,
          this.currentAccount,
          reportData
        );
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
    } catch (error) {
      console.error('Error guardando datos:', error);
    }
  }


  private clearSavedData() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    try {
      // Limpiar datos de reporte para la cuenta actual usando el contexto
      if (this.currentAccount) {
        this.appContext.clearReportDataFromLocalStorage(this.currentAccount.accountID);
      }
      localStorage.removeItem(this.STORAGE_KEYS.ACCOUNTS_DATA);
      localStorage.removeItem(this.STORAGE_KEYS.CURRENT_ACCOUNT);
      localStorage.removeItem(this.STORAGE_KEYS.USER_DATA);
    } catch (error) {
      console.error('Error limpiando datos guardados:', error);
    }
  }

  private async initializeStrategies(): Promise<void> {
    if (this.user?.id) {
      try {
        this.strategies = await this.strategySvc.getUserStrategyViews(this.user.id);
        // Marcar estrategias como cargadas
        this.setLoadingState('strategies', true);
        // Verificar si todos los datos están listos después de cargar las estrategias
        this.checkIfAllDataLoaded();
      } catch (error) {
        console.error('Error loading strategies:', error);
        // Marcar estrategias como cargadas incluso en error
        this.setLoadingState('strategies', true);
        // Verificar si todos los datos están listos incluso en caso de error
        this.checkIfAllDataLoaded();
      }
    } else {
      // Si no hay usuario, marcar como cargado
      this.setLoadingState('strategies', true);
      // Verificar si todos los datos están listos
      this.checkIfAllDataLoaded();
    }
  }

  ngOnDestroy() {
    // Limpiar suscripción de actualizaciones
    this.updateSubscription?.unsubscribe();
    
    // Limpiar todas las suscripciones de Socket.IO
    this.socketSubscriptions.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
    this.socketSubscriptions = [];
    this.socketListenersSetup = false;
    
    // Limpiar timeout
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
  }

  getUserData() {
    this.store.select(selectUser).subscribe({
      next: (user) => {
        this.user = user.user;
        if (this.user) {
          // Marcar datos de usuario como cargados
          this.setLoadingState('userData', true);
          
          // Guardar datos de usuario en localStorage
          this.saveDataToStorage();
          
          // Reutilizar cuentas del contexto (ya cargadas en login)
          this.useAccountsFromContext();
        }
      },
      error: (err) => {
        console.error('Error fetching user data', err);
        this.setLoadingState('userData', true); // Marcar como cargado incluso en error
      },
    });
  }

  useAccountsFromContext() {
    // Reutilizar cuentas del contexto (ya cargadas en login)
    const contextAccounts = this.appContext.userAccounts();
    if (contextAccounts && contextAccounts.length > 0) {
      // Evitar bucles infinitos - solo procesar si hay cambios reales
      if (JSON.stringify(this.accountsData) === JSON.stringify(contextAccounts)) {
        return;
      }
      
      this.accountsData = contextAccounts;
      this.currentAccount = this.accountsData[0]; // Siempre la primera
      
      // Guardar cuentas en localStorage
      this.saveDataToStorage();
      
      // Marcar cuentas como cargadas
      this.setLoadingState('accounts', true);
      
      // SIEMPRE iniciar loading interno para mostrar loading
      this.startInternalLoading();
      
      // Cargar datos de la primera cuenta
      this.loadSavedReportData(this.currentAccount.accountID);
      // Lanzar carga completa de todas las cuentas y actualizar métricas por cuenta
      this.loadAllAccountsData();
    } else {
      // Si no hay cuentas en el contexto, iniciar loading y cargarlas
      this.startLoading();
      this.fetchUserAccounts();
    }
  }


  fetchUserAccounts() {
    this.userService.getUserAccounts(this.user?.id).then((accounts) => {
      if (!accounts || accounts.length === 0) {
        // No hay cuentas - usuario nuevo
        this.accountsData = [];
        this.currentAccount = null;
        this.accountHistory = [];
        this.stats = undefined;
        this.balanceData = null;
        
        // Marcar cuentas como cargadas
        this.setLoadingState('accounts', true);
        
        // Parar loading general
        this.loading = false;
        
        // Parar loading interno
        this.stopInternalLoading();
      } else {
        this.accountsData = accounts;
        this.currentAccount = accounts[0]; // Siempre la primera
        
        // Guardar cuentas en localStorage
        this.saveDataToStorage();
        
        // Marcar cuentas como cargadas
        this.setLoadingState('accounts', true);
        
        // Parar loading general
        this.loading = false;
        
        // Iniciar loading interno y cargar datos de la primera cuenta
        this.startInternalLoading();
        this.loadSavedReportData(this.currentAccount.accountID);
        // Lanzar carga completa de todas las cuentas y actualizar métricas por cuenta
        this.loadAllAccountsData();
      }
    }).catch((error) => {
      console.error('Error fetching user accounts:', error);
      // En caso de error, limpiar todo
      this.accountsData = [];
      this.currentAccount = null;
      this.accountHistory = [];
      this.stats = undefined;
      this.balanceData = null;
      
      this.setLoadingState('accounts', true);
      this.loading = false; // Parar loading general
      this.stopInternalLoading();
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
        }
        // Marcar configuración como cargada
        this.setLoadingState('config', true);
        // Verificar si todos los datos están listos después de cargar la configuración
        this.checkIfAllDataLoaded();
      })
      .catch((err) => {
        console.error('Error to get the config', err);
        this.store.dispatch(resetConfig({ config: initialStrategyState }));
        this.config = this.prepareConfigDisplayData(initialStrategyState);
        // Marcar configuración como cargada incluso en error
        this.setLoadingState('config', true);
        // Verificar si todos los datos están listos incluso en caso de error
        this.checkIfAllDataLoaded();
      });
  }

  onStrategyPercentageChange(percentage: number) {
    if (this.user) {
      this.updateFirebaseUserData(percentage);
    }
  }

  updateFirebaseUserData(percentage: number) {
    if (this.user?.id) {
      const actualYear = new Date().getFullYear();
      const requestYear = this.requestYear;
      
      // Solo actualizar si es el año actual
      if (actualYear === requestYear) {
        // Usar updateUser en lugar de createUser - solo actualizar strategy_followed
        this.userService.updateUser(this.user.id, {
          strategy_followed: percentage,
          lastUpdated: new Date().getTime()
        }).catch(error => {
          console.error('Error updating user strategy_followed:', error);
        });
      }

      const monthlyReport = {
        id: this.user?.id,
        // TODO: revisar uso anterior de best_trade, ahora pertenece a AccountData
        // TODO: revisar uso anterior de netPnl, ahora pertenece a AccountData
        // TODO: revisar uso anterior de number_trades, ahora pertenece a AccountData
        // TODO: revisar uso anterior de profit, ahora pertenece a AccountData
        strategy_followed: percentage,
        // TODO: revisar uso anterior de total_spend, ahora pertenece a AccountData
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
        // Calcular estadísticas inmediatamente cuando se reciben los datos
        this.updateReportStats(this.store, groupedTrades);
        // NO verificar aquí - se verificará desde updateReportStats
        
        // Si hay trades, marcar calendarData como listo después de un breve delay
        // para dar tiempo al calendario a procesar los datos
        if (groupedTrades && groupedTrades.length > 0) {
          // Resetear primero para mostrar loading si no estaba
          if (!this.loadingStates.calendarData) {
            this.setLoadingState('calendarData', false);
          }
          // Luego marcar como listo después de un delay
          setTimeout(() => {
            this.setLoadingState('calendarData', true);
          }, 1000);
        } else {
          // Si no hay trades, marcar como listo inmediatamente
          this.setLoadingState('calendarData', true);
        }
      },
    });
  }


  fetchUserKey(account: AccountData) {
    // Usar el servicio que ya actualiza el contexto automáticamente
    this.reportService
      .getUserKey(
        account.emailTradingAccount,
        account.brokerPassword,
        account.server
      )
      .subscribe({
        next: (key: string) => {
          this.userKey = key;
          // Marcar userKey como cargado
          this.setLoadingState('userKey', true);
          
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

          // El backend gestiona el accessToken automáticamente
          this.fetchHistoryData(
            account.accountID,
            account.accountNumber
          );

          this.store.dispatch(setUserKey({ userKey: key }));
        },
        error: (err) => {
          console.error('Error fetching user key:', err);
          this.store.dispatch(setUserKey({ userKey: '' }));
          // Marcar userKey como cargado incluso en error
          this.setLoadingState('userKey', true);
          // Marcar que no hay peticiones pendientes
          this.hasPendingRequests = false;
        },
      });
  }

  async fetchHistoryData(
    accountId: string,
    accNum: number
  ) {
    // El balance ahora viene de streams API, marcar como cargado
    // (se actualizará automáticamente cuando llegue desde streams)
    this.setLoadingState('balanceData', true);
    this.checkIfAllDataLoaded();

    if (!this.user?.id) {
      console.error('User ID not available');
      this.setLoadingState('historyData', true);
      this.hasPendingRequests = false;
      return;
    }

    try {
      // 1. Primero intentar cargar desde Firebase (rápido)
      const firebaseData = await this.tradingHistorySync.loadFromFirebase(this.user.id, accountId);

      if (firebaseData && Object.keys(firebaseData.positions).length > 0) {
        // 2. Cargar datos desde Firebase y mostrar inmediatamente
        this.loadDataFromFirebase(firebaseData);
        
        // 3. Verificar si necesita sincronización
        const needsSync = this.shouldSyncHistory(firebaseData.syncMetadata);
        
        if (needsSync) {
          // Sincronizar en background (no bloquea UI)
          this.syncHistoryInBackground(accountId, accNum);
        } else {
          // Ya está actualizado, solo suscribirse a streams
        }
      } else {
        // No hay datos en Firebase, hacer sync completo
        await this.syncHistoryFromAPI(accountId, accNum);
      }
    } catch (error) {
      console.error('Error in fetchHistoryData:', error);
      // En caso de error, mostrar valores iniciales
      this.setInitialValues();
      this.setLoadingState('historyData', true);
      this.hasPendingRequests = false;
    }
  }

  /**
   * Load data from Firebase document
   */
  private loadDataFromFirebase(firebaseData: any): void {
    // Convertir posiciones a GroupedTradeFinal
    const positions = Object.values(firebaseData.positions || {}) as any[];
    this.accountHistory = positions.map(pos => 
      this.tradingHistorySync.convertToGroupedTradeFinal(pos)
    );

    // Cargar métricas
    const metrics = firebaseData.metrics || {};
    this.stats = {
      netPnl: metrics.totalPnL || 0,
      tradeWinPercent: metrics.percentageTradeWin || 0,
      profitFactor: metrics.profitFactor || 0,
      totalTrades: metrics.totalTrades || 0,
      avgWinLossTrades: metrics.averageWinLossTrades || 0,
      activePositions: firebaseData.syncMetadata?.openPositions || 0
    };

    // Actualizar store
    this.store.dispatch(setGroupedTrades({ groupedTrades: this.accountHistory }));
    this.store.dispatch(setNetPnL({ netPnL: this.stats.netPnl }));
    this.store.dispatch(setTradeWin({ tradeWin: this.stats.tradeWinPercent }));
    this.store.dispatch(setProfitFactor({ profitFactor: this.stats.profitFactor }));
    this.store.dispatch(setAvgWnL({ avgWnL: this.stats.avgWinLossTrades }));
    this.store.dispatch(setTotalTrades({ totalTrades: this.stats.totalTrades }));

    // Guardar en contexto y localStorage
    if (this.currentAccount) {
      const contextData = {
        accountHistory: this.accountHistory,
        stats: this.stats,
        balanceData: this.balanceData,
        lastUpdated: Date.now()
      };
      this.appContext.setTradingHistoryForAccount(this.currentAccount.id, contextData);
      this.saveDataToStorage();
      
      // Marcar métricas como cargadas
      this.setLoadingState('metricsData', true);
      
      // Marcar calendarData como listo después de un breve delay para procesamiento
      setTimeout(() => {
        this.setLoadingState('calendarData', true);
      }, 800);
    }

    this.statsProcessed = true;
    this.chartsRendered = true;
    this.setLoadingState('historyData', true);
    this.hasPendingRequests = false;
  }

  /**
   * Check if history needs to be synced
   */
  private shouldSyncHistory(syncMetadata: any): boolean {
    if (!syncMetadata) return true;
    
    const lastSync = syncMetadata.lastHistorySync || 0;
    const now = Date.now();
    const hoursSinceSync = (now - lastSync) / (1000 * 60 * 60);
    
    // Sincronizar si pasaron más de 24 horas
    return hoursSinceSync > 24;
  }

  /**
   * Sync history from API in background
   */
  private async syncHistoryInBackground(
    accountId: string,
    accNum: number
  ): Promise<void> {
    try {
      if (!this.user?.id) return;
      
      const result = await this.tradingHistorySync.syncHistoryFromAPI(
        this.user.id,
        accountId,
        accNum
      );

      if (result.success) {
        // Recargar datos actualizados desde Firebase
        const updatedData = await this.tradingHistorySync.loadFromFirebase(this.user.id, accountId);
        if (updatedData) {
          this.loadDataFromFirebase(updatedData);
        }
      }
    } catch (error) {
      console.error('Error syncing history in background:', error);
    }
  }

  /**
   * Sync history from API (full sync)
   */
  private async syncHistoryFromAPI(
    accountId: string,
    accNum: number
  ): Promise<void> {
    if (!this.user?.id) {
      this.setInitialValues();
      this.setLoadingState('historyData', true);
      this.hasPendingRequests = false;
      return;
    }

    try {
      const result = await this.tradingHistorySync.syncHistoryFromAPI(
        this.user.id,
        accountId,
        accNum
      );

      if (result.success) {
        // Cargar datos sincronizados
        const firebaseData = await this.tradingHistorySync.loadFromFirebase(this.user.id, accountId);
        if (firebaseData) {
          this.loadDataFromFirebase(firebaseData);
        } else {
          this.setInitialValues();
        }
      } else {
        // Error en sync, mostrar valores iniciales
        this.setInitialValues();
      }
    } catch (error) {
      console.error('Error in syncHistoryFromAPI:', error);
      this.setInitialValues();
    }

    this.setLoadingState('historyData', true);
    this.hasPendingRequests = false;
  }


  /**
   * Set initial values when there's an error or no data
   */
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
    
    // Marcar métricas como cargadas (aunque sean valores iniciales)
    this.setLoadingState('metricsData', true);
  }

  updateReportStats(store: Store, groupedTrades: GroupedTradeFinal[]) {
    // Normalizar todos los trades - asignar valores por defecto cuando falten
    const normalizedTrades = groupedTrades.map(trade => ({
      ...trade,
      pnl: trade.pnl ?? 0, // Si no hay PnL, usar 0
      entryPrice: trade.avgPrice ?? 0, // Usar avgPrice como entryPrice
      exitPrice: trade.avgPrice ?? 0, // Usar avgPrice como exitPrice
      buy_price: trade.side === 'buy' ? trade.price : '0', // Precio de compra si es buy
      sell_price: trade.side === 'sell' ? trade.price : '0', // Precio de venta si es sell
      quantity: Number(trade.qty) ?? 0 // Usar qty como quantity
    }));
    
    // Usar las funciones de utilidad existentes
    this.stats = {
      netPnl: calculateNetPnl(normalizedTrades),
      tradeWinPercent: calculateTradeWinPercent(normalizedTrades),
      profitFactor: calculateProfitFactor(normalizedTrades),
      avgWinLossTrades: calculateAvgWinLossTrades(normalizedTrades),
      totalTrades: calculateTotalTrades(normalizedTrades),
      activePositions: groupedTrades.filter(trade => trade.isOpen === true).length
    };
    
    // Actualizar el store con las estadísticas calculadas
    store.dispatch(setNetPnL({ netPnL: this.stats?.netPnl || 0 }));
    store.dispatch(setTradeWin({ tradeWin: this.stats?.tradeWinPercent || 0 }));
    store.dispatch(setProfitFactor({ profitFactor: this.stats?.profitFactor || 0 }));
    store.dispatch(setAvgWnL({ avgWnL: this.stats?.avgWinLossTrades || 0 }));
    store.dispatch(setTotalTrades({ totalTrades: this.stats?.totalTrades || 0 }));
    
    // Guardar stats actualizados en localStorage
    this.saveDataToStorage();
    
    // Marcar que las estadísticas están procesadas
    this.statsProcessed = true;
    this.chartsRendered = true;
    
    // Esperar un poco antes de verificar para evitar recargas múltiples
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

    // Reset account-related loading states
    this.setLoadingState('userKey', false);
    this.setLoadingState('historyData', false);
    this.setLoadingState('balanceData', false);

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

  async getCurrentAccountPlan(): Promise<string> {
    return await this.getAccountPlan(this.currentAccount);
  }

  async getAccountPlan(account: AccountData | null): Promise<string> {
    if (!account || !this.user?.id) return 'Free';
    
    // Use the guard to get the real plan information
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
    // Si es la misma cuenta, no hacer nada
    if (this.currentAccount?.accountID === account.accountID) {
      this.showAccountDropdown = false;
      return;
    }

    // Cambiar cuenta actual
    this.currentAccount = account;
    this.showAccountDropdown = false;
    
    // Activar loading general para mostrar el spinner completo
    this.loading = true;
    
    // Iniciar loading interno
    this.startInternalLoading();
    
    // Reset account-related loading states
    this.setLoadingState('userKey', false);
    this.setLoadingState('historyData', false);
    this.setLoadingState('balanceData', false);
    this.setLoadingState('calendarData', false);
    
    // Limpiar datos anteriores COMPLETAMENTE
    this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
    this.accountHistory = [];
    this.stats = undefined;
    this.balanceData = null;
    this.realTimeBalance = null;
    this.statsProcessed = false;
    this.chartsRendered = false;
    
    // Limpiar datos guardados de la cuenta anterior del contexto
    if (this.currentAccount?.accountID) {
      this.appContext.clearTradingHistoryForAccount(this.currentAccount.accountID);
    }
    
    // Guardar cuenta seleccionada en localStorage
    this.saveDataToStorage();
    
    try {
      // 1. Recargar historial de trades desde el backend para la nueva cuenta
      await this.loadAccountData(account);
      
      // 2. Recargar métricas de la cuenta desde el backend
      await this.loadAccountMetricsFromBackend(account.id);
      
      // 3. Recargar balance desde el backend
      await this.refreshAccountBalance();
      
      // 4. Recargar strategy_followed desde el backend
      await this.loadStrategyFollowedFromBackend();
    } catch (error) {
      console.error('❌ [REPORT LOAD] selectAccount - Error al cargar datos de la nueva cuenta:', error);
    } finally {
      // Finalizar loading interno
      this.stopInternalLoading();
      
      // Desactivar loading general
      this.loading = false;
    }
  }

  goToEditStrategy() {
    this.router.navigate(['/edit-strategy']);
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

  // Navegar a trading accounts
  navigateToTradingAccounts() {
    this.router.navigate(['/trading-accounts']);
  }

  // Método para recargar cuentas
  refreshAccounts() {
    if (this.user) {
      this.fetchUserAccounts();
    }
  }

  // Método para recargar datos manualmente
  reloadData() {
    this.showReloadButton = false;
    this.startLoading();
    
    // Limpiar datos anteriores y localStorage
    this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
    this.accountHistory = [];
    this.stats = undefined;
    this.balanceData = null;
    this.statsProcessed = false;
    this.chartsRendered = false;
    this.clearSavedData();
    
    // Reset all loading states
    this.setLoadingState('userData', false);
    this.setLoadingState('accounts', false);
    this.setLoadingState('strategies', false);
    this.setLoadingState('userKey', false);
    this.setLoadingState('historyData', false);
    this.setLoadingState('balanceData', false);
    this.setLoadingState('config', false);
    
    // Reiniciar el proceso de carga
    if (this.user) {
      this.useAccountsFromContext();
    } else {
      this.getUserData();
    }
  }

  // Check user access and show blocking modal if needed
  async checkUserAccess() {
    if (!this.user?.id) return;

    try {
      const accessCheck = await this.planLimitationsGuard.checkReportAccessWithModal(this.user.id);
      
      // Only show blocking modal if user has trading accounts (not first-time user with plan)
      if (!accessCheck.canAccess && accessCheck.modalData && this.accountsData.length > 0) {
        this.planLimitationModal = accessCheck.modalData;
      }
    } catch (error) {
      console.error('Error checking user access:', error);
    }
  }

  // Plan limitation modal methods
  onClosePlanLimitationModal() {
    this.planLimitationModal.showModal = false;
  }

  // ===== MÉTODOS DE CARGA DE TODAS LAS CUENTAS =====

  /**
   * Cargar datos de todas las cuentas del usuario
   */
  async loadAllAccountsData() {
    if (!this.user?.id || this.accountsData.length === 0) {
      return;
    }

    try {
      // Cargar datos de todas las cuentas en paralelo
      const loadPromises = this.accountsData.map(account => 
        this.loadAccountData(account)
      );
      
      await Promise.all(loadPromises);
      
      // Cargar métricas desde el backend (nuevo sistema)
      await this.loadMetricsFromBackend();
      
    } catch (error) {
      console.error('Error loading all accounts data:', error);
    }
  }

  /**
   * Cargar datos de una cuenta específica
   */
  private async loadAccountData(account: AccountData): Promise<void> {
    try {
      // Resetear calendarData para mostrar loading
      this.setLoadingState('calendarData', false);
      
      // El backend gestiona el accessToken automáticamente, no es necesario obtenerlo
      // Obtener trading history
      const tradingHistory = await this.reportService.getHistoryData(
        account.accountID,
        account.accountNumber
      ).toPromise();

      // COMENTADO: Balance ahora viene de streams API (tiempo real)
      // El balance se actualiza automáticamente desde streams a través de AppContextService
      // const balanceData = await this.reportService.getBalanceData(
      //   account.accountID,
      //   userKey,
      //   account.accountNumber
      // ).toPromise();
      
      const balanceData = null; // Balance viene de streams

      // Guardar en localStorage
      this.saveAccountDataToLocalStorage(account.accountID, {
        accountHistory: tradingHistory || [],
        balanceData: balanceData,
        lastUpdated: Date.now()
      });

      // Si hay trades, actualizar accountHistory directamente y marcar calendarData como listo
      if (tradingHistory && tradingHistory.length > 0) {
        this.accountHistory = tradingHistory;
        
        // Actualizar el store para que otros componentes se enteren
        this.store.dispatch(setGroupedTrades({ groupedTrades: tradingHistory }));
        
        // Marcar calendarData como listo después de un delay para procesamiento
        setTimeout(() => {
          this.setLoadingState('calendarData', true);
        }, 1000);
      } else {
        // Si no hay trades, marcar como listo inmediatamente
        this.setLoadingState('calendarData', true);
      }
    } catch (error: any) {
      console.error('❌ [REPORT LOAD] loadAccountData - ERROR:', error);
      console.error('   Error details:', {
        status: error?.status,
        statusText: error?.statusText,
        message: error?.message,
        stack: error?.stack
      });
      
      // Si es 404, la cuenta puede no tener historial (es normal)
      if (error?.status === 404 || error?.statusText === 'Not Found') {
        console.warn(`   ⚠️ No trading history found for account ${account.accountID}. This may be normal if the account has no trades.`);
        // Continuar con datos vacíos
        this.saveAccountDataToLocalStorage(account.accountID, {
          accountHistory: [],
          balanceData: null,
          lastUpdated: Date.now()
        });
        this.setLoadingState('calendarData', true);
      } else {
        console.error(`   ❌ Error loading data for account ${account.accountID}:`, error);
        this.setLoadingState('calendarData', true);
      }
    }
  }

  /**
   * Calcular y actualizar métricas globales del usuario
   * 
   * @deprecated El backend calcula estas métricas automáticamente. Usar loadMetricsFromBackend() en su lugar.
   * Este método se mantiene comentado por compatibilidad pero ya no se usa.
   */
  /* COMENTADO: Ya no se usa, el backend calcula automáticamente
  private async calculateAndUpdateUserMetrics(): Promise<void> {
    if (!this.user?.id) return;

    try {
      // Recopilar todos los trades de todas las cuentas
      const allTrades: any[] = [];

      for (const account of this.accountsData) {
        const accountData = this.loadAccountDataFromLocalStorage(account.accountID);
        if (accountData && accountData.accountHistory) {
          allTrades.push(...accountData.accountHistory);
        }
      }

      if (allTrades.length > 0) {
        // Calcular profit_factor global (usando la misma lógica que en la ventana)
        const globalProfitFactor = this.calculateProfitFactor(allTrades);

        // Calcular best_trade global (mejor trade de todas las cuentas)
        const bestTrade = this.calculateGlobalBestTrade(allTrades);

        // Usar updateUser en lugar de createUser - solo actualizar campos necesarios
        await this.userService.updateUser(this.user.id, {
          profit: globalProfitFactor, // profit = profit_factor
          best_trade: bestTrade, // best_trade = mejor trade de todas las cuentas
          lastUpdated: new Date().getTime()
        });
      }

    } catch (error) {
      console.error('Error calculating user metrics:', error);
    }
  }
  */

  /**
   * Calcular el mejor trade global de todas las cuentas
   */
  private calculateGlobalBestTrade(allTrades: any[]): number {
    if (!allTrades || allTrades.length === 0) return 0;

    // Normalizar trades
    const normalizedTrades = allTrades.map(trade => ({
      ...trade,
      pnl: trade.pnl ?? 0
    }));

    // Encontrar el trade con mayor ganancia o pérdida absoluta
    const bestTrade = normalizedTrades.reduce((best, trade) => {
      const currentAbs = Math.abs(trade.pnl);
      const bestAbs = Math.abs(best);
      return currentAbs > bestAbs ? trade.pnl : best;
    }, 0);

    return Math.round(bestTrade * 100) / 100;
  }

  /**
   * Calcular porcentaje de ganancia
   */
  private calculateWinPercent(trades: any[]): number {
    if (trades.length === 0) return 0;
    const winningTrades = trades.filter(trade => trade.pnl > 0).length;
    return Math.round((winningTrades / trades.length) * 100 * 100) / 100;
  }

  /**
   * Calcular profit factor
   */
  private calculateProfitFactor(trades: any[]): number {
    const totalGains = trades
      .filter(t => t.pnl > 0)
      .reduce((sum, t) => sum + t.pnl, 0);
    
    const totalLosses = Math.abs(trades
      .filter(t => t.pnl < 0)
      .reduce((sum, t) => sum + t.pnl, 0));

    if (totalLosses === 0) {
      return totalGains > 0 ? 999.99 : 0;
    }

    return Math.round((totalGains / totalLosses) * 100) / 100;
  }

  /**
   * Guardar datos de cuenta en localStorage
   */
  private saveAccountDataToLocalStorage(accountID: string, data: any): void {
    try {
      const key = `tradeSwitch_reportData_${accountID}`;
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving account data to localStorage:', error);
    }
  }


  /**
   * Calcular y actualizar strategy_followed en el usuario
   * 
   * @deprecated El backend calcula strategy_followed automáticamente. Usar loadStrategyFollowedFromBackend() en su lugar.
   * Este método se mantiene comentado por compatibilidad pero ya no se usa.
   */
  /* COMENTADO: Ya no se usa, el backend calcula automáticamente
  private async calculateAndUpdateStrategyFollowed(): Promise<void> {
    if (!this.user?.id) return;

    try {
      // 1. Obtener plugin history del usuario primero
      const pluginHistoryArray = await this.pluginHistoryService.getPluginUsageHistory(this.user.id);
      
      if (pluginHistoryArray.length === 0) {
        // No hay plugin history, asumir 0%
        await this.userService.updateUser(this.user.id, {
          strategy_followed: 0,
          lastUpdated: new Date().getTime()
        });
        return;
      }

      const pluginHistory = pluginHistoryArray[0];

      // 2. Contar trades con plugin activo vs total de trades (validando hora exacta)
      let totalTrades = 0;
      let tradesWithActivePlugin = 0;

      for (const account of this.accountsData) {
        const accountData = this.loadAccountDataFromLocalStorage(account.accountID);
        if (accountData && accountData.accountHistory) {
          for (const trade of accountData.accountHistory) {
            if (trade.createdDate) {
              totalTrades++;
              // Convertir fecha del trade a UTC (con hora completa)
              const tradeDate = this.timezoneService.convertTradeDateToUTC(trade.createdDate);
              
              // Verificar si el plugin estaba activo en el momento exacto de este trade
              if (this.wasPluginActiveAtTime(tradeDate, pluginHistory)) {
                tradesWithActivePlugin++;
              }
            }
          }
        }
      }

      // 3. Calcular porcentaje: (trades con plugin activo / total trades) * 100
      const strategyFollowedPercent = totalTrades > 0 
        ? Math.round((tradesWithActivePlugin / totalTrades) * 100 * 10) / 10
        : 0;

      // 4. Usar updateUser en lugar de createUser - solo actualizar strategy_followed
      await this.userService.updateUser(this.user.id, {
        strategy_followed: strategyFollowedPercent,
        lastUpdated: new Date().getTime()
      });

    } catch (error) {
      console.error('Error calculating strategy_followed:', error);
    }
  }

  /**
   * Verificar si el plugin estaba activo en un momento específico (con hora exacta)
   * @param tradeDate Fecha y hora del trade en UTC
   * @param pluginHistory Plugin history con dateActive y dateInactive
   */
  private wasPluginActiveAtTime(tradeDate: Date, pluginHistory: PluginHistory): boolean {
    if (!pluginHistory.dateActive || !pluginHistory.dateInactive) {
      return false;
    }

    const dateActive = pluginHistory.dateActive;
    const dateInactive = pluginHistory.dateInactive;
    
    // Obtener timestamp del trade en UTC
    const tradeTimestamp = tradeDate.getTime();
    
    // Si dateActive tiene más elementos que dateInactive, está activo desde la última fecha activa hasta ahora
    if (dateActive.length > dateInactive.length) {
      const lastActiveDate = this.timezoneService.convertToUTC(dateActive[dateActive.length - 1]);
      const lastActiveTimestamp = lastActiveDate.getTime();
      
      // El trade debe ser >= a la última fecha/hora activa
      return tradeTimestamp >= lastActiveTimestamp;
    }
    
    // Si tienen la misma cantidad, hay pares de activación/desactivación
    // Verificar si el timestamp del trade está dentro de algún rango activo [dateActive[i], dateInactive[i])
    for (let i = 0; i < dateActive.length; i++) {
      const activeDate = this.timezoneService.convertToUTC(dateActive[i]);
      const inactiveDate = this.timezoneService.convertToUTC(dateInactive[i]);
      
      const activeTimestamp = activeDate.getTime();
      const inactiveTimestamp = inactiveDate.getTime();
      
      // El trade debe estar >= activeTimestamp y < inactiveTimestamp (rango [active, inactive))
      if (tradeTimestamp >= activeTimestamp && tradeTimestamp < inactiveTimestamp) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Cargar datos de cuenta desde localStorage
   */
  private loadAccountDataFromLocalStorage(accountID: string): any {
    try {
      const key = `tradeSwitch_reportData_${accountID}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading account data from localStorage:', error);
      return null;
    }
  }

  // ===== MÉTODOS DE REFRESH =====

  /**
   * Refrescar datos de la cuenta actual desde el backend
   */
  async refreshCurrentAccountData() {
    if (!this.currentAccount) {
      console.warn('⚠️ ReportComponent: No hay cuenta seleccionada para refrescar');
      return;
    }

    console.log('🔄 [REPORT LOAD] refreshCurrentAccountData - INICIO');
    console.log('   📊 [ACCOUNT] Current Account:', {
      id: this.currentAccount.id,
      accountID: this.currentAccount.accountID,
      accountName: this.currentAccount.accountName
    });

    // Activar loading general para mostrar el spinner completo
    this.loading = true;
    console.log('   📊 [LOADING] loading marcado como true');

    // Iniciar loading interno
    this.startInternalLoading();
    console.log('   📊 [LOADING] startInternalLoading ejecutado');
    
    // Reset account-related loading states
    console.log('   📊 [LOADING] Reseteando estados de loading...');
    this.setLoadingState('userKey', false);
    this.setLoadingState('historyData', false);
    this.setLoadingState('balanceData', false);
    this.setLoadingState('metricsData', false);
    this.setLoadingState('calendarData', false);
    console.log('   ✅ [LOADING] Estados de loading reseteados');
    
    // Limpiar datos anteriores COMPLETAMENTE
    console.log('   🧹 [CLEANUP] Limpiando datos anteriores...');
    this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
    this.accountHistory = [];
    this.stats = undefined;
    this.balanceData = null;
    this.statsProcessed = false;
    this.chartsRendered = false;
    console.log('   ✅ [CLEANUP] Datos limpiados');
    
    // Limpiar datos guardados de la cuenta actual del contexto
    this.appContext.clearTradingHistoryForAccount(this.currentAccount.accountID);
    console.log('   ✅ [CLEANUP] Datos del contexto limpiados');
    
    try {
      // 1. Recargar historial de trades desde el backend
      console.log('📊 [REPORT LOAD] Recargando historial de trades...');
      await this.loadAccountData(this.currentAccount);
      
      // 2. Recargar métricas de la cuenta desde el backend
      console.log('📊 [REPORT LOAD] Recargando métricas de la cuenta...');
      await this.loadAccountMetricsFromBackend(this.currentAccount.id);
      
      // 3. Recargar balance desde el backend
      console.log('💰 [REPORT LOAD] Recargando balance...');
      await this.refreshAccountBalance();
      
      // 4. Recargar strategy_followed desde el backend
      console.log('📈 [REPORT LOAD] Recargando strategy_followed...');
      await this.loadStrategyFollowedFromBackend();
      
      console.log('✅ [REPORT LOAD] refreshCurrentAccountData - Datos refrescados exitosamente desde el backend');
    } catch (error) {
      console.error('❌ [REPORT LOAD] refreshCurrentAccountData - Error al refrescar datos desde el backend:', error);
    } finally {
      // Finalizar loading interno
      this.stopInternalLoading();
      console.log('   📊 [LOADING] stopInternalLoading ejecutado');
      
      // Desactivar loading general
      this.loading = false;
      console.log('   📊 [LOADING] loading marcado como false');
      console.log('✅ [REPORT LOAD] refreshCurrentAccountData - FINALIZADO');
    }
  }

  /**
   * Refrescar balance de la cuenta actual desde el backend
   */
  private async refreshAccountBalance(): Promise<void> {
    if (!this.currentAccount) {
      return;
    }

    try {
      this.setLoadingState('balanceData', false);
      
      const balance = await firstValueFrom(
        this.reportService.getBalanceData(
          this.currentAccount.id,
          this.currentAccount.accountNumber
        )
      );
      
      if (balance) {
        this.balanceData = balance;
        // Actualizar balance en tiempo real también (usar balance o equity según esté disponible)
        const balanceValue = balance.equity ?? balance.balance ?? 0;
        this.appContext.updateAccountBalance(this.currentAccount.accountID, balanceValue);
        console.log('✅ ReportComponent: Balance refrescado:', balanceValue);
      }
      
      this.setLoadingState('balanceData', true);
    } catch (error) {
      console.error('❌ ReportComponent: Error al refrescar balance:', error);
      this.setLoadingState('balanceData', true);
    }
  }

  // ===== NUEVOS MÉTODOS: CARGAR MÉTRICAS DESDE EL BACKEND =====

  /**
   * Configurar listeners de Socket.IO para recibir métricas en tiempo real
   */
  // Suscripciones de Socket.IO para limpiar en ngOnDestroy
  private socketSubscriptions: Subscription[] = [];

  private setupSocketListeners(): void {
    if (this.socketListenersSetup) {
      return; // Ya están configurados
    }

    // Suscribirse a eventos de métricas y guardar suscripciones
    const accountMetricsSub = this.accountStatusService.accountMetrics$.subscribe(data => {
      this.handleAccountMetrics(data);
    });
    this.socketSubscriptions.push(accountMetricsSub);

    const positionClosedSub = this.accountStatusService.positionClosed$.subscribe(data => {
      this.handlePositionClosed(data);
    });
    this.socketSubscriptions.push(positionClosedSub);

    const strategyFollowedSub = this.accountStatusService.strategyFollowedUpdate$.subscribe(data => {
      this.handleStrategyFollowedUpdate(data);
    });
    this.socketSubscriptions.push(strategyFollowedSub);

    // NUEVO: Suscribirse a trades del calendario en tiempo real
    const calendarTradeSub = this.accountStatusService.calendarTrade$.subscribe(({ accountId, trade }) => {
      this.handleCalendarTrade(accountId, trade);
    });
    this.socketSubscriptions.push(calendarTradeSub);

    this.socketListenersSetup = true;
    console.log('✅ ReportComponent: Socket.IO listeners configured for metrics');
  }

  /**
   * Cargar métricas de todas las cuentas desde el backend
   */
  private async loadMetricsFromBackend(): Promise<void> {
    if (!this.user?.id || this.accountsData.length === 0) {
      return;
    }

    try {
      // Cargar métricas de todas las cuentas en paralelo
      const metricsPromises = this.accountsData.map(account =>
        this.loadAccountMetricsFromBackend(account.id)
      );

      // Cargar strategy_followed del usuario
      const strategyPromise = this.loadStrategyFollowedFromBackend();

      await Promise.all([...metricsPromises, strategyPromise]);
    } catch (error) {
      console.error('Error loading metrics from backend:', error);
    }
  }

  /**
   * Cargar métricas de una cuenta específica desde el backend
   */
  private async loadAccountMetricsFromBackend(accountId: string): Promise<void> {
    try {
      console.log('🔄 [REPORT LOAD] loadAccountMetricsFromBackend - INICIO');
      console.log('   Account ID:', accountId);
      console.log('   Current Account ID:', this.currentAccount?.id);
      console.log('   Is Current Account:', this.currentAccount?.id === accountId);
      
      // Marcar métricas como cargando
      if (this.currentAccount?.id === accountId) {
        this.setLoadingState('metricsData', false);
        console.log('   📊 [LOADING] metricsData marcado como false (mostrando loading)');
      }

      const auth = await import('firebase/auth');
      const { getAuth } = auth;
      const authInstance = getAuth();
      const user = authInstance.currentUser;
      
      if (!user) {
        console.warn('   ⚠️ [AUTH] No user authenticated');
        // Marcar como cargado incluso si no hay usuario (para evitar loading infinito)
        if (this.currentAccount?.id === accountId) {
          this.setLoadingState('metricsData', true);
          console.log('   ✅ [LOADING] metricsData marcado como TRUE (sin usuario)');
        }
        return;
      }

      console.log('   🔐 [AUTH] Usuario autenticado, obteniendo token...');
      const idToken = await user.getIdToken();
      console.log('   ✅ [AUTH] Token obtenido');
      
      console.log('   📡 [API CALL] Llamando a getAccountMetrics...');
      const response = await this.backendApi.getAccountMetrics(accountId, idToken);
      console.log('   ✅ [API RESPONSE] getAccountMetrics completado');
      console.log('   📊 [DATA] Response completa:', {
        success: response.success,
        hasData: !!response.data,
        data: response.data,
        error: response.error
      });

      if (response.success && response.data) {
        console.log('   📊 [METRICS] Actualizando métricas en contexto...');
        // Actualizar métricas en el contexto
        this.appContext.updateAccountMetrics(accountId, {
          netPnl: response.data.netPnl,
          profit: response.data.profit,
          bestTrade: response.data.bestTrade
        });
        console.log('   ✅ [METRICS] Métricas actualizadas en contexto:', {
          netPnl: response.data.netPnl,
          profit: response.data.profit,
          bestTrade: response.data.bestTrade
        });

        // Si es la cuenta actual y hay stats, actualizar también
        if (this.currentAccount?.id === accountId && response.data.stats) {
          console.log('   📊 [STATS] Actualizando stats desde métricas...');
          console.log('   📊 [STATS] Stats recibidos:', response.data.stats);
          this.updateStatsFromMetrics(response.data.stats);
          console.log('   ✅ [STATS] Stats actualizados:', this.stats);
          
          // Marcar métricas como cargadas solo cuando stats estén actualizados
          this.setLoadingState('metricsData', true);
          console.log('   ✅ [LOADING] metricsData marcado como TRUE (stats actualizados)');
        } else if (this.currentAccount?.id === accountId) {
          // Si no hay stats pero es la cuenta actual, marcar como cargado de todas formas
          console.log('   ⚠️ [STATS] No hay stats en la respuesta, marcando como cargado');
          this.setLoadingState('metricsData', true);
          console.log('   ✅ [LOADING] metricsData marcado como TRUE (sin stats)');
        }

        console.log(`✅ [REPORT LOAD] loadAccountMetricsFromBackend - FINALIZADO para account ${accountId}`);
      } else {
        console.warn('   ⚠️ [API] Respuesta no exitosa:', response);
        // Si la respuesta no es exitosa, marcar como cargado para evitar loading infinito
        if (this.currentAccount?.id === accountId) {
          this.setLoadingState('metricsData', true);
          console.log('   ✅ [LOADING] metricsData marcado como TRUE (respuesta no exitosa)');
        }
      }
    } catch (error) {
      console.error(`❌ [REPORT LOAD] loadAccountMetricsFromBackend - ERROR para account ${accountId}:`, error);
      console.error('   Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      // En caso de error, marcar como cargado para evitar loading infinito
      if (this.currentAccount?.id === accountId) {
        this.setLoadingState('metricsData', true);
        console.log('   ✅ [LOADING] metricsData marcado como TRUE (error)');
      }
    }
  }

  /**
   * Cargar strategy_followed del usuario desde el backend
   */
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
        // Actualizar en el contexto
        this.appContext.updateUserData({
          strategy_followed: response.data.strategy_followed
        });

        console.log(`✅ Loaded strategy_followed for user ${this.user.id}:`, response.data.strategy_followed);
      }
    } catch (error) {
      console.error('Error loading strategy_followed:', error);
    }
  }

  /**
   * Manejar evento de métricas de cuenta desde Socket.IO
   */
  private handleAccountMetrics(data: AccountMetricsEvent): void {
    try {
      console.log('📊 ReportComponent: Received accountMetrics event:', data);

      // Actualizar métricas básicas en el contexto
      this.appContext.updateAccountMetrics(data.accountId, {
        netPnl: data.metrics.netPnl,
        profit: data.metrics.profit,
        bestTrade: data.metrics.bestTrade
      });

      // NUEVO: Si vienen stats completos, actualizar también
      // NOTA: No marcar loading cuando viene del socket, solo actualizar datos
      if (data.metrics.stats && this.currentAccount?.id === data.accountId) {
        console.log('📊 ReportComponent: Updating stats from accountMetrics (socket):', data.metrics.stats);
        this.stats = {
          netPnl: data.metrics.stats.netPnl,
          tradeWinPercent: data.metrics.stats.tradeWinPercent,
          profitFactor: data.metrics.stats.profitFactor,
          totalTrades: data.metrics.stats.totalTrades,
          avgWinLossTrades: data.metrics.stats.avgWinLossTrades,
          activePositions: data.metrics.stats.activePositions
        };
        // Actualizar store
        this.store.dispatch(setNetPnL({ netPnL: this.stats.netPnl }));
        this.store.dispatch(setTradeWin({ tradeWin: this.stats.tradeWinPercent }));
        this.store.dispatch(setProfitFactor({ profitFactor: this.stats.profitFactor }));
        this.store.dispatch(setAvgWnL({ avgWnL: this.stats.avgWinLossTrades }));
        this.store.dispatch(setTotalTrades({ totalTrades: this.stats.totalTrades }));
        
        // Marcar métricas como procesadas (pero NO cambiar loading state - viene del socket)
        this.statsProcessed = true;
        // NO llamar setLoadingState aquí - los datos vienen del socket, no de un endpoint
      } else if (this.currentAccount?.id === data.accountId) {
        // Si no vienen stats, recargar desde el backend (esto SÍ mostrará loading)
        this.loadAccountMetricsFromBackend(data.accountId);
      }
    } catch (error) {
      console.error('Error handling accountMetrics:', error);
    }
  }

  /**
   * Manejar evento de posición cerrada desde Socket.IO
   */
  private handlePositionClosed(data: PositionClosedEvent): void {
    try {
      console.log('🔒 ReportComponent: Received positionClosed event:', data);

      // 1. Agregar trade al calendario si viene formateado
      if (data.trade && !data.trade.isOpen) {
        this.addTradeToCalendar(data.accountId, data.trade);
      }

      // 2. Actualizar métricas de la cuenta (incluye stats si vienen)
      this.handleAccountMetrics({
        accountId: data.accountId,
        metrics: {
          netPnl: data.updatedMetrics.netPnl,
          profit: data.updatedMetrics.profit,
          bestTrade: data.updatedMetrics.bestTrade,
          stats: data.updatedMetrics.stats // Stats completos
        },
        timestamp: data.timestamp || Date.now()
      });

      // 3. Mantener compatibilidad: si no viene trade, usar position (formato antiguo)
      if (!data.trade && data.position) {
        console.log('⚠️ ReportComponent: Received position (old format), converting to calendar trade');
        // Convertir position a formato calendario si es necesario
        const calendarTrade = this.convertPositionToCalendarTrade(data.position);
        if (calendarTrade) {
          this.addTradeToCalendar(data.accountId, calendarTrade);
        } else {
          // Si no se puede convertir, recargar datos
          if (this.currentAccount?.id === data.accountId) {
            this.loadAccountData(this.currentAccount);
          }
        }
      }
    } catch (error) {
      console.error('Error handling positionClosed:', error);
    }
  }

  /**
   * NUEVO: Agregar trade al calendario (helper function)
   * Agrupa por fecha usando lastModified (timestamp) pero muestra en el día de createdDate
   */
  private addTradeToCalendar(accountId: string, trade: any): void {
    try {
      console.log('📅 ReportComponent: Adding trade to calendar:', trade);

      // Validar que el trade tenga los campos necesarios
      if (!trade || !trade.positionId || !trade.createdDate || !trade.lastModified) {
        console.warn('⚠️ ReportComponent: Invalid trade for calendar:', trade);
        return;
      }

      // Solo procesar si es la cuenta actual
      if (this.currentAccount?.id !== accountId) {
        console.log(`📅 ReportComponent: Trade for different account (${accountId}), skipping`);
        return;
      }

      // Convertir trade a formato GroupedTradeFinal
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
        isOpen: false, // Siempre false para trades cerrados
        stopLoss: trade.stopLoss || '',
        stopLossType: trade.stopLossType || '',
        takeProfit: trade.takeProfit || '',
        takeProfitType: trade.takeProfitType || '',
        strategyId: trade.strategyId || '',
        instrument: trade.instrument || trade.tradableInstrumentId || '',
        pnl: trade.pnl || 0,
        isWon: trade.isWon ?? (trade.pnl > 0)
      };

      // Verificar si el trade ya existe (por positionId)
      const existingIndex = this.accountHistory.findIndex(t => t.positionId === groupedTrade.positionId);
      
      if (existingIndex >= 0) {
        // Actualizar trade existente
        console.log('📅 ReportComponent: Updating existing trade:', groupedTrade.positionId);
        this.accountHistory[existingIndex] = groupedTrade;
      } else {
        // Agregar nuevo trade
        console.log('📅 ReportComponent: Adding new trade to calendar:', groupedTrade.positionId);
        this.accountHistory.push(groupedTrade);
      }

      // Actualizar el store
      this.store.dispatch(setGroupedTrades({ groupedTrades: [...this.accountHistory] }));

      // Recalcular estadísticas
      this.updateReportStats(this.store, this.accountHistory);

      // Recalcular totales del día (el calendario se actualizará automáticamente vía ngOnChanges)
      // El calendario usa createdDate para mostrar el día, así que está correcto

      // NO marcar calendarData como listo aquí - este método solo se llama desde el socket
      // El loading solo se muestra para endpoints REST, no para actualizaciones en tiempo real

      console.log('✅ ReportComponent: Trade added to calendar successfully (from socket)');
    } catch (error) {
      console.error('❌ ReportComponent: Error adding trade to calendar:', error, trade);
    }
  }

  /**
   * NUEVO: Manejar trade del calendario en tiempo real (desde calendarTrade$)
   */
  private handleCalendarTrade(accountId: string, trade: any): void {
    // Delegar a addTradeToCalendar
    this.addTradeToCalendar(accountId, trade);
  }

  /**
   * NUEVO: Convertir position (formato antiguo) a formato calendario
   */
  private convertPositionToCalendarTrade(position: PositionData): GroupedTradeFinal | null {
    try {
      if (!position || !position.positionId) {
        return null;
      }

      // Convertir PositionData a GroupedTradeFinal usando los campos correctos
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

  /**
   * Helper: Obtener clave de fecha desde timestamp
   */
  private getDateKey(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0]; // Formato: "2025-01-27"
  }

  /**
   * Manejar evento de strategy_followed actualizado desde Socket.IO
   */
  private handleStrategyFollowedUpdate(data: StrategyFollowedUpdateEvent): void {
    try {
      console.log('📈 ReportComponent: Received strategyFollowedUpdate event:', data);

      // Actualizar en el contexto (ya se hace en AccountStatusService, pero por si acaso)
      this.appContext.updateUserData({
        strategy_followed: data.strategy_followed
      });

      // Actualizar en el componente si es necesario
      if (this.user?.id === data.userId) {
        // El user se actualiza automáticamente desde el contexto
      }
    } catch (error) {
      console.error('Error handling strategyFollowedUpdate:', error);
    }
  }

  /**
   * Actualizar stats del reporte desde métricas del backend
   */
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
    // activePositions se puede usar si es necesario
    
    // Actualizar store
    this.store.dispatch(setNetPnL({ netPnL: this.stats.netPnl }));
    this.store.dispatch(setTradeWin({ tradeWin: this.stats.tradeWinPercent }));
    this.store.dispatch(setProfitFactor({ profitFactor: this.stats.profitFactor }));
    this.store.dispatch(setAvgWnL({ avgWnL: this.stats.avgWinLossTrades }));
    this.store.dispatch(setTotalTrades({ totalTrades: this.stats.totalTrades }));
    
    // Marcar que las estadísticas están procesadas
    this.statsProcessed = true;
  }

  // ===== MÉTODOS DE CÁLCULO (DEPRECADOS - MANTENER SOLO PARA REFERENCIA) =====
  // Estos métodos ya no se usan. El backend calcula las métricas automáticamente.
  // Se mantienen comentados por si se necesitan para debugging o migración.

  /**
   * Calcular y actualizar métricas por cuenta (AccountData)
   * - netPnl: suma de pnl
   * - profit: profit factor de la cuenta
   * - bestTrade: mayor |pnl|
   * Si no hay users/cuentas cargadas, no hace nada
   * 
   * @deprecated El backend calcula estas métricas automáticamente. Usar loadAccountMetricsFromBackend() en su lugar.
   */
  /* COMENTADO: Ya no se usa, el backend calcula automáticamente
  private async calculateAndUpdateAccountsMetrics(targetAccounts?: AccountData[]): Promise<void> {
    const accounts = targetAccounts || this.accountsData;
    if (!accounts || accounts.length === 0) return;

    try {
      for (const account of accounts) {
        const local = this.loadAccountDataFromLocalStorage(account.accountID);
        const trades = Array.isArray(local?.accountHistory) ? local.accountHistory : [];

        if (trades.length === 0) {
          await this.userService.updateAccount(account.id, {
            ...account,
            netPnl: 0,
            profit: 0,
            bestTrade: 0,
          } as AccountData);
          continue;
        }

        // Normalizar PnL
        const normalized = trades.map((t: any) => ({ ...t, pnl: t.pnl ?? 0 }));
        const netPnl = calculateNetPnl(normalized);
        const profitFactor = this.calculateProfitFactor(normalized);
        const bestTrade = this.calculateGlobalBestTrade(normalized); // reutilizamos el cálculo de mejor trade

        await this.userService.updateAccount(account.id, {
          ...account,
          netPnl: Math.round(netPnl * 100) / 100,
          profit: Math.round(profitFactor * 100) / 100,
          bestTrade: Math.round(bestTrade * 100) / 100,
        } as AccountData);
      }
    } catch (error) {
      console.error('Error updating account metrics:', error);
    }
  }
  */
}