import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { User } from '../overview/models/overview';
import { selectUser } from '../auth/store/user.selectios';
import { SettingsService } from './service/strategy.service';
import { ConfigurationOverview } from './models/strategy.model';
import { TextInputComponent, StrategyCardComponent, StrategyCardData, StrategyGuideModalComponent, LoadingSpinnerComponent, PlanBannerComponent } from '../../shared/components';
import { ConfirmPopupComponent } from '../../shared/pop-ups/confirm-pop-up/confirm-popup.component';
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
import { StrategyCacheService } from './services/strategy-cache.service';
import { BalanceCacheService } from './services/balance-cache.service';


@Component({
  selector: 'app-strategy',
  imports: [
    CommonModule,
    FormsModule,
    TextInputComponent,
    StrategyCardComponent,
    StrategyGuideModalComponent,
    LoadingSpinnerComponent,
    PlanBannerComponent,
    ConfirmPopupComponent,
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
  
  // Strategy guide modal
  showStrategyGuide = false;
  
  // Loading state for strategy creation
  isCreatingStrategy = false;
  
  // Loading state for strategy operations (activate, delete, copy)
  isProcessingStrategy = false;
  
  // Delete strategy confirmation popup
  showDeleteConfirmPopup = false;
  strategyToDeleteId: string = '';
  
  // Report data for strategy card
  tradeWin: number = 0;
  totalTrades: number = 0;
  netPnL: number = 0;
  
  // Nuevas propiedades para múltiples estrategias
  userStrategies: ConfigurationOverview[] = [];
  activeStrategy: ConfigurationOverview | null = null;
  filteredStrategies: ConfigurationOverview[] = [];
  strategyCardsData: StrategyCardData[] = [];
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

  // CACHE CENTRALIZADO - Usar servicio de cache

  constructor(
    private store: Store,
    private router: Router,
    private strategySvc: SettingsService,
    private reportSvc: ReportService,
    private authService: AuthService,
    private globalStrategyUpdater: GlobalStrategyUpdaterService,
    private planLimitationsGuard: PlanLimitationsGuard,
    private appContext: AppContextService,
    private strategyCacheService: StrategyCacheService,
    private balanceCacheService: BalanceCacheService
  ) {}

  async ngOnInit(): Promise<void> {
    this.initialLoading = true;
    
    try {
      // FLUJO SIMPLIFICADO: Una sola secuencia de inicialización
      await this.initializeEverything();
    } catch (error) {
      console.error('Error during initialization:', error);
    } finally {
      this.initialLoading = false;
    }
  }

  /**
   * FLUJO SIMPLIFICADO DE INICIALIZACIÓN
   * 1. Obtener usuario
   * 2. Cargar cuentas
   * 3. Cargar TODAS las estrategias completas (overview + configuration) en cache
   * 4. Configurar listeners
   * 5. Cargar datos de reporte
   */
  private async initializeEverything(): Promise<void> {
    // 1. Obtener usuario
    await this.initializeUserData();
    
    if (!this.user?.id) {
      console.error('No user ID available');
      return;
    }

    // 2. Cargar cuentas
    await this.initializeAccounts();
    
    // 3. Cargar TODAS las estrategias completas en cache
    await this.loadAllStrategiesToCache();
    
    // 4. Configurar listeners
    this.setupListeners();
    
    // 5. Cargar datos de reporte
    await this.initializeReportData();
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
   * MÉTODO PRINCIPAL: Cargar TODAS las estrategias completas al cache
   * Este método carga tanto el overview como la configuration de cada estrategia
   * y las almacena en el cache para acceso rápido
   */
  private async loadAllStrategiesToCache(): Promise<void> {
    if (!this.user?.id) return;

    try {
      
      // Limpiar cache anterior
      this.strategyCacheService.clearCache();
      
      // 1. Obtener todas las estrategias (overviews)
      const allStrategies = await this.strategySvc.getUserStrategyViews(this.user.id);
      
      if (!allStrategies || allStrategies.length === 0) {
        this.userStrategies = [];
        this.activeStrategy = null;
        this.filteredStrategies = [];
        return;
      }

      // 2. Para cada estrategia, cargar su configuración completa
      const strategiesWithConfigs = await Promise.all(
        allStrategies.map(async (strategy) => {
          try {
            // Obtener la configuración completa
            const strategyData = await this.strategySvc.getStrategyView((strategy as any).id);
            
            if (strategyData && strategyData.configuration) {
              // Almacenar en cache usando el servicio
              this.strategyCacheService.setStrategy(
                (strategy as any).id,
                strategyData.overview,
                strategyData.configuration
              );
              
              return {
                overview: strategyData.overview,
                configuration: strategyData.configuration
              };
            } else {
              return null;
            }
          } catch (error) {
            console.error(`❌ Error loading strategy ${strategy.name}:`, error);
            return null;
          }
        })
      );

      // 3. Filtrar estrategias válidas y separar activa de inactivas
      const validStrategies = strategiesWithConfigs.filter(s => s !== null);
      
      this.activeStrategy = validStrategies.find(s => s.overview.status === true)?.overview || null;
      this.userStrategies = validStrategies.filter(s => s.overview.status !== true).map(s => s.overview);
      this.filteredStrategies = [...this.userStrategies];

      // 4. Cargar datos de las cards
      await this.loadStrategyCardsData();
      
      // 5. Actualizar strategy card si hay estrategia activa
      if (this.activeStrategy) {
        this.updateStrategyCardWithActiveStrategy();
      }

      // 6. Verificar limitaciones
      this.checkStrategyLimitations();

    } catch (error) {
      console.error('❌ Error loading strategies to cache:', error);
      this.userStrategies = [];
      this.activeStrategy = null;
      this.filteredStrategies = [];
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
   * Configurar todos los listeners necesarios
   */
  private setupListeners(): void {
    // Suscribirse a los datos del contexto
    this.subscribeToContextData();
    
    // Configurar listeners de reporte
    this.listenReportData();
    
    // Inicializar servicio global de actualización
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
    // Usar el método optimizado que carga desde cache primero
    this.loadConfigWithCachedBalance();
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

  /**
   * MÉTODO SIMPLIFICADO: Cargar configuración usando el cache
   * Ya no hace peticiones a Firebase, solo lee del cache
   */
  async loadConfig(balance: number) {
    this.loading = true;
    
    try {
      // Si hay estrategia activa, usar su configuración del cache
      if (this.activeStrategy) {
        const cachedStrategy = this.strategyCacheService.getStrategy((this.activeStrategy as any).id);
        
        if (cachedStrategy) {
          // Actualizar balance en riskPerTrade
          const configWithBalance = {
            ...cachedStrategy.configuration,
            riskPerTrade: {
              ...cachedStrategy.configuration.riskPerTrade,
              balance: balance
            }
          };
          
          this.config = configWithBalance;
        } else {
          this.config = initialStrategyState;
        }
      } else {
        // No hay estrategia activa, usar configuración inicial
        this.config = {
          ...initialStrategyState,
          riskPerTrade: {
            ...initialStrategyState.riskPerTrade,
            balance: balance
          }
        };
      }
      
      await this.checkPlanLimitations();
    } catch (error) {
      console.error('Error loading config:', error);
      this.config = initialStrategyState;
    } finally {
      this.loading = false;
    }
  }

  /**
   * MÉTODO OPTIMIZADO: Cargar configuración con balance desde cache
   */
  async loadConfigWithCachedBalance() {
    this.loading = true;
    
    try {
      // Obtener balance desde cache
      let balance = 0;
      if (this.accountsData.length > 0) {
        const firstAccount = this.accountsData[0];
        balance = this.balanceCacheService.getBalance(firstAccount.accountID);
      }

      // Cargar configuración con balance del cache
      await this.loadConfig(balance);

      // Si necesita actualización, hacer petición en background
      if (this.accountsData.length > 0) {
        const firstAccount = this.accountsData[0];
        if (this.balanceCacheService.needsUpdate(firstAccount.accountID)) {
          this.updateBalanceInBackground(firstAccount);
        }
      }
    } catch (error) {
      console.error('Error loading config with cached balance:', error);
      this.config = initialStrategyState;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Actualizar balance en background sin bloquear la UI
   */
  private updateBalanceInBackground(account: AccountData) {
    this.store.select(selectUserKey).pipe().subscribe({
      next: (userKey) => {
        if (userKey && userKey !== '') {
          this.reportSvc.getBalanceData(account.accountID as string, userKey, account.accountNumber as number).subscribe({
            next: (balance) => {
              // Actualizar cache con nuevo balance
              this.balanceCacheService.setBalance(account.accountID, balance);
              // Recargar configuración con nuevo balance
              this.loadConfig(balance);
            },
            error: (err) => {
              console.error('Error fetching balance data in background:', err);
            },
          });
        }
      },
    });
  }

  /**
   * MÉTODO PÚBLICO: Invalidar cache y recargar estrategias
   * Se llama cuando hay cambios en las estrategias (crear, actualizar, eliminar)
   */
  public async invalidateCacheAndReload(): Promise<void> {
    await this.loadAllStrategiesToCache();
  }

  /**
   * MÉTODO PÚBLICO: Obtener estrategia del cache
   * Para que edit-strategy pueda acceder a los datos sin hacer peticiones
   */
  public getStrategyFromCache(strategyId: string): { overview: ConfigurationOverview; configuration: StrategyState } | null {
    return this.strategyCacheService.getStrategy(strategyId);
  }

  /**
   * MÉTODO PÚBLICO: Verificar si el cache está cargado
   */
  public isCacheLoaded(): boolean {
    return this.strategyCacheService.isCacheLoaded();
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

  // Contar el total de estrategias del usuario (activas + inactivas) sin duplicar
  private getTotalStrategiesCount(): number {
    const uniqueIds = new Set<string>();
    this.userStrategies.forEach(s => uniqueIds.add((s as any).id));
    if (this.activeStrategy) uniqueIds.add((this.activeStrategy as any).id);

    const total = uniqueIds.size;

    return total;
  }

  async onNewStrategy() {
    if (!this.user?.id || this.isCreatingStrategy) return;

    try {
      // Activar loading
      this.isCreatingStrategy = true;

      // Contar el total de estrategias del usuario (activas + inactivas)
      const totalStrategies = this.getTotalStrategiesCount();
      const accessCheck = await this.planLimitationsGuard.checkStrategyCreationWithModal(this.user.id, totalStrategies);
      
      if (!accessCheck.canCreate) {
        // Verificar si es el plan Pro con 8 estrategias (límite máximo)
        const limitations = await this.planLimitationsGuard.checkUserLimitations(this.user.id);
        const isProPlanWithMaxStrategies = limitations.planName.toLowerCase().includes('pro') && 
                                          limitations.maxStrategies === 8 && 
                                          totalStrategies >= 8;
        
        if (isProPlanWithMaxStrategies) {
          // Para plan Pro con 8 estrategias: desactivar botón
          this.isAddStrategyDisabled = true;
          return;
        } else {
          // Para otros planes: redirigir a la página de cuenta
          this.router.navigate(['/account'], { 
            queryParams: { tab: 'plan' } 
          });
          return;
        }
      }
      
      // Verificar si es la primera estrategia del usuario
      if (totalStrategies === 0) {
        // Primera estrategia: mostrar modal de guía de estrategias
        this.showStrategyGuide = true;
      } else {
        // Estrategias adicionales: crear automáticamente con nombre genérico
        await this.createGenericStrategy();
      }
    } finally {
      // Desactivar loading
      this.isCreatingStrategy = false;
    }
  }

  // Strategy Card Event Handlers
  onStrategyEdit(strategyId: string) {
    // Verificar si el usuario no ha marcado "don't show again"
    const dontShowAgain = localStorage.getItem('strategy-guide-dont-show');
    
    // Si no ha marcado "don't show again", mostrar el modal de guía
    if (!dontShowAgain) {
      this.showStrategyGuide = true;
      return;
    }
    
    // Si ya marcó "don't show again", navegar directamente a edit-strategy
    if (strategyId) {
      this.router.navigate(['/edit-strategy'], { queryParams: { strategyId: strategyId } });
    } else {
      alert('No strategy found. Please create a strategy first.');
    }
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
      const totalStrategies = this.getTotalStrategiesCount();
      
      this.showPlanBanner = false;
      this.planBannerMessage = '';
      this.planBannerType = 'info';

      // If user needs subscription or is banned/cancelled
      if (limitations.needsSubscription || limitations.isBanned || limitations.isCancelled) {
        // Only show banner if user has trading accounts (not first-time user with plan)
        if (this.accountsData.length > 0) {
          this.showPlanBanner = true;
          this.planBannerMessage = this.getBlockedMessage(limitations);
          this.planBannerType = 'warning';
        }
        return;
      }

      // Check if user has reached strategy limit
      if (totalStrategies >= limitations.maxStrategies) {
        this.showPlanBanner = true;
        this.planBannerMessage = `You've reached the strategy limit for your ${limitations.planName} plan. Move to a higher plan and keep growing your account.`;
        this.planBannerType = 'warning';
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
    this.router.navigate(['/account'], { 
      queryParams: { tab: 'plan' } 
    });
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
      const totalStrategies = this.getTotalStrategiesCount();
      const accessCheck = await this.planLimitationsGuard.checkStrategyCreationWithModal(this.user.id, totalStrategies);
      
      this.isAddStrategyDisabled = !accessCheck.canCreate;
      
      // El banner se actualiza automáticamente en checkPlanLimitations()
    } catch (error) {
      console.error('Error checking strategy limitations:', error);
      this.isAddStrategyDisabled = true;
    }
  }

  // ===== MÉTODOS PARA MÚLTIPLES ESTRATEGIAS =====


  // Cargar datos de las cards para todas las estrategias
  async loadStrategyCardsData() {
    this.strategyCardsData = [];
    
    for (const strategy of this.userStrategies) {
      try {
        const cardData = await this.getStrategyCardData(strategy);
        this.strategyCardsData.push(cardData);
      } catch (error) {
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

  // Generar nombre único para estrategia
  private generateUniqueStrategyName(baseName: string): string {
    // Obtener todas las estrategias existentes (activas e inactivas)
    const allStrategies = [
      ...(this.activeStrategy ? [this.activeStrategy] : []),
      ...this.userStrategies
    ];
    
    // Extraer solo los nombres
    const existingNames = allStrategies.map(strategy => strategy.name);
    
    // Si el nombre base no existe, usarlo tal como está
    if (!existingNames.includes(baseName)) {
      return baseName;
    }
    
    // Si el nombre base termina con "copy", agregar número secuencial
    if (baseName.toLowerCase().endsWith('copy')) {
      let counter = 1;
      let newName = `${baseName} ${counter}`;
      
      while (existingNames.includes(newName)) {
        counter++;
        newName = `${baseName} ${counter}`;
      }
      
      return newName;
    }
    
    // Si el nombre base no termina con "copy", agregar "copy" primero
    let copyName = `${baseName} copy`;
    
    if (!existingNames.includes(copyName)) {
      return copyName;
    }
    
    // Si "copy" ya existe, agregar número secuencial
    let counter = 1;
    let newName = `${baseName} copy ${counter}`;
    
    while (existingNames.includes(newName)) {
      counter++;
      newName = `${baseName} copy ${counter}`;
    }
    
    return newName;
  }



  // Crear estrategia genérica automáticamente (para estrategias adicionales)
  async createGenericStrategy() {
    if (!this.user?.id) return;

    try {
      // 1. Primero recargar las strategies para tener el estado actualizado
      await this.invalidateCacheAndReload();
      
      // 2. Generar nombre único para la estrategia genérica
      const genericName = this.generateUniqueStrategyName('Strategy');
      
      // 3. Verificar si ya hay una estrategia activa
      const hasActiveStrategy = this.activeStrategy !== null;
      
      // 4. Verificar si es la primera estrategia del usuario
      const totalStrategies = this.getTotalStrategiesCount();
      const isFirstStrategy = totalStrategies === 0;
      
      // 5. Crear configuración vacía con reglas por defecto (todas inactivas)
      const emptyStrategyConfig: StrategyState = {
        maxDailyTrades: {
          isActive: false,
          maxDailyTrades: 0,
          type: 'MAX DAILY TRADES' as any,
        },
        riskReward: {
          isActive: false,
          riskRewardRatio: '1:2',
          type: 'RISK REWARD RATIO' as any,
        },
        riskPerTrade: {
          isActive: false,
          review_type: 'MAX',
          number_type: 'PERCENTAGE',
          percentage_type: 'NULL',
          risk_ammount: 0,
          type: 'MAX RISK PER TRADE' as any,
          balance: 0,
          actualBalance: 0,
        },
        daysAllowed: {
          isActive: false,
          type: 'DAYS ALLOWED' as any,
          tradingDays: [],
        },
        hoursAllowed: {
          isActive: false,
          tradingOpenTime: '',
          tradingCloseTime: '',
          timezone: '',
          type: 'TRADING HOURS' as any,
        },
        assetsAllowed: {
          isActive: false,
          type: 'ASSETS ALLOWED' as any,
          assetsAllowed: [],
        },
      };

      // 6. Crear la nueva estrategia genérica
      // La primera estrategia siempre es activa, las adicionales siempre inactivas
      const strategyId = await this.strategySvc.createStrategyView(
        this.user.id,
        genericName,
        emptyStrategyConfig,
        isFirstStrategy ? true : false // Primera estrategia activa, el resto inactivas
      );

      // 7. Actualizar el estado del plan en tiempo real después de crear
      await this.checkPlanLimitations();
      
      // 8. Redirigir directamente a edit-strategy con la nueva estrategia
      this.router.navigate(['/edit-strategy'], { queryParams: { strategyId: strategyId } });
      
    } catch (error) {
      console.error('Error creating generic strategy:', error);
      alert('Error creating strategy. Please try again.');
    }
  }

  // Activar una estrategia
  async activateStrategy(strategyId: string) {
    if (!this.user?.id) return;

    try {
      // Mostrar loading completo durante la activación
      this.isProcessingStrategy = true;
      
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
      
      // Invalidar cache y recargar estrategias
      await this.invalidateCacheAndReload();
      
      // Recargar configuración con la nueva estrategia activa
      // Obtener balance desde la configuración actual
      const currentConfig = this.config;
      const balance = currentConfig?.riskPerTrade?.balance || 0;
      this.loadConfig(balance);
    } catch (error) {
      alert('Error activating strategy. Please try again.');
    } finally {
      // Ocultar loading al finalizar
      this.isProcessingStrategy = false;
    }
  }

  // Eliminar estrategia
  deleteStrategy(strategyId: string) {
    // Guardar el ID de la estrategia a eliminar y mostrar el popup de confirmación
    this.strategyToDeleteId = strategyId;
    this.showDeleteConfirmPopup = true;
  }

  // Confirmar eliminación de estrategia
  confirmDeleteStrategy = async () => {
    this.showDeleteConfirmPopup = false;
    
    try {
      // Mostrar loading completo durante la eliminación
      this.isProcessingStrategy = true;
      
      await this.strategySvc.deleteStrategyView(this.strategyToDeleteId);
      
      // Invalidar cache y recargar estrategias
      await this.invalidateCacheAndReload();
      
      // Actualizar el estado del plan en tiempo real después de eliminar
      await this.checkPlanLimitations();
      
      // Verificar si se debe reactivar el botón (para plan Pro que ya no está en el límite máximo)
      if (this.user?.id) {
        const limitations = await this.planLimitationsGuard.checkUserLimitations(this.user.id);
        const currentTotalStrategies = this.userStrategies.length + (this.activeStrategy ? 1 : 0);
        const isProPlan = limitations.planName.toLowerCase().includes('pro') && limitations.maxStrategies === 8;
        
        if (isProPlan && currentTotalStrategies < 8) {
          // Reactivar el botón si ya no está en el límite máximo
          this.isAddStrategyDisabled = false;
        }
      }
      
      // Si se eliminó la estrategia activa, cargar la primera disponible o estado inicial
      if (!this.activeStrategy) {
        if (this.userStrategies.length > 0) {
          await this.activateStrategy((this.userStrategies[0] as any).id);
        } else {
          this.config = initialStrategyState;
        }
      }
    } catch (error) {
      alert('Error deleting strategy. Please try again.');
    } finally {
      // Ocultar loading al finalizar
      this.isProcessingStrategy = false;
      this.strategyToDeleteId = '';
    }
  };

  // Cancelar eliminación de estrategia
  cancelDeleteStrategy = () => {
    this.showDeleteConfirmPopup = false;
    this.strategyToDeleteId = '';
  };

  // Actualizar nombre de estrategia
  async updateStrategyName(strategyId: string, newName: string) {
    if (!newName.trim()) {
      alert('Please enter a valid strategy name');
      return;
    }

    try {
      await this.strategySvc.updateStrategyView(strategyId, { name: newName.trim() });
      
      // Invalidar cache y recargar estrategias
      await this.invalidateCacheAndReload();
    } catch (error) {
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
      // Error silencioso
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
      // Mostrar loading completo durante la copia
      this.isProcessingStrategy = true;
      
      // Verificar límites del plan antes de duplicar
      const totalStrategies = this.getTotalStrategiesCount();
      const accessCheck = await this.planLimitationsGuard.checkStrategyCreationWithModal(this.user.id, totalStrategies);
      
      if (!accessCheck.canCreate) {
        // Verificar si es el plan Pro con 8 estrategias (límite máximo)
        const limitations = await this.planLimitationsGuard.checkUserLimitations(this.user.id);
        const isProPlanWithMaxStrategies = limitations.planName.toLowerCase().includes('pro') && 
                                          limitations.maxStrategies === 8 && 
                                          totalStrategies >= 8;
        
        if (isProPlanWithMaxStrategies) {
          // Para plan Pro con 8 estrategias: desactivar botón y mostrar mensaje
          this.isAddStrategyDisabled = true;
          alert('You have reached the maximum number of strategies (8) for your Pro plan.');
          return;
        } else {
          // Para otros planes: redirigir a la página de cuenta
          this.router.navigate(['/account'], { 
            queryParams: { tab: 'plan' } 
          });
          return;
        }
      }

      // Buscar en estrategias inactivas primero
      let strategy = this.userStrategies.find(s => (s as any).id === strategyId);
      
      // Si no se encuentra en inactivas, buscar en la estrategia activa
      if (!strategy && this.activeStrategy && (this.activeStrategy as any).id === strategyId) {
        strategy = this.activeStrategy;
      }
      
      if (!strategy) {
        console.error('Strategy not found');
        return;
      }

      // Determinar el nombre de la copia usando la lógica de nombres únicos
      const isActiveStrategy = this.activeStrategy && (this.activeStrategy as any).id === strategyId;
      const baseName = strategy.name;
      const newName = this.generateUniqueStrategyName(baseName);
      
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

      // Si es la estrategia activa, crear la copia como inactiva
      const newStrategyId = await this.strategySvc.createStrategyView(
        this.user.id,
        newName,
        strategyConfig,
        isActiveStrategy ? false : undefined // false = inactiva, undefined = mantener estado original
      );

      // Invalidar cache y recargar estrategias
      await this.invalidateCacheAndReload();
      
      // Actualizar el estado del plan en tiempo real después de copiar
      await this.checkPlanLimitations();
      
      // Verificar si se debe reactivar el botón (para plan Pro que ya no está en el límite máximo)
      if (this.user?.id) {
        const limitations = await this.planLimitationsGuard.checkUserLimitations(this.user.id);
        const currentTotalStrategies = this.userStrategies.length + (this.activeStrategy ? 1 : 0);
        const isProPlan = limitations.planName.toLowerCase().includes('pro') && limitations.maxStrategies === 8;
        
        if (isProPlan && currentTotalStrategies < 8) {
          // Reactivar el botón si ya no está en el límite máximo
          this.isAddStrategyDisabled = false;
        }
      }
      
    } catch (error) {
      alert('Error copying strategy. Please try again.');
    } finally {
      // Ocultar loading al finalizar
      this.isProcessingStrategy = false;
    }
  }

  // Navegar a trading accounts
  navigateToTradingAccounts() {
    this.router.navigate(['/trading-accounts']);
  }

  // Strategy guide modal methods
  private checkShowStrategyGuide(): void {
    const dontShowAgain = localStorage.getItem('strategy-guide-dont-show');
    if (!dontShowAgain) {
      this.showStrategyGuide = true;
    }
  }

  onCloseStrategyGuide(): void {
    this.showStrategyGuide = false;
  }

  onDontShowStrategyGuideAgain(): void {
    localStorage.setItem('strategy-guide-dont-show', 'true');
    this.showStrategyGuide = false;
  }

  async onEditStrategyFromGuide(): Promise<void> {
    // Cerrar el modal de guía
    this.showStrategyGuide = false;
    
    // Activar loading
    this.isCreatingStrategy = true;
    
    try {
      // Crear automáticamente la primera estrategia genérica
      await this.createGenericStrategy();
    } finally {
      // Desactivar loading
      this.isCreatingStrategy = false;
    }
  }
}
