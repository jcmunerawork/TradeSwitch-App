import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs/operators';
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
import { PlanLimitationsGuard } from '../../core/guards';
import { AppContextService } from '../../shared/context';
import { StrategyCacheService } from './services/strategy-cache.service';
import { BalanceCacheService } from './services/balance-cache.service';
import { AlertService } from '../../core/services';


/**
 * Main component for managing trading strategies.
 *
 * This component provides comprehensive strategy management functionality including:
 * - Creating, editing, activating, copying, and deleting strategies
 * - Displaying strategy cards with statistics
 * - Managing multiple strategies per user
 * - Plan limitation detection and enforcement
 * - Strategy guide modal for first-time users
 * - Caching strategies for performance
 * - Real-time balance updates for risk calculations
 *
 * Key Features:
 * - Multiple strategy support with active/inactive states
 * - Strategy caching for fast access
 * - Balance caching for risk calculations
 * - Plan limitation checks (max strategies per plan)
 * - Strategy guide for new users
 * - Search and filter strategies
 * - Strategy cards with win rate, active rules, and days active
 *
 * Data Flow:
 * 1. Component initializes and loads user data
 * 2. Loads all user accounts
 * 3. Loads all strategies (overview + configuration) into cache
 * 4. Sets up listeners for context data and report data
 * 5. Updates strategy cards with real-time data
 *
 * Relations:
 * - SettingsService: CRUD operations for strategies
 * - StrategyCacheService: Caching strategy data
 * - BalanceCacheService: Caching account balances
 * - PlanLimitationsGuard: Checking plan limitations
 * - AppContextService: Global state management
 * - ReportService: Fetching account balances
 * - Store (NgRx): Local state for strategy rules
 * - EditStrategyComponent: Editing strategy details
 * - StrategyCardComponent: Displaying strategy cards
 *
 * @component
 * @selector app-strategy
 * @standalone true
 */
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
    id: '', // Cambiar de '1' a '' para evitar confusión
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
  // Subscription para eventos de navegación
  private navigationSubscription: any = null;

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
    private balanceCacheService: BalanceCacheService,
    private alertService: AlertService
  ) {}

  async ngOnInit(): Promise<void> {
    this.initialLoading = true;
    
    try {
      // FLUJO SIMPLIFICADO: Una sola secuencia de inicialización
      await this.initializeEverything();
      
      // Suscribirse a eventos de navegación para recargar cuando se vuelve de editar
      this.setupNavigationListener();
    } catch (error) {
      console.error('Error during initialization:', error);
    } finally {
      this.initialLoading = false;
    }
  }

  /**
   * Configurar listener de navegación para recargar estrategias cuando se vuelve de editar
   */
  private setupNavigationListener(): void {
    // Cancelar suscripción anterior si existe
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
    }
    
    this.navigationSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // Si se navega a /strategy o / (home), verificar y recargar si es necesario
      if (event.url === '/strategy' || event.urlAfterRedirects === '/strategy' || event.url === '/' || event.urlAfterRedirects === '/') {
        // Pequeño delay para asegurar que el componente esté completamente inicializado
        setTimeout(() => {
          const cacheSize = this.strategyCacheService.getCacheSize();
          const hasStrategies = this.userStrategies && this.userStrategies.length > 0;
          const hasActiveStrategy = this.activeStrategy !== null;
          
          // Si no hay estrategias en la UI pero hay cuentas, recargar
          if (this.accountsData.length > 0 && (cacheSize === 0 || (!hasStrategies && !hasActiveStrategy))) {
            console.log('🔄 StrategyComponent: Cache vacío o sin estrategias detectado al navegar, recargando estrategias...');
            console.log(`   Cache size: ${cacheSize}, Has strategies: ${hasStrategies}, Has active: ${hasActiveStrategy}, Accounts: ${this.accountsData.length}`);
            this.invalidateCacheAndReload();
          }
        }, 300);
      }
    });
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
    // También detecta cambios para recargar estrategias si es necesario
    let previousAccountsCount = this.accountsData.length;
    this.appContext.userAccounts$.subscribe(accounts => {
      const currentAccountsCount = accounts?.length || 0;
      this.accountsData = accounts || [];
      
      // Si las cuentas cambiaron (por ejemplo, se borró una cuenta), verificar si hay estrategias
      if (previousAccountsCount !== currentAccountsCount && this.user?.id && currentAccountsCount >= 0) {
        console.log('🔄 StrategyComponent: Cambio en cuentas detectado, verificando estrategias...');
        console.log(`   Cuentas anteriores: ${previousAccountsCount}, Cuentas actuales: ${currentAccountsCount}`);
        
        // Si hay cuentas pero no hay estrategias en la UI, recargar
        const cacheSize = this.strategyCacheService.getCacheSize();
        const hasStrategies = this.userStrategies && this.userStrategies.length > 0;
        const hasActiveStrategy = this.activeStrategy !== null;
        
        if (currentAccountsCount > 0 && (cacheSize === 0 || (!hasStrategies && !hasActiveStrategy))) {
          console.log('🔄 StrategyComponent: Recargando estrategias después de cambio en cuentas...');
          console.log(`   Cache size: ${cacheSize}, Has strategies: ${hasStrategies}, Has active: ${hasActiveStrategy}`);
          
          // Recargar estrategias después de un pequeño delay para asegurar que el contexto se actualizó
          setTimeout(() => {
            this.invalidateCacheAndReload();
          }, 500);
        }
      }
      
      previousAccountsCount = currentAccountsCount;
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
        
        // Si no hay cuentas, deshabilitar creación de estrategias
        if (this.accountsData.length === 0) {
          this.isAddStrategyDisabled = true;
        } else {
          await this.checkPlanLimitations();
          this.fetchUserKey();
        }
      } catch (error) {
        console.error('Error loading accounts:', error);
        // En caso de error, deshabilitar si no hay cuentas
        if (this.accountsData.length === 0) {
          this.isAddStrategyDisabled = true;
        }
      }
    } else {
      // Si no hay usuario, deshabilitar
      this.isAddStrategyDisabled = true;
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
      // NO limpiar el cache aquí si ya tiene datos
      // Solo limpiar si realmente necesitamos forzar una recarga completa
      // El cache se mantiene para evitar recargas innecesarias
      const currentCacheSize = this.strategyCacheService.getCacheSize();
      if (currentCacheSize === 0) {
        console.log('📦 StrategyComponent: Cache vacío, cargando estrategias desde backend...');
      } else {
        console.log(`📦 StrategyComponent: Cache tiene ${currentCacheSize} estrategias, verificando si necesita actualización...`);
      }
      
      // 1. Obtener todas las estrategias (overviews)
      const allStrategies = await this.strategySvc.getUserStrategyViews(this.user.id);
      
      if (!allStrategies || allStrategies.length === 0) {
        this.userStrategies = [];
        this.activeStrategy = null;
        this.filteredStrategies = [];
        return;
      }

      // 2. Para cada estrategia, cargar su configuración completa
      // Limitar peticiones concurrentes para evitar rate limiting (429)
      const CONCURRENT_REQUESTS = 2; // Procesar máximo 2 estrategias a la vez (reducido para evitar 429)
      const strategiesWithConfigs: Array<{ overview: ConfigurationOverview; configuration: StrategyState } | null> = [];
      
      for (let i = 0; i < allStrategies.length; i += CONCURRENT_REQUESTS) {
        const batch = allStrategies.slice(i, i + CONCURRENT_REQUESTS);
        
        const batchResults = await Promise.all(
          batch.map(async (strategy) => {
            try {
              // Validar que la estrategia tenga un ID válido
              // El backend puede devolver el ID como 'id', '_id', o 'overviewId'
              const strategyId = (strategy as any).id || (strategy as any)._id || (strategy as any).overviewId;
              
              if (!strategyId) {
                console.error('❌ Strategy missing ID:', strategy);
                console.error('Strategy object:', JSON.stringify(strategy, null, 2));
                return null;
              }
              
              // Obtener la configuración completa
              const strategyData = await this.strategySvc.getStrategyView(strategyId);
              
              if (strategyData && strategyData.configuration) {
                // Asegurarse de que el overview tenga el ID asignado
                (strategyData.overview as any).id = strategyId;
                
                // Almacenar en cache usando el servicio
                this.strategyCacheService.setStrategy(
                  strategyId,
                  strategyData.overview,
                  strategyData.configuration
                );
                
                return {
                  overview: { ...strategyData.overview, id: strategyId } as any,
                  configuration: strategyData.configuration
                };
              } else {
                return null;
              }
            } catch (error: any) {
              // Manejar específicamente errores 429
              if (error?.status === 429) {
                console.warn(`⚠️ Rate limit (429) when loading strategy ${strategy.name}. Will retry later.`);
                // No mostrar alerta aquí porque el retry ya se maneja en strategy-operations.service
                // Solo retornar null para que esta estrategia se omita por ahora
                return null;
              }
              console.error(`❌ Error loading strategy ${strategy.name}:`, error);
              return null;
            }
          })
        );
        
        strategiesWithConfigs.push(...batchResults);
        
        // Pequeña pausa entre lotes para evitar rate limiting
        if (i + CONCURRENT_REQUESTS < allStrategies.length) {
          await new Promise(resolve => setTimeout(resolve, 300)); // 300ms entre lotes (aumentado para evitar 429)
        }
      }

      // 3. Filtrar estrategias válidas y separar activa de inactivas
      const validStrategies = strategiesWithConfigs.filter(s => s !== null);
      
      // Encontrar la estrategia activa - el ID ya debería estar asignado en el overview
      const activeStrategyData = validStrategies.find(s => s.overview.status === true);
      if (activeStrategyData) {
        this.activeStrategy = activeStrategyData.overview;
        const activeStrategyId = this.getStrategyIdSafe(this.activeStrategy);
        console.log('✅ Active strategy set with ID:', activeStrategyId || 'NOT FOUND');
        
        if (!activeStrategyId) {
          console.error('❌ Active strategy overview missing ID:', this.activeStrategy);
        }
      } else {
        this.activeStrategy = null;
      }
      
      this.userStrategies = validStrategies.filter(s => s.overview.status !== true).map(s => s.overview);
      this.filteredStrategies = [...this.userStrategies];

      // 4. Cargar datos de las cards
      await this.loadStrategyCardsData();
      
      // 5. Actualizar strategy card si hay estrategia activa
      if (this.activeStrategy) {
        await this.updateStrategyCardWithActiveStrategy();
      }

      // 6. Verificar limitaciones
      this.checkStrategyLimitations();

    } catch (error: any) {
      console.error('❌ Error loading strategies to cache:', error);
        
      // Manejar específicamente errores 429 (Too Many Requests)
      if (error?.status === 429) {
        this.alertService.showWarning(
          'Too many requests. Please wait a moment and try again.',
          'Rate Limit Exceeded'
        );
      }
      
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
    // Limpiar suscripción de navegación
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
      this.navigationSubscription = null;
    }
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
        const activeStrategyId = this.getStrategyIdSafe(this.activeStrategy);
        if (!activeStrategyId) {
          console.error('Active strategy missing ID');
          this.config = initialStrategyState;
          return;
        }
        const cachedStrategy = this.strategyCacheService.getStrategy(activeStrategyId);
        
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
          // El backend gestiona el accessToken automáticamente
          this.reportSvc.getBalanceData(account.accountID as string, account.accountNumber as number).subscribe({
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
    // Recargar cache desde el backend usando el servicio
    if (this.user?.id) {
      await this.strategySvc.reloadAllStrategiesToCache(this.user.id);
    }
    // Recargar la UI con los datos del cache
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
  // IMPORTANTE: Solo cuenta estrategias NO eliminadas (deleted !== true)
  // Las estrategias eliminadas (deleted: true) NO se incluyen en este conteo
  private getTotalStrategiesCount(): number {
    const uniqueIds = new Set<string>();
    this.userStrategies.forEach(s => {
      const id = this.getStrategyIdSafe(s);
      if (id) uniqueIds.add(id);
    });
    const activeStrategyId = this.getStrategyIdSafe(this.activeStrategy);
    if (activeStrategyId) uniqueIds.add(activeStrategyId);

    const total = uniqueIds.size;

    return total;
  }

  async onNewStrategy() {
    if (!this.user?.id || this.isCreatingStrategy) return;

    // Verificar si hay cuentas antes de crear estrategia
    if (this.accountsData.length === 0) {
      this.alertService.showWarning('You need to add a trading account before creating strategies.', 'No Trading Accounts');
      this.router.navigate(['/account'], { queryParams: { tab: 'accounts' } });
      return;
    }

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
  async onStrategyEdit(strategyId: string) {
    // Validar que el strategyId no sea el valor por defecto "1" o vacío
    // Si es "1" o vacío, obtener el ID de la estrategia activa
    if ((strategyId === '1' || !strategyId) && this.activeStrategy) {
      const activeStrategyId = this.getStrategyIdSafe(this.activeStrategy);
      if (activeStrategyId) {
        strategyId = activeStrategyId;
      } else {
        this.alertService.showWarning('No strategy found. Please create a strategy first.', 'No Strategy Found');
        return;
      }
    }
    
    // Validar que la estrategia existe antes de navegar
    if (!strategyId || strategyId === '1') {
      this.alertService.showWarning('No strategy found. Please create a strategy first.', 'No Strategy Found');
      return;
    }
    
    // Validar que la estrategia existe y tiene configuración
    const isValid = await this.validateStrategyExists(strategyId);
    if (!isValid) {
      return; // El error ya se mostró en validateStrategyExists
    }
    
    // Verificar si el usuario no ha marcado "don't show again"
    const dontShowAgain = localStorage.getItem('strategy-guide-dont-show');
    
    // Si no ha marcado "don't show again", mostrar el modal de guía
    if (!dontShowAgain) {
      this.showStrategyGuide = true;
      return;
    }
    
    // Si ya marcó "don't show again", navegar directamente a edit-strategy
    this.router.navigate(['/edit-strategy'], { queryParams: { strategyId: strategyId } });
  }

  onStrategyFavorite(strategyId: string) {
    // TODO: Implementar funcionalidad de favoritos en la base de datos
    // Por ahora solo actualizar el estado local
    const strategy = this.userStrategies.find(s => {
      const id = this.getStrategyIdSafe(s);
      return id === strategyId;
    });
    if (strategy) {
    }
  }

  onStrategyMoreOptions(strategyId: string) {
    // TODO: Implementar menú de opciones (copiar, eliminar, etc.)
    // Por ahora mostrar opciones básicas
    const strategy = this.userStrategies.find(s => {
      const id = this.getStrategyIdSafe(s);
      return id === strategyId;
    });
    if (strategy) {
      const action = confirm(`Options for "${strategy.name}":\n\nOK - Copy strategy\nCancel - Delete strategy`);
      if (action) {
        this.copyStrategy(strategyId);
      } else {
        this.deleteStrategy(strategyId);
      }
    }
  }

  async onStrategyCustomize(strategyId: string) {
    // Validar que el strategyId no sea el valor por defecto "1" o vacío
    // Si es "1" o vacío, obtener el ID de la estrategia activa
    if ((strategyId === '1' || !strategyId) && this.activeStrategy) {
      const activeStrategyId = this.getStrategyIdSafe(this.activeStrategy);
      if (activeStrategyId) {
        strategyId = activeStrategyId;
      } else {
        this.alertService.showWarning('No strategy found. Please create a strategy first.', 'No Strategy Found');
        return;
      }
    }
    
    // Validar que la estrategia existe antes de navegar
    if (!strategyId || strategyId === '1') {
      this.alertService.showWarning('No strategy found. Please create a strategy first.', 'No Strategy Found');
      return;
    }
    
    // Validar que la estrategia existe y tiene configuración
    const isValid = await this.validateStrategyExists(strategyId);
    if (!isValid) {
      return; // El error ya se mostró en validateStrategyExists
    }
    
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
      // Si no hay cuentas, deshabilitar creación de estrategias
      this.isAddStrategyDisabled = this.accountsData.length === 0;
      return;
    }
    
    // Si no hay cuentas, deshabilitar creación de estrategias
    if (this.accountsData.length === 0) {
      this.isAddStrategyDisabled = true;
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

    // Si no hay cuentas, deshabilitar creación de estrategias
    if (this.accountsData.length === 0) {
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
        const strategyId = this.getStrategyIdSafe(strategy);
        if (!strategyId) {
          console.error('Strategy missing ID in loadStrategyCardsData:', strategy);
          continue;
        }
        const cardData = await this.getStrategyCardData(strategy);
        this.strategyCardsData.push(cardData);
      } catch (error) {
        // Agregar datos básicos en caso de error
        const strategyId = this.getStrategyIdSafe(strategy);
        if (!strategyId) {
          console.error('Strategy missing ID in error handler:', strategy);
          continue;
        }
        this.strategyCardsData.push({
          id: strategyId,
          name: strategy.name,
          status: strategy.status,
          lastModified: this.formatDate(this.parseDate(strategy.updated_at)),
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
      // NOTA: getTotalStrategiesCount() solo cuenta estrategias NO eliminadas (deleted !== true)
      // Las estrategias eliminadas no cuentan para determinar si es la primera
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

      // 6.1. Si NO es la primera estrategia, agregar dateInactive inmediatamente
      // Esto evita problemas en los reports al tener estrategias con dateActive sin dateInactive
      if (!isFirstStrategy) {
        const inactiveTime = new Date(Date.now() + 2000); // +2 segundos desde ahora
        
        // Solo agregar dateInactive para cerrar el ciclo de activación/desactivación
        await this.strategySvc.updateStrategyDates(
          this.user.id,
          strategyId,
          undefined, // No agregar dateActive (ya existe uno)
          inactiveTime // Agregar dateInactive en 2 segundos
        );
      }

      // 7. Actualizar el estado del plan en tiempo real después de crear
      await this.checkPlanLimitations();
      
      // 8. Redirigir directamente a edit-strategy con la nueva estrategia
      this.router.navigate(['/edit-strategy'], { queryParams: { strategyId: strategyId } });
      
    } catch (error) {
      console.error('Error creating generic strategy:', error);
      this.alertService.showError('Error creating strategy. Please try again.', 'Strategy Creation Error');
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
      const activeStrategyId = this.getStrategyIdSafe(this.activeStrategy);
      if (this.activeStrategy && activeStrategyId && activeStrategyId !== strategyId) {
        // Hay una estrategia activa diferente, desactivarla primero
        await this.strategySvc.updateStrategyDates(
          this.user.id, 
          activeStrategyId, 
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
      console.error('Error activating strategy:', error);
      this.alertService.showError('Error activating strategy. Please try again.', 'Strategy Activation Error');
    } finally {
      // Ocultar loading al finalizar
      this.isProcessingStrategy = false;
    }
  }

  // Eliminar estrategia
  deleteStrategy(strategyId: string) {
    console.log('🔍 deleteStrategy called with strategyId:', strategyId);
    
    // Validar que el ID no esté vacío
    if (!strategyId || strategyId.trim() === '') {
      console.error('❌ deleteStrategy called with empty strategyId', {
        strategyId,
        strategyCard: this.strategyCard,
        activeStrategy: this.activeStrategy
      });
      this.alertService.showError('Cannot delete strategy: Invalid strategy ID.', 'Strategy Deletion Error');
      return;
    }

    console.log('✅ deleteStrategy: Valid ID received, setting strategyToDeleteId:', strategyId);
    // Guardar el ID de la estrategia a eliminar y mostrar el popup de confirmación
    this.strategyToDeleteId = strategyId;
    this.showDeleteConfirmPopup = true;
  }

  // Confirmar eliminación de estrategia (marcar como deleted)
  confirmDeleteStrategy = async () => {
    console.log('🔍 confirmDeleteStrategy called with strategyToDeleteId:', this.strategyToDeleteId);
    
    // Validar que tenemos un ID antes de proceder
    if (!this.strategyToDeleteId || this.strategyToDeleteId.trim() === '') {
      console.error('❌ No strategy ID to delete', {
        strategyToDeleteId: this.strategyToDeleteId,
        strategyCard: this.strategyCard,
        activeStrategy: this.activeStrategy
      });
      this.alertService.showError('No strategy selected for deletion.', 'Strategy Deletion Error');
      this.showDeleteConfirmPopup = false;
      return;
    }
    
    console.log('✅ confirmDeleteStrategy: Valid ID, proceeding with deletion:', this.strategyToDeleteId);

    this.showDeleteConfirmPopup = false;
    
    try {
      // Mostrar loading completo durante la eliminación
      this.isProcessingStrategy = true;
      
      // Marcar la estrategia como deleted en lugar de borrarla
      await this.strategySvc.markStrategyAsDeleted(this.strategyToDeleteId);
      
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
          const firstStrategyId = this.getStrategyIdSafe(this.userStrategies[0]);
          if (firstStrategyId) {
            await this.activateStrategy(firstStrategyId);
          }
        } else {
          this.config = initialStrategyState;
        }
      }
    } catch (error) {
      this.alertService.showError('Error marking strategy as deleted. Please try again.', 'Strategy Deletion Error');
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
      this.alertService.showWarning('Please enter a valid strategy name', 'Invalid Strategy Name');
      return;
    }

    try {
      await this.strategySvc.updateStrategyView(strategyId, { name: newName.trim() });
      
      // Invalidar cache y recargar estrategias
      await this.invalidateCacheAndReload();
    } catch (error) {
      this.alertService.showError('Error updating strategy name. Please try again.', 'Strategy Name Update Error');
    }
  }

  // Actualizar strategy card con la estrategia activa
  async updateStrategyCardWithActiveStrategy() {
    if (!this.activeStrategy || !this.user?.id) {
      console.warn('⚠️ updateStrategyCardWithActiveStrategy: No activeStrategy or user');
      return;
    }

    try {
      // Validar que la estrategia activa tenga un ID válido
      let activeStrategyId = this.getStrategyIdSafe(this.activeStrategy);
      
      // Si no hay ID en activeStrategy, intentar obtenerlo desde localStorage
      if (!activeStrategyId) {
        console.warn('⚠️ Active strategy missing ID, trying to get from localStorage');
        activeStrategyId = this.getActiveStrategyIdFromLocalStorage();
        
        if (!activeStrategyId) {
          console.error('❌ Active strategy missing ID and not found in localStorage', {
            activeStrategy: this.activeStrategy,
            cacheKeys: this.strategyCacheService.getAllStrategies().keys()
          });
          return;
        }
        
        // Actualizar activeStrategy con el ID encontrado
        (this.activeStrategy as any).id = activeStrategyId;
        console.log('✅ Found ID from localStorage and updated activeStrategy:', activeStrategyId);
      }
      
      console.log('🔍 updateStrategyCardWithActiveStrategy: Using strategyId:', activeStrategyId);
      
      // Obtener la estrategia completa (configurations + configuration-overview)
      const strategyData = await this.strategySvc.getStrategyView(activeStrategyId);
      
      if (!strategyData) {
        console.error('❌ No strategy data found for active strategy ID:', activeStrategyId);
        return;
      }

      // Calcular win rate (por ahora 0, necesitamos implementar la lógica)
      const winRate = 0; // TODO: Implementar cálculo de win rate

      // Contar reglas activas de la configuración
      const activeRules = strategyData.configuration ? this.countActiveRules(strategyData.configuration) : 0;
      
      // Formatear fecha de actualización
      const lastModified = this.formatDate(this.parseDate(strategyData.overview.updated_at));

      this.strategyCard = {
        id: activeStrategyId,
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
      
      console.log('✅ updateStrategyCardWithActiveStrategy: strategyCard updated with ID:', this.strategyCard.id);
    } catch (error) {
      console.error('❌ Error in updateStrategyCardWithActiveStrategy:', error);
    }
  }

  /**
   * Obtener el ID de la estrategia activa desde localStorage
   */
  private getActiveStrategyIdFromLocalStorage(): string | null {
    try {
      const allStrategies = this.strategyCacheService.getAllStrategies();
      
      // Buscar la estrategia activa (status: true) en el cache
      for (const [id, data] of allStrategies.entries()) {
        if (data.overview.status === true) {
          console.log('✅ Found active strategy ID in localStorage:', id);
          return id;
        }
      }
      
      // Si no se encuentra en memoria, intentar desde localStorage directamente
      const stored = localStorage.getItem('tradeswitch_strategies_cache');
      if (stored) {
        const cacheArray = JSON.parse(stored) as Array<{
          id: string;
          overview: ConfigurationOverview;
          configuration: StrategyState;
        }>;
        
        const activeStrategy = cacheArray.find(item => item.overview.status === true);
        if (activeStrategy) {
          console.log('✅ Found active strategy ID in localStorage (direct):', activeStrategy.id);
          return activeStrategy.id;
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting active strategy ID from localStorage:', error);
      return null;
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

  /**
   * Parsear fecha desde diferentes formatos (Firebase Timestamp, objeto con seconds/nanoseconds, o string ISO)
   */
  private parseDate(dateValue: any): Date {
    if (!dateValue) {
      return new Date();
    }
    
    // Si es un objeto Date, retornarlo directamente
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    // Si tiene método toDate() (Firebase Timestamp)
    if (typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    // Si es un objeto con seconds y nanoseconds (formato del backend)
    if (dateValue.seconds !== undefined) {
      return new Date(dateValue.seconds * 1000 + (dateValue.nanoseconds || 0) / 1000000);
    }
    
    // Si es una string ISO
    if (typeof dateValue === 'string') {
      return new Date(dateValue);
    }
    
    // Si es un número (timestamp)
    if (typeof dateValue === 'number') {
      return new Date(dateValue);
    }
    
    // Fallback: fecha actual
    console.warn('Unknown date format:', dateValue);
    return new Date();
  }




  // Obtener ID de la estrategia para el track
  getStrategyId(strategy: ConfigurationOverview): string {
    const id = this.getStrategyIdSafe(strategy);
    if (!id) {
      console.error('Strategy ID is missing in getStrategyId:', strategy);
      // Retornar string vacío en lugar de lanzar error para evitar romper el template
      return '';
    }
    return id;
  }

  /**
   * Helper method para obtener el ID de una estrategia de forma segura
   * Verifica múltiples campos posibles: id, _id, overviewId, overview_id
   */
  private getStrategyIdSafe(strategy: ConfigurationOverview | null | undefined): string | null {
    if (!strategy) return null;
    const strategyAny = strategy as any;
    return strategyAny.id || strategyAny._id || strategyAny.overviewId || strategyAny.overview_id || null;
  }

  /**
   * Validar que la estrategia existe y tiene configuración antes de navegar a edit-strategy
   * @param strategyId ID de la estrategia a validar
   * @returns true si la estrategia existe y tiene configuración, false en caso contrario
   */
  private async validateStrategyExists(strategyId: string): Promise<boolean> {
    try {
      // Intentar obtener la estrategia completa
      const strategyData = await this.strategySvc.getStrategyView(strategyId);
      
      if (!strategyData) {
        this.alertService.showError(
          'Strategy not found. The strategy may have been deleted or does not exist.',
          'Strategy Not Found'
        );
        return false;
      }
      
      if (!strategyData.overview) {
        this.alertService.showError(
          'Strategy overview not found. The strategy metadata is missing.',
          'Strategy Overview Missing'
        );
        return false;
      }
      
      if (!strategyData.configuration) {
        this.alertService.showError(
          'Strategy configuration not found. The strategy rules are missing.',
          'Strategy Configuration Missing'
        );
        return false;
      }
      
      return true;
    } catch (error: any) {
      console.error('Error validating strategy:', error);
      
      // Mostrar mensaje de error específico según el tipo de error
      if (error?.status === 404) {
        this.alertService.showError(
          'Strategy not found. The strategy may have been deleted or does not exist.',
          'Strategy Not Found'
        );
      } else {
        this.alertService.showError(
          'Error loading strategy. Please try again later.',
          'Error Loading Strategy'
        );
      }
      
      return false;
    }
  }

  // Convertir ConfigurationOverview a StrategyCardData
  async getStrategyCardData(strategy: ConfigurationOverview): Promise<StrategyCardData> {
    try {
      // Validar que la estrategia tenga un ID válido
      const strategyId = this.getStrategyIdSafe(strategy);
      if (!strategyId) {
        throw new Error('Strategy missing ID');
      }
      
      // Obtener la estrategia completa (configurations + configuration-overview)
      const strategyData = await this.strategySvc.getStrategyView(strategyId);
      
      if (!strategyData) {
        // Retornar datos básicos en caso de error
        return {
          id: strategyId,
          name: strategy.name,
          status: strategy.status,
          lastModified: this.formatDate(this.parseDate(strategy.updated_at)),
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
      const lastModified = this.formatDate(this.parseDate(strategyData.overview.updated_at));

      // Validar que strategyId no sea null (ya validado arriba, pero TypeScript necesita la aserción)
      if (!strategyId) {
        throw new Error('Strategy ID is null');
      }

      const cardData: StrategyCardData = {
        id: strategyId,
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
      const strategyId = this.getStrategyIdSafe(strategy);
      if (!strategyId) {
        throw new Error('Strategy missing ID');
      }
      return {
        id: strategyId,
        name: strategy.name,
        status: strategy.status,
        lastModified: this.formatDate(this.parseDate(strategy.updated_at)),
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
          this.alertService.showWarning('You have reached the maximum number of strategies (8) for your Pro plan.', 'Strategy Limit Reached');
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
      let strategy = this.userStrategies.find(s => {
        const id = this.getStrategyIdSafe(s);
        return id === strategyId;
      });
      
      // Si no se encuentra en inactivas, buscar en la estrategia activa
      if (!strategy && this.activeStrategy) {
        const activeStrategyId = this.getStrategyIdSafe(this.activeStrategy);
        if (activeStrategyId === strategyId) {
          strategy = this.activeStrategy;
        }
      }
      
      if (!strategy) {
        console.error('Strategy not found');
        return;
      }

      // Determinar el nombre de la copia usando la lógica de nombres únicos
      const activeStrategyId = this.getStrategyIdSafe(this.activeStrategy);
      const isActiveStrategy = this.activeStrategy && activeStrategyId === strategyId;
      const baseName = strategy.name;
      const newName = this.generateUniqueStrategyName(baseName);
      
      // Obtener la estrategia completa (configuration-overview + configurations)
      const strategyToCopyId = this.getStrategyIdSafe(strategy);
      if (!strategyToCopyId) {
        console.error('Strategy to copy missing ID');
        return;
      }
      const strategyData = await this.strategySvc.getStrategyView(strategyToCopyId);
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

      // Si se está copiando una estrategia activa (isActiveStrategy = true), 
      // agregar dateInactive inmediatamente para cerrar el ciclo de activación
      if (isActiveStrategy) {
        const inactiveTime = new Date(Date.now() + 2000); // +2 segundos desde ahora
        
        // Solo agregar dateInactive para cerrar el ciclo de activación/desactivación
        await this.strategySvc.updateStrategyDates(
          this.user.id,
          newStrategyId,
          undefined, // No agregar dateActive (ya existe uno)
          inactiveTime // Agregar dateInactive en 2 segundos
        );
      }

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
      this.alertService.showError('Error copying strategy. Please try again.', 'Strategy Copy Error');
    } finally {
      // Ocultar loading al finalizar
      this.isProcessingStrategy = false;
    }
  }

  // Navegar a trading accounts
  navigateToTradingAccounts() {
    const accountsCount = this.accountsData?.length || 0;
    if (accountsCount >= 8) {
      return; // botón ya estará deshabilitado; no hacer nada
    }
    // Redirigir a Plan Management en Account
    this.router.navigate(['/account'], { queryParams: { tab: 'plan' } });
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
