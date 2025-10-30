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
import { interval, last, map, Subscription } from 'rxjs';
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
import { PlanLimitationsGuard } from '../../guards/plan-limitations.guard';
import { PlanLimitationModalData } from '../../shared/interfaces/plan-limitation-modal.interface';
import { PlanLimitationModalComponent } from '../../shared/components/plan-limitation-modal/plan-limitation-modal.component';
import { StrategyCardData } from '../../shared/components/strategy-card/strategy-card.interface';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { PluginHistoryService, PluginHistory } from '../../shared/services/plugin-history.service';
import { TimezoneService } from '../../shared/services/timezone.service';

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
  
  // Balance data from API
  balanceData: any = null;
  
  // Loading state tracking for complete data loading
  private loadingStates = {
    userData: false,
    accounts: false,
    strategies: false,
    userKey: false,
    historyData: false,
    balanceData: false,
    config: false
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
    private timezoneService: TimezoneService
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
      config: this.loadingStates.config
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
    if (this.user) {
      const updatedUser = {
        ...this.user,
        // TODO: revisar uso anterior de best_trade, ahora pertenece a AccountData
        // TODO: revisar uso anterior de netPnl, ahora pertenece a AccountData
        lastUpdated: new Date().getTime() as unknown as Timestamp,
        // TODO: revisar uso anterior de number_trades, ahora pertenece a AccountData
        strategy_followed: percentage,
        // TODO: revisar uso anterior de profit, ahora pertenece a AccountData
        // TODO: revisar uso anterior de total_spend, ahora pertenece a AccountData
      };

      const actualYear = new Date().getFullYear();

      const requestYear = this.requestYear;
      if (actualYear === requestYear) {
        this.userService.createUser(updatedUser as unknown as User);
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

          this.fetchHistoryData(
            key,
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

  fetchHistoryData(
    key: string,
    accountId: string,
    accNum: number
  ) {
    // Solo consultar balance si no existe ya
    if (this.balanceData === null || this.balanceData === undefined) {
      this.reportService.getBalanceData(accountId, key, accNum).subscribe({
        next: (balanceData) => {
          this.balanceData = balanceData;
          this.setLoadingState('balanceData', true);
          // Verificar si todos los datos están listos después de cargar el balance
          this.checkIfAllDataLoaded();
        },
        error: (err) => {
          console.error('Error fetching balance data:', err);
          this.setLoadingState('balanceData', true);
          // Verificar si todos los datos están listos incluso en caso de error
          this.checkIfAllDataLoaded();
        },
      });
    } else {
      // Si ya existe balanceData, marcar como cargado
      this.setLoadingState('balanceData', true);
      this.checkIfAllDataLoaded();
    }

    // Solo hacer petición al trading history (la principal)
    this.reportService
      .getHistoryData(accountId, key, accNum)
      .subscribe({
        next: (groupedTrades: GroupedTradeFinal[]) => {
          // Reemplazar en lugar de acumular para evitar duplicados
          this.store.dispatch(
            setGroupedTrades({
              groupedTrades: groupedTrades,
            })
          );

          // Calcular estadísticas inmediatamente después de recibir los datos
          this.updateReportStats(this.store, groupedTrades);

          // Guardar datos en el contexto y localStorage por cuenta DESPUÉS de calcular stats
          if (this.currentAccount) {
            // Esperar a que las estadísticas estén calculadas
            // Guardar en el contexto
            const contextData = {
              accountHistory: groupedTrades,
              stats: this.stats,
              balanceData: this.balanceData,
              lastUpdated: Date.now()
            };
            this.appContext.setTradingHistoryForAccount(this.currentAccount!.id, contextData);
            
            // Guardar datos en localStorage después de recibir respuesta exitosa
            this.saveDataToStorage();
            
            // Marcar history data como cargado DESPUÉS de guardar todo
            this.setLoadingState('historyData', true);
            // Marcar que no hay peticiones pendientes
            this.hasPendingRequests = false;
          } else {
            // Si no hay cuenta actual, marcar como cargado inmediatamente
            this.setLoadingState('historyData', true);
            this.hasPendingRequests = false;
          }
        },
        error: (err) => {
          console.error('Error fetching history data:', err);
          this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
          // Marcar history data como cargado incluso en error
          this.setLoadingState('historyData', true);
          // Marcar que no hay peticiones pendientes
          this.hasPendingRequests = false;
        },
      });
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

  selectAccount(account: AccountData) {
    this.currentAccount = account;
    this.showAccountDropdown = false;
    
    // Guardar cuenta seleccionada en localStorage
    this.saveDataToStorage();
    
    // SIEMPRE iniciar loading interno para mostrar loading
    this.startInternalLoading();
    
    // Reset account-related loading states
    this.setLoadingState('userKey', false);
    this.setLoadingState('historyData', false);
    this.setLoadingState('balanceData', false);
    
    // Limpiar datos anteriores
    this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
    
    // Verificar si existe localStorage para esta cuenta
    const savedData = this.appContext.loadReportDataFromLocalStorage(account.accountID);
    
    if (savedData && savedData.accountHistory && savedData.stats) {
      // Si existe en localStorage, cargar directamente con loading
      this.loadSavedReportData(account.accountID);
    } else {
      // Si no existe, hacer peticiones a la API
      this.fetchUserKey(account);
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
      
      // Calcular métricas globales del usuario
      await this.calculateAndUpdateUserMetrics();
      
      // Calcular strategy_followed basado en todas las cuentas
      await this.calculateAndUpdateStrategyFollowed();
      
    } catch (error) {
      console.error('Error loading all accounts data:', error);
    }
  }

  /**
   * Cargar datos de una cuenta específica
   */
  private async loadAccountData(account: AccountData): Promise<void> {
    try {
      // Obtener userKey
      const userKey = await this.reportService.getUserKey(
        account.emailTradingAccount,
        account.brokerPassword,
        account.server
      ).toPromise();

      if (!userKey) {
        console.warn(`No se pudo obtener userKey para cuenta ${account.accountID}`);
        return;
      }

      // Obtener trading history
      const tradingHistory = await this.reportService.getHistoryData(
        account.accountID,
        userKey,
        account.accountNumber
      ).toPromise();

      // Obtener balance data
      const balanceData = await this.reportService.getBalanceData(
        account.accountID,
        userKey,
        account.accountNumber
      ).toPromise();

      // Guardar en localStorage
      this.saveAccountDataToLocalStorage(account.accountID, {
        accountHistory: tradingHistory || [],
        balanceData: balanceData,
        lastUpdated: Date.now()
      });

    } catch (error) {
      console.error(`Error loading data for account ${account.accountID}:`, error);
    }
  }

  /**
   * Calcular y actualizar métricas globales del usuario
   */
  private async calculateAndUpdateUserMetrics(): Promise<void> {
    if (!this.user?.id) return;

    try {
      // Recopilar todos los trades de todas las cuentas
      const allTrades: any[] = [];
      let globalProfitFactor = 0;

      for (const account of this.accountsData) {
        const accountData = this.loadAccountDataFromLocalStorage(account.accountID);
        if (accountData && accountData.accountHistory) {
          allTrades.push(...accountData.accountHistory);
        }
      }

      if (allTrades.length > 0) {
        // Calcular profit_factor global (usando la misma lógica que en la ventana)
        globalProfitFactor = this.calculateProfitFactor(allTrades);

        // Calcular best_trade global (mejor trade de todas las cuentas)
        const bestTrade = this.calculateGlobalBestTrade(allTrades);

        // Actualizar usuario en Firebase con las métricas globales
        const updatedUser = {
          ...this.user,
          profit: globalProfitFactor, // profit = profit_factor
          best_trade: bestTrade, // best_trade = mejor trade de todas las cuentas
          lastUpdated: new Date().getTime() as unknown as Timestamp
        };

        await this.userService.createUser(updatedUser as unknown as User);
      }

    } catch (error) {
      console.error('Error calculating user metrics:', error);
    }
  }

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
   * NUEVA LÓGICA: Verifica cada trade individual y si el plugin estuvo activo en el momento exacto del trade (con hora)
   */
  private async calculateAndUpdateStrategyFollowed(): Promise<void> {
    if (!this.user?.id) return;

    try {
      // 1. Obtener plugin history del usuario primero
      const pluginHistoryArray = await this.pluginHistoryService.getPluginUsageHistory(this.user.id);
      
      if (pluginHistoryArray.length === 0) {
        // No hay plugin history, asumir 0%
        const updatedUser = {
          ...this.user,
          strategy_followed: 0,
          lastUpdated: new Date().getTime() as unknown as Timestamp
        };
        await this.userService.createUser(updatedUser as unknown as User);
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

      if (totalTrades === 0) {
        // No hay trades, porcentaje es 0
        const updatedUser = {
          ...this.user,
          strategy_followed: 0,
          lastUpdated: new Date().getTime() as unknown as Timestamp
        };
        await this.userService.createUser(updatedUser as unknown as User);
        return;
      }

      // 3. Calcular porcentaje: (trades con plugin activo / total trades) * 100
      const strategyFollowedPercent = totalTrades > 0 
        ? Math.round((tradesWithActivePlugin / totalTrades) * 100 * 10) / 10
        : 0;

      // 4. Actualizar usuario en Firebase
      const updatedUser = {
        ...this.user,
        strategy_followed: strategyFollowedPercent,
        lastUpdated: new Date().getTime() as unknown as Timestamp
      };

      await this.userService.createUser(updatedUser as unknown as User);

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
   * Refrescar datos de la cuenta actual
   */
  refreshCurrentAccountData() {
    if (!this.currentAccount) {
      console.warn('No hay cuenta seleccionada para refrescar');
      return;
    }

    // Iniciar loading interno
    this.startInternalLoading();
    
    // Reset account-related loading states
    this.setLoadingState('userKey', false);
    this.setLoadingState('historyData', false);
    this.setLoadingState('balanceData', false);
    
    // Limpiar datos anteriores COMPLETAMENTE
    this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
    this.accountHistory = [];
    this.stats = undefined;
    this.balanceData = null;
    this.statsProcessed = false;
    this.chartsRendered = false;
    
    // Limpiar datos guardados de la cuenta actual del contexto
    this.appContext.clearTradingHistoryForAccount(this.currentAccount.accountID);
    
    // Cargar datos frescos de la cuenta actual
    this.loadAccountData(this.currentAccount).then(() => {
      // Después de cargar, recalcular métricas globales del usuario
      this.calculateAndUpdateUserMetrics();
      // Recalcular strategy_followed
      this.calculateAndUpdateStrategyFollowed();
    });
  }
}