import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { User } from '../overview/models/overview';
import { selectUser } from '../auth/store/user.selectios';
import { SettingsService } from './service/strategy.service';
import { ConfigurationOverview } from './models/strategy.model';
import { TextInputComponent, StrategyCardComponent, StrategyCardData } from '../../shared/components';
import { Store } from '@ngrx/store';
import { ReportService } from '../report/service/report.service';
import { AuthService } from '../auth/service/authService';
import { initialStrategyState } from '../strategy/store/strategy.reducer';
import { selectTradeWin } from '../report/store/report.selectors';
import { selectTotalTrades } from '../report/store/report.selectors';
import { resetConfig } from '../strategy/store/strategy.actions';
import { StrategyState } from '../strategy/models/strategy.model';
import { AccountData } from '../auth/models/userModel';
import { setUserKey } from '../report/store/report.actions';
import { selectUserKey } from '../report/store/report.selectors';
import { GlobalStrategyUpdaterService } from '../../shared/services/global-strategy-updater.service';
import { allRules } from '../strategy/store/strategy.selectors';
import { selectNetPnL } from '../report/store/report.selectors';
import { PlanLimitationsGuard } from '../../guards/plan-limitations.guard';
import { AppContextService } from '../../shared/context';


@Component({
  selector: 'app-strategy',
  imports: [
    CommonModule,
    FormsModule,
    TextInputComponent,
    StrategyCardComponent,
  ],
  templateUrl: './strategy.component.html',
  styleUrl: './strategy.component.scss',
  standalone: true,
})
export class Strategy implements OnInit, OnDestroy {
  config: any = {};
  user: User | null = null;
  loading = false;
  initialLoading = true;
  
  // Plan detection and banner
  accountsData: AccountData[] = [];
  showPlanBanner = false;
  planBannerMessage = '';
  planBannerType = 'info'; // 'info', 'warning', 'success'
  

  // Button state
  isAddStrategyDisabled = false;
  
  // Report data for strategy card
  tradeWin: number = 0;
  totalTrades: number = 0;
  netPnL: number = 0;
  
  // Nuevas propiedades para múltiples estrategias
  userStrategies: ConfigurationOverview[] = [];
  activeStrategy: ConfigurationOverview | null = null;
  filteredStrategies: ConfigurationOverview[] = [];
  strategyCardsData: StrategyCardData[] = [];
  showStrategySelector = false;
  newStrategyName = '';
  searchTerm = '';
  
  // Strategy Card Data - Dynamic
  strategyCard: StrategyCardData = {
    id: '1',
    name: 'My Trading Strategy',
    status: true,
    lastModified: 'Never',
    rules: 0,
    days_active: 0,
    winRate: 0,
    isFavorite: false,
    created_at: null,
    updated_at: null,
    userId: '',
    configurationId: ''
  };

  constructor(
    private store: Store,
    private router: Router,
    private strategySvc: SettingsService,
    private reportSvc: ReportService,
    private authService: AuthService,
    private globalStrategyUpdater: GlobalStrategyUpdaterService,
    private planLimitationsGuard: PlanLimitationsGuard,
    private appContext: AppContextService
  ) {}

  async ngOnInit(): Promise<void> {
    this.initialLoading = true;
    
    try {
      // Suscribirse a los datos del contexto
      this.subscribeToContextData();
      
      // Ejecutar todas las operaciones de inicialización
      await Promise.all([
        this.initializeUserData(),
        this.initializeAccounts(),
        this.initializeStrategies(),
        this.initializeReportData()
      ]);
      
      await Promise.all([
        this.listenConfigurations(),
        this.listenReportData(),
        this.initializeGlobalStrategyUpdater()
      ]);
      
    } catch (error) {
      console.error('Error during initialization:', error);
    } finally {
      this.initialLoading = false;
    }
  }

  private subscribeToContextData() {
    // Suscribirse a los datos del usuario
    this.appContext.currentUser$.subscribe(user => {
      this.user = user;
    });

    // Suscribirse a las cuentas del usuario
    this.appContext.userAccounts$.subscribe(accounts => {
      this.accountsData = accounts;
    });

    // Suscribirse a las estrategias del usuario
    this.appContext.userStrategies$.subscribe(strategies => {
      this.userStrategies = strategies;
      this.filteredStrategies = strategies;
      this.updateStrategyCard();
    });

    // Suscribirse a los estados de carga
    this.appContext.isLoading$.subscribe(loading => {
      this.loading = loading.strategies;
    });

    // Suscribirse a los errores
    this.appContext.errors$.subscribe(errors => {
      if (errors.strategies) {
        console.error('Error en estrategias:', errors.strategies);
      }
    });
  }

  /**
   * Inicializa los datos del usuario
   */
  private async initializeUserData(): Promise<void> {
    return new Promise((resolve) => {
      this.store.select(selectUser).subscribe({
        next: (user) => {
          this.user = user.user;
          resolve();
        },
        error: (err) => {
          console.error('Error fetching user data', err);
          resolve();
        },
      });
    });
  }

  /**
   * Inicializa las cuentas del usuario
   */
  private async initializeAccounts(): Promise<void> {
    if (this.user?.id) {
      try {
        const accounts = await this.authService.getUserAccounts(this.user.id);
        this.accountsData = accounts || [];
        await this.checkPlanLimitations();
        this.fetchUserKey();
      } catch (error) {
        console.error('Error loading accounts:', error);
      }
    }
  }

  /**
   * Inicializa las estrategias del usuario
   */
  private async initializeStrategies(): Promise<void> {
    if (this.user?.id) {
      try {
        await this.loadUserStrategies();
      } catch (error) {
        console.error('Error loading strategies:', error);
      }
    }
  }

  /**
   * Inicializa los datos de reporte
   */
  private async initializeReportData(): Promise<void> {
    try {
      this.getActualBalance();
    } catch (error) {
      console.error('Error loading report data:', error);
    }
  }

  /**
   * Inicializa el servicio global de actualización de estrategias
   */
  private initializeGlobalStrategyUpdater(): void {
    if (this.user?.id) {
      this.globalStrategyUpdater.updateAllStrategies(this.user.id);
    }
  }

  ngOnDestroy(): void {
    // Limpiar recursos si es necesario
  }

  fetchUserKey() {
    if (this.user?.email && this.accountsData.length > 0) {
      // Use the first account's credentials
      const firstAccount = this.accountsData[0];
      this.reportSvc
        .getUserKey(firstAccount.emailTradingAccount, firstAccount.brokerPassword, firstAccount.server)
        .subscribe({
          next: (key: string) => {
            this.store.dispatch(setUserKey({ userKey: key }));
          },
          error: (err) => {
            console.error('Error fetching user key:', err);
            this.store.dispatch(setUserKey({ userKey: '' }));
          },
        });
    } else {
      console.warn('No user email or accounts available for fetching user key');
      this.store.dispatch(setUserKey({ userKey: '' }));
    }
  }

  getActualBalance() {
    this.store
      .select(selectUserKey)
      .pipe()
      .subscribe({
        next: async (userKey) => {
          if (userKey === '') {
            this.fetchUserKey();
          } else {
            // Use the first account's data dynamically
            if (this.accountsData.length > 0) {
              const firstAccount = this.accountsData[0];
              // El servicio ya actualiza el contexto automáticamente
              this.reportSvc.getBalanceData(firstAccount.accountID as string, userKey, firstAccount.accountNumber as number).subscribe({
                next: async (balance) => {
                  await this.loadConfig(balance);
                },
                error: (err) => {
                  console.error('Error fetching balance data', err);
                },
              });
            } else {
              console.warn('No accounts available for fetching balance');
              await this.loadConfig(0);
            }
          }
        },
      });
  }

  getUserData() {
    this.store.select(selectUser).subscribe({
      next: (user) => {
        this.user = user.user;
      },
      error: (err) => {
        console.error('Error fetching user data', err);
      },
    });
  }

  async loadConfig(balance: number) {
    this.loading = true;
    
    // Primero intentar cargar la estrategia activa
    if (this.activeStrategy) {
      await this.loadActiveStrategyConfig(balance);
      return;
    }

    // Si no hay estrategia activa, cargar desde configurations (compatibilidad)
    this.strategySvc
      .getConfiguration(this.user?.id || '')
      .then(async (configuration) => {
        if (configuration) {
          const riskPerTradeBalance = {
            ...configuration.riskPerTrade,
            balance: balance,
          };

          // Crear configuración completa con los campos requeridos
          const completeConfig: StrategyState = {
            ...configuration,
            riskPerTrade: riskPerTradeBalance
          };

          this.store.dispatch(
            resetConfig({
              config: completeConfig,
            })
          );
        } else {
          this.store.dispatch(resetConfig({ config: initialStrategyState }));
        }
        this.loading = false;
        await this.checkPlanLimitations();
      })
      .catch(async (err) => {
        this.store.dispatch(resetConfig({ config: initialStrategyState }));
        this.loading = false;
        console.error('Error to get the config', err);
        await this.checkPlanLimitations();
      });
  }

  // Cargar configuración de la estrategia activa
  async loadActiveStrategyConfig(balance: number) {
    if (!this.activeStrategy || !this.user?.id) {
      this.store.dispatch(resetConfig({ config: initialStrategyState }));
      this.loading = false;
      this.checkPlanLimitations();
      return;
    }

    try {
      // Obtener la estrategia completa (configuration-overview + configurations)
      const strategyData = await this.strategySvc.getStrategyView((this.activeStrategy as any).id);
      
      if (strategyData && strategyData.configuration) {
        const riskPerTradeBalance = {
          ...strategyData.configuration.riskPerTrade,
          balance: balance,
        };

        // Crear configuración completa con los campos requeridos
        const completeConfig: StrategyState = {
          ...strategyData.configuration,
          riskPerTrade: riskPerTradeBalance
        };

        this.store.dispatch(
          resetConfig({
            config: completeConfig,
          })
        );
      } else {
        this.store.dispatch(resetConfig({ config: initialStrategyState }));
      }
    } catch (error) {
      console.error('Error loading active strategy config:', error);
      this.store.dispatch(resetConfig({ config: initialStrategyState }));
    }
    
    this.loading = false;
    this.checkPlanLimitations();
  }

  listenConfigurations() {
    this.store
      .select(allRules)
      .pipe()
      .subscribe((config) => {
        this.config = { ...config };
        this.updateStrategyCard(); // Update card when config changes
      });
  }

  openEditPopup() {
    this.router.navigate(['/edit-strategy']);
  }

  onSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm = value;
    this.filterStrategies();
  }

  filterStrategies() {
    if (!this.searchTerm.trim()) {
      this.filteredStrategies = [...this.userStrategies];
    } else {
      this.filteredStrategies = this.userStrategies.filter(strategy => 
        strategy.name.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }

  // Obtener datos de card por ID de estrategia
  getCardDataByStrategyId(strategyId: string): StrategyCardData | undefined {
    return this.strategyCardsData.find(card => card.id === strategyId);
  }

  async onNewStrategy() {
    if (!this.user?.id || this.isAddStrategyDisabled) return;

    // Contar el total de estrategias del usuario (activas + inactivas)
    const totalStrategies = this.userStrategies.length + (this.activeStrategy ? 1 : 0);
    const accessCheck = await this.planLimitationsGuard.checkStrategyCreationWithModal(this.user.id, totalStrategies);
    
    if (!accessCheck.canCreate) {
      // El banner ya se muestra automáticamente, no necesitamos modal
      return;
    }
    
    this.router.navigate(['/edit-strategy']);
  }

  // Strategy Card Event Handlers
  onStrategyEdit(strategyId: string) {
    this.router.navigate(['/edit-strategy'], { queryParams: { strategyId: strategyId } });
  }

  onStrategyFavorite(strategyId: string) {
    // TODO: Implementar funcionalidad de favoritos en la base de datos
    // Por ahora solo actualizar el estado local
    const strategy = this.userStrategies.find(s => (s as any).id === strategyId);
    if (strategy) {
    }
  }

  onStrategyMoreOptions(strategyId: string) {
    // TODO: Implementar menú de opciones (copiar, eliminar, etc.)
    // Por ahora mostrar opciones básicas
    const strategy = this.userStrategies.find(s => (s as any).id === strategyId);
    if (strategy) {
      const action = confirm(`Options for "${strategy.name}":\n\nOK - Copy strategy\nCancel - Delete strategy`);
      if (action) {
        this.copyStrategy(strategyId);
      } else {
        this.deleteStrategy(strategyId);
      }
    }
  }

  onStrategyCustomize(strategyId: string) {
    this.router.navigate(['/edit-strategy'], { queryParams: { strategyId: strategyId } });
  }

  // Plan detection and banner methods
  fetchUserAccounts() {
    if (this.user?.id) {
      this.authService.getUserAccounts(this.user.id).then(async (accounts) => {
        this.accountsData = accounts || [];
        await this.checkPlanLimitations();
        // After loading accounts, try to fetch user key
        this.fetchUserKey();
      });
    }
  }

  listenReportData() {
    // Listen to trade win percentage
    this.store.select(selectTradeWin).subscribe((tradeWin) => {
      this.tradeWin = tradeWin;
      this.updateStrategyCard();
    });

    // Listen to total trades
    this.store.select(selectTotalTrades).subscribe((totalTrades) => {
      this.totalTrades = totalTrades;
      this.updateStrategyCard();
    });

    // Listen to net PnL
    this.store.select(selectNetPnL).subscribe((netPnL) => {
      this.netPnL = netPnL;
      this.updateStrategyCard();
    });
  }

  updateStrategyCard() {
    // Solo actualizar si hay una estrategia activa
    if (this.activeStrategy) {
      this.updateStrategyCardWithActiveStrategy();
    }
  }

  countActiveRules(config: any): number {
    let count = 0;
    if (config.maxDailyTrades?.isActive) count++;
    if (config.riskReward?.isActive) count++;
    if (config.riskPerTrade?.isActive) count++;
    if (config.daysAllowed?.isActive) count++;
    if (config.hoursAllowed?.isActive) count++;
    if (config.assetsAllowed?.isActive) count++;
    return count;
  }

  getLastModifiedDate(): string {
    // For now, return current date. In the future, this could come from a timestamp in the config
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear();
    return `${month} ${day}, ${year}`;
  }

  // Check if the current plan allows multiple strategies
  canCreateMultipleStrategies(): boolean {
    // This will be determined by the plan limitations guard
    return true; // Default to true, let the guard handle the actual validation
  }

  private getActiveStrategyCount(): number {
    if (!this.config) return 0;
    
    let count = 0;
    Object.values(this.config).forEach(rule => {
      if (rule && typeof rule === 'object' && 'isActive' in rule && rule.isActive) {
        count++;
      }
    });
    return count;
  }

  private async checkPlanLimitations() {
    if (!this.user?.id) {
      this.showPlanBanner = false;
      return;
    }

    try {
      // Get user's plan limitations from the guard
      const limitations = await this.planLimitationsGuard.checkUserLimitations(this.user.id);
      const totalStrategies = this.userStrategies.length + (this.activeStrategy ? 1 : 0);
      
      this.showPlanBanner = false;
      this.planBannerMessage = '';
      this.planBannerType = 'info';

      // If user needs subscription or is banned/cancelled
      if (limitations.needsSubscription || limitations.isBanned || limitations.isCancelled) {
        this.showPlanBanner = true;
        this.planBannerMessage = this.getBlockedMessage(limitations);
        this.planBannerType = 'warning';
        return;
      }

      // Check if user has reached strategy limit
      if (totalStrategies >= limitations.maxStrategies) {
        this.showPlanBanner = true;
        this.planBannerMessage = `You've reached the strategy limit for your ${limitations.planName} plan. Move to a higher plan and keep growing your account.`;
        this.planBannerType = 'warning';
      } else if (totalStrategies >= limitations.maxStrategies - 1) {
        // Show warning when close to limit
        this.showPlanBanner = true;
        this.planBannerMessage = `You have ${limitations.maxStrategies - totalStrategies} strategies left on your current plan. Want more? Upgrade anytime.`;
        this.planBannerType = 'info';
      }
    } catch (error) {
      console.error('Error checking plan limitations:', error);
      this.showPlanBanner = false;
    }
  }

  private getBlockedMessage(limitations: any): string {
    if (limitations.isBanned) {
      return 'Your account has been banned. Please contact support for assistance.';
    }
    
    if (limitations.isCancelled) {
      return 'Your subscription has been cancelled. Please purchase a plan to access this functionality.';
    }
    
    if (limitations.needsSubscription) {
      return 'You need to purchase a plan to access this functionality.';
    }
    
    return 'Access denied. Please contact support for assistance.';
  }

  onUpgradePlan() {
    this.router.navigate(['/account']);
  }

  onCloseBanner() {
    this.showPlanBanner = false;
  }


  // Check strategy limitations and update button state
  async checkStrategyLimitations() {
    if (!this.user?.id) {
      this.isAddStrategyDisabled = true;
      return;
    }

    try {
      // Contar el total de estrategias del usuario (activas + inactivas)
      const totalStrategies = this.userStrategies.length + (this.activeStrategy ? 1 : 0);
      const accessCheck = await this.planLimitationsGuard.checkStrategyCreationWithModal(this.user.id, totalStrategies);
      
      this.isAddStrategyDisabled = !accessCheck.canCreate;
      
      // El banner se actualiza automáticamente en checkPlanLimitations()
    } catch (error) {
      console.error('Error checking strategy limitations:', error);
      this.isAddStrategyDisabled = true;
    }
  }

  // ===== MÉTODOS PARA MÚLTIPLES ESTRATEGIAS =====

  // Cargar todas las estrategias del usuario
  async loadUserStrategies() {
    if (!this.user?.id) {
      return;
    }

    try {
      // Una sola llamada para obtener todas las estrategias
      const allStrategies = await this.strategySvc.getUserStrategyViews(this.user.id);
      
      // Separar estrategia activa de las inactivas
      this.activeStrategy = allStrategies.find(strategy => strategy.status === true) || null;
      this.userStrategies = allStrategies.filter(strategy => strategy.status !== true);
      
      // Inicializar filteredStrategies
      this.filteredStrategies = [...this.userStrategies];
      
      // Cargar datos de las cards para las estrategias inactivas
      await this.loadStrategyCardsData();
      
      if (this.activeStrategy) {
        this.updateStrategyCardWithActiveStrategy();
      }
      
      // Verificar limitaciones después de cargar las estrategias
      this.checkStrategyLimitations();
    } catch (error) {
      console.error('❌ Error loading user strategies:', error);
    }
  }

  // Cargar datos de las cards para todas las estrategias
  async loadStrategyCardsData() {
    this.strategyCardsData = [];
    
    for (const strategy of this.userStrategies) {
      try {
        const cardData = await this.getStrategyCardData(strategy);
        this.strategyCardsData.push(cardData);
      } catch (error) {
        console.error('Error loading card data for strategy:', strategy.name, error);
        // Agregar datos básicos en caso de error
        this.strategyCardsData.push({
          id: (strategy as any).id,
          name: strategy.name,
          status: strategy.status,
          lastModified: this.formatDate(strategy.updated_at.toDate()),
          rules: 0,
          days_active: strategy.days_active || 0,
          winRate: 0,
          isFavorite: false,
          created_at: strategy.created_at,
          updated_at: strategy.updated_at,
          userId: strategy.userId,
          configurationId: strategy.configurationId
        });
      }
    }
  }

  // Crear nueva estrategia
  async onCreateNewStrategy() {
    if (!this.newStrategyName.trim()) {
      alert('Please enter a strategy name');
      return;
    }

    if (!this.user?.id) return;

    try {
      // 1. Primero recargar las strategies para tener el estado actualizado
      await this.loadUserStrategies();
      
      // 2. Verificar si ya hay una estrategia activa
      const hasActiveStrategy = this.activeStrategy !== null;
      
      // 3. Crear configuración vacía con reglas por defecto (todas inactivas)
      const emptyStrategyConfig: StrategyState = {
        maxDailyTrades: {
          isActive: false,
          maxDailyTrades: 1,
          type: 'MAX DAILY TRADES' as any,
        },
        riskReward: {
          isActive: false,
          riskRewardRatio: '1:2',
          type: 'RISK REWARD RATIO' as any,
        },
        riskPerTrade: {
          isActive: false,
          maxRiskPerTrade: 300,
          maxRiskPercentage: 3,
          type: 'MAX RISK PER TRADE' as any,
          balance: 0,
        },
        daysAllowed: {
          isActive: false,
          type: 'DAYS ALLOWED' as any,
          tradingDays: ['Monday', 'Tuesday'],
        },
        hoursAllowed: {
          isActive: false,
          tradingOpenTime: '09:30',
          tradingCloseTime: '17:00',
          timezone: 'UTC',
          type: 'TRADING HOURS' as any,
        },
        assetsAllowed: {
          isActive: false,
          type: 'ASSETS ALLOWED' as any,
          assetsAllowed: ['XMRUSD', 'BTCUSD'],
        },
      };

      // 4. Crear la nueva estrategia con el status correcto
      const strategyId = await this.strategySvc.createStrategyView(
        this.user.id,
        this.newStrategyName.trim(),
        emptyStrategyConfig,
        !hasActiveStrategy // Activa solo si no hay otra activa
      );

      // 5. Cerrar el componente de crear strategy ANTES de recargar
      this.newStrategyName = '';
      this.showStrategySelector = false;

      // 6. Recargar estrategias para mostrar la nueva
      await this.loadUserStrategies();
    } catch (error) {
      console.error('Error creating strategy:', error);
      alert('Error creating strategy. Please try again.');
    }
  }

  // Activar una estrategia
  async activateStrategy(strategyId: string) {
    if (!this.user?.id) return;

    try {
      const currentTimestamp = new Date();
      
      // Verificar si hay una estrategia activa actualmente
      if (this.activeStrategy && (this.activeStrategy as any).id !== strategyId) {
        // Hay una estrategia activa diferente, desactivarla primero
        await this.strategySvc.updateStrategyDates(
          this.user.id, 
          (this.activeStrategy as any).id, 
          undefined, // No agregar a dateActive
          currentTimestamp // Agregar timestamp actual a dateInactive
        );
      }
      
      // Activar la nueva estrategia
      await this.strategySvc.updateStrategyDates(
        this.user.id, 
        strategyId, 
        currentTimestamp, // Agregar timestamp actual a dateActive
        undefined // No agregar a dateInactive
      );
      
      // Recargar estrategias (una sola llamada)
      await this.loadUserStrategies();
      
      // Recargar configuración con la nueva estrategia activa
      // Obtener balance desde la configuración actual
      const currentConfig = this.config;
      const balance = currentConfig?.riskPerTrade?.balance || 0;
      this.loadConfig(balance);
    } catch (error) {
      console.error('Error activating strategy:', error);
      alert('Error activating strategy. Please try again.');
    }
  }

  // Eliminar estrategia
  async deleteStrategy(strategyId: string) {
    if (!confirm('Are you sure you want to delete this strategy? This action cannot be undone.')) {
      return;
    }

    try {
      await this.strategySvc.deleteStrategyView(strategyId);
      
      // Recargar estrategias (una sola llamada)
      await this.loadUserStrategies();
      
      // Si se eliminó la estrategia activa, cargar la primera disponible o estado inicial
      if (!this.activeStrategy) {
        if (this.userStrategies.length > 0) {
          await this.activateStrategy((this.userStrategies[0] as any).id);
        } else {
          this.store.dispatch(resetConfig({ config: initialStrategyState }));
        }
      }
    } catch (error) {
      console.error('Error deleting strategy:', error);
      alert('Error deleting strategy. Please try again.');
    }
  }

  // Actualizar nombre de estrategia
  async updateStrategyName(strategyId: string, newName: string) {
    if (!newName.trim()) {
      alert('Please enter a valid strategy name');
      return;
    }

    try {
      await this.strategySvc.updateStrategyView(strategyId, { name: newName.trim() });
      
      // Recargar estrategias (una sola llamada)
      await this.loadUserStrategies();
    } catch (error) {
      console.error('Error updating strategy name:', error);
      alert('Error updating strategy name. Please try again.');
    }
  }

  // Actualizar strategy card con la estrategia activa
  async updateStrategyCardWithActiveStrategy() {
    if (!this.activeStrategy || !this.user?.id) return;

    try {
      // Obtener la estrategia completa (configurations + configuration-overview)
      const strategyData = await this.strategySvc.getStrategyView((this.activeStrategy as any).id);
      
      if (!strategyData) {
        console.error('No strategy data found for active strategy');
        return;
      }

      // Calcular win rate (por ahora 0, necesitamos implementar la lógica)
      const winRate = 0; // TODO: Implementar cálculo de win rate

      // Contar reglas activas de la configuración
      const activeRules = strategyData.configuration ? this.countActiveRules(strategyData.configuration) : 0;
      
      // Formatear fecha de actualización
      const lastModified = this.formatDate(strategyData.overview.updated_at.toDate());

      this.strategyCard = {
        id: (this.activeStrategy as any).id,
        name: strategyData.overview.name, // Nombre de la estrategia desde overview
        status: strategyData.overview.status, // Estado desde overview
        lastModified: lastModified, // updated_at formateado desde overview
        rules: activeRules, // Reglas activas de configuration
        days_active: strategyData.overview.days_active || 0, // days_active desde overview
        winRate: winRate, // Win rate (por implementar)
        isFavorite: this.strategyCard.isFavorite,
        created_at: strategyData.overview.created_at,
        updated_at: strategyData.overview.updated_at,
        userId: strategyData.overview.userId,
        configurationId: strategyData.overview.configurationId
      };
    } catch (error) {
      console.error('Error updating strategy card with active strategy:', error);
    }
  }

  // Formatear fecha
  formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  }

  // Toggle selector de estrategias
  toggleStrategySelector() {
    this.showStrategySelector = !this.showStrategySelector;
  }

  // Cancelar creación de estrategia
  onCancelNewStrategy() {
    this.newStrategyName = '';
    this.showStrategySelector = false;
  }

  // Obtener ID de la estrategia para el track
  getStrategyId(strategy: ConfigurationOverview): string {
    return (strategy as any).id;
  }

  // Convertir ConfigurationOverview a StrategyCardData
  async getStrategyCardData(strategy: ConfigurationOverview): Promise<StrategyCardData> {
    try {
      // Obtener la estrategia completa (configurations + configuration-overview)
      const strategyData = await this.strategySvc.getStrategyView((strategy as any).id);
      
      if (!strategyData) {
        console.error('No strategy data found for strategy:', strategy.name);
        // Retornar datos básicos en caso de error
        return {
          id: (strategy as any).id,
          name: strategy.name,
          status: strategy.status,
          lastModified: this.formatDate(strategy.updated_at.toDate()),
          rules: 0,
          days_active: strategy.days_active || 0,
          winRate: 0,
          isFavorite: false,
          created_at: strategy.created_at,
          updated_at: strategy.updated_at,
          userId: strategy.userId,
          configurationId: strategy.configurationId
        };
      }

      // Calcular win rate (por ahora 0, necesitamos implementar la lógica)
      const winRate = 0; // TODO: Implementar cálculo de win rate

      // Contar reglas activas de la configuración
      const activeRules = strategyData.configuration ? this.countActiveRules(strategyData.configuration) : 0;
      
      // Formatear fecha de actualización
      const lastModified = this.formatDate(strategyData.overview.updated_at.toDate());

      const cardData: StrategyCardData = {
        id: (strategy as any).id,
        name: strategyData.overview.name, // Nombre desde overview
        status: strategyData.overview.status, // Estado desde overview
        lastModified: lastModified, // updated_at desde overview
        rules: activeRules, // Reglas activas de configuration
        days_active: strategyData.overview.days_active || 0, // days_active desde overview
        winRate: winRate, // Win rate (por implementar)
        isFavorite: false,
        created_at: strategyData.overview.created_at,
        updated_at: strategyData.overview.updated_at,
        userId: strategyData.overview.userId,
        configurationId: strategyData.overview.configurationId
      };

      return cardData;
    } catch (error) {
      console.error('Error getting strategy card data:', error);
      // Retornar datos básicos en caso de error
      return {
        id: (strategy as any).id,
        name: strategy.name,
        status: strategy.status,
        lastModified: this.formatDate(strategy.updated_at.toDate()),
        rules: 0,
        days_active: strategy.days_active || 0,
        winRate: 0,
        isFavorite: false,
        created_at: strategy.created_at,
        updated_at: strategy.updated_at,
        userId: strategy.userId,
        configurationId: strategy.configurationId
      };
    }
  }

  // Copiar estrategia
  async copyStrategy(strategyId: string) {
    if (!this.user?.id) return;

    try {
      const strategy = this.userStrategies.find(s => (s as any).id === strategyId);
      if (!strategy) {
        console.error('Strategy not found');
        return;
      }

      const newName = `${strategy.name} (Copy)`;
      
      // Obtener la estrategia completa (configuration-overview + configurations)
      const strategyData = await this.strategySvc.getStrategyView((strategy as any).id);
      if (!strategyData || !strategyData.configuration) {
        console.error('Strategy configuration not found');
        return;
      }
      
      // Crear configuración con los campos requeridos para la copia
      const strategyConfig: StrategyState = {
        ...strategyData.configuration
      };

      const newStrategyId = await this.strategySvc.createStrategyView(
        this.user.id,
        newName,
        strategyConfig
      );

      // Recargar estrategias (una sola llamada)
      await this.loadUserStrategies();
      
    } catch (error) {
      console.error('Error copying strategy:', error);
      alert('Error copying strategy. Please try again.');
    }
  }

  // Navegar a trading accounts
  navigateToTradingAccounts() {
    this.router.navigate(['/trading-accounts']);
  }
}
