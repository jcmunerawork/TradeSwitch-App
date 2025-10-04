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
    private appContext: AppContextService
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
    
    // Suscribirse a los datos del contexto
    this.subscribeToContextData();
    
    // Luego obtener datos frescos en background
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

    // Suscribirse a las cuentas del usuario
    this.appContext.userAccounts$.subscribe(accounts => {
      this.accountsData = accounts;
      if (accounts.length > 0 && !this.currentAccount) {
        this.currentAccount = accounts[0];
      }
    });

    // Suscribirse a las estrategias del usuario
    this.appContext.userStrategies$.subscribe(strategies => {
      this.strategies = strategies;
    });

    // Suscribirse a los estados de carga
    this.appContext.isLoading$.subscribe(loading => {
      if (loading.accounts) {
        this.startLoading();
      } else {
        this.stopLoading();
      }
    });

    // Suscribirse a los errores
    this.appContext.errors$.subscribe(errors => {
      if (errors.accounts) {
        this.errorMessage = errors.accounts;
      }
    });
  }

  private startLoading() {
    this.loading = true;
    
    // Timeout de seguridad más agresivo para evitar loading infinito
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    
    this.loadingTimeout = setTimeout(() => {
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
          // Convertir a GroupedTradeFinal si es necesario
          const groupedTrades = Array.isArray(reportData.accountHistory) ? 
            reportData.accountHistory.map((trade: any) => ({
              ...trade,
              pnl: trade.pnl ?? 0,
              isWon: trade.isWon ?? false,
              isOpen: trade.isOpen ?? false
            })) : [];
          this.store.dispatch(setGroupedTrades({ groupedTrades }));
        }
      }

      // Cargar cuentas guardadas
      const savedAccountsData = localStorage.getItem(this.STORAGE_KEYS.ACCOUNTS_DATA);
      if (savedAccountsData) {
        this.accountsData = JSON.parse(savedAccountsData);
      }

      // Cargar cuenta actual
      const savedCurrentAccount = localStorage.getItem(this.STORAGE_KEYS.CURRENT_ACCOUNT);
      if (savedCurrentAccount) {
        this.currentAccount = JSON.parse(savedCurrentAccount);
      }

      // Cargar datos de usuario
      const savedUserData = localStorage.getItem(this.STORAGE_KEYS.USER_DATA);
      if (savedUserData) {
        this.user = JSON.parse(savedUserData);
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
    } catch (error) {
      console.error('Error limpiando datos guardados:', error);
    }
  }

  private async initializeStrategies(): Promise<void> {
    if (this.user?.id) {
      try {
        this.strategies = await this.strategySvc.getUserStrategyViews(this.user.id);
      } catch (error) {
        console.error('Error loading strategies:', error);
      }
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
      activePositions: 0, // Se calculará desde los trades originales
    };
    
    return stats;
  }

  computeStatsFromBalance(balanceData: any, trades: { pnl?: number }[]) {
    // Filtrar trades terminados (cerrados con PnL calculado)
    const completedTrades = this.getCompletedTrades(trades);
    const activePositions = this.getActivePositions(trades);
    
    const stats = {
      netPnl: this.calculateNetPnlFromTrades(completedTrades),
      tradeWinPercent: this.calculateTradeWinPercentFromTrades(completedTrades),
      profitFactor: this.calculateProfitFactorFromTrades(completedTrades),
      avgWinLossTrades: this.calculateAvgWinLossFromTrades(completedTrades),
      totalTrades: completedTrades.length, // Solo trades cerrados
      activePositions: activePositions.length, // Solo posiciones abiertas
    };
    
    return stats;
  }

  private getCompletedTrades(trades: any[]): any[] {
    // Trades terminados: están cerrados (isOpen = false) y tienen PnL calculado
    return trades.filter(trade => 
      trade.isOpen === false && trade.pnl !== undefined && trade.pnl !== null
    );
  }

  private getActivePositions(trades: any[]): any[] {
    // Posiciones activas: están abiertas (isOpen = true)
    return trades.filter(trade => trade.isOpen === true);
  }

  private calculateNetPnlFromTrades(trades: { pnl?: number }[]): number {
    // Pérdida Neta = (Suma de todas las ganancias) - (Suma de todas las pérdidas)
    // Usar todos los trades, ya que están normalizados con valores por defecto
    if (trades.length === 0) return 0;
    
    const totalGains = trades
      .filter(t => t.pnl! > 0)
      .reduce((sum, t) => sum + t.pnl!, 0);
    
    const totalLosses = Math.abs(trades
      .filter(t => t.pnl! < 0)
      .reduce((sum, t) => sum + t.pnl!, 0));
    
    // Net P&L puede ser negativo: ganancias - pérdidas
    const netPnl = totalGains - totalLosses;
    return Math.round(netPnl * 100) / 100; // Round to 2 decimal places
  }

  private calculateTradeWinPercentFromTrades(trades: { pnl?: number }[]): number {
    // % de Operaciones Ganadoras = (Número de Operaciones Ganadoras / Número Total de Operaciones) * 100
    if (trades.length === 0) return 0;
    
    const winningTrades = trades.filter(t => t.pnl! > 0).length;
    const winPercent = (winningTrades / trades.length) * 100;
    return Math.round(winPercent * 100) / 100; // Round to 2 decimal places
  }

  private calculateProfitFactorFromTrades(trades: { pnl?: number }[]): number {
    // Factor de Beneficio = (Suma Total de Ganancias de Todas las Operaciones Ganadoras) / (Suma Total de Pérdidas de Todas las Operaciones Perdedoras)
    if (trades.length === 0) return 0;
    
    const totalProfits = trades
      .filter(t => t.pnl! > 0)
      .reduce((sum, t) => sum + t.pnl!, 0);
    
    const totalLosses = Math.abs(trades
      .filter(t => t.pnl! < 0)
      .reduce((sum, t) => sum + t.pnl!, 0));
    
    // Si no hay pérdidas, el factor es infinito (pero lo limitamos a 999.99)
    if (totalLosses === 0) {
      return totalProfits > 0 ? 999.99 : 0;
    }
    
    // Si no hay ganancias, el factor es 0
    if (totalProfits === 0) {
      return 0;
    }
    
    // Factor de beneficio: ganancias / pérdidas
    const profitFactor = totalProfits / totalLosses;
    return Math.round(profitFactor * 100) / 100; // Round to 2 decimal places
  }

  private calculateAvgWinLossFromTrades(trades: { pnl?: number }[]): number {
    // Ganancia Promedio (Avg Win) = Suma Total de Ganancias / Número de Operaciones Ganadoras
    // Pérdida Promedio (Avg Loss) = Suma Total de Pérdidas / Número de Operaciones Perdedoras
    if (trades.length === 0) return 0;
    
    const winningTrades = trades.filter(t => t.pnl! > 0);
    const losingTrades = trades.filter(t => t.pnl! < 0);
    
    // Calcular ganancia promedio
    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + t.pnl!, 0) / winningTrades.length 
      : 0;
    
    // Calcular pérdida promedio
    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl!, 0) / losingTrades.length)
      : 0;
    
    // Si no hay pérdidas, el ratio es infinito
    if (avgLoss === 0) {
      return avgWin > 0 ? 999.99 : 0;
    }
    
    // Si no hay ganancias, el ratio es 0
    if (avgWin === 0) {
      return 0;
    }
    
    // Ratio: ganancia promedio / pérdida promedio
    const ratio = avgWin / avgLoss;
    return Math.round(ratio * 100) / 100; // Round to 2 decimal places
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
            1
          );

          this.store.dispatch(setUserKey({ userKey: key }));
        },
        error: (err) => {
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
    // Los servicios ya actualizan el contexto automáticamente
    this.reportService.getBalanceData(accountId, key, accNum).subscribe({
      next: (balanceData) => {
        // Store balance data for calculations
        this.balanceData = balanceData;
      },
      error: (err) => {
        console.error('Error fetching balance data:', err);
      },
    });

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

          // Guardar datos en localStorage después de recibir respuesta exitosa
          this.saveDataToStorage();

          // Siempre ocultar loading después de recibir respuesta
          this.stopLoading();
        },
        error: (err) => {
          console.error('Error fetching history data:', err);
          this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
          this.stopLoading();
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
    
    // Usar todos los trades normalizados para estadísticas
    this.stats = {
      netPnl: this.calculateNetPnlFromTrades(normalizedTrades),
      tradeWinPercent: this.calculateTradeWinPercentFromTrades(normalizedTrades),
      profitFactor: this.calculateProfitFactorFromTrades(normalizedTrades),
      avgWinLossTrades: this.calculateAvgWinLossFromTrades(normalizedTrades),
      totalTrades: normalizedTrades.length, // Usar todos los trades
      activePositions: groupedTrades.filter(trade => trade.isOpen === true).length
    };
    
    store.dispatch(setNetPnL({ netPnL: this.stats?.netPnl || 0 }));
    store.dispatch(setTradeWin({ tradeWin: this.stats?.tradeWinPercent || 0 }));
    store.dispatch(setProfitFactor({ profitFactor: this.stats?.profitFactor || 0 }));
    store.dispatch(setAvgWnL({ avgWnL: this.stats?.avgWinLossTrades || 0 }));
    store.dispatch(setTotalTrades({ totalTrades: this.stats?.totalTrades || 0 }));
    
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
    
    this.startLoading();
    
    // Limpiar datos anteriores
    this.store.dispatch(setGroupedTrades({ groupedTrades: [] }));
    
    // Fetch data for the selected account
    this.fetchUserKey(account);
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

  // Método para recargar datos manualmente
  reloadData() {
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
    if (this.user) {
      this.fetchUserAccounts();
    }
  }

  // Check user access and show blocking modal if needed
  async checkUserAccess() {
    if (!this.user?.id) return;

    try {
      const accessCheck = await this.planLimitationsGuard.checkReportAccessWithModal(this.user.id);
      
      if (!accessCheck.canAccess && accessCheck.modalData) {
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
}
