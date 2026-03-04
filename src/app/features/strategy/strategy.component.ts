import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { User } from '../overview/models/overview';
import { SettingsService } from './service/strategy.service';
import { ConfigurationOverview } from './models/strategy.model';
import { StrategyCardComponent, StrategyCardData, StrategyGuideModalComponent, LoadingSpinnerComponent, PlanBannerComponent } from '../../shared/components';
import { StrategyFiltersComponent } from './components/strategy-filters/strategy-filters.component';
import { StrategyListComponent } from './components/strategy-list/strategy-list.component';
import { ConfirmPopupComponent } from '../../shared/pop-ups/confirm-pop-up/confirm-popup.component';
import { Store } from '@ngrx/store';
import { ReportService } from '../report/service/report.service';
import { AuthService } from '../auth/service/authService';
import { initialStrategyState } from '../strategy/store/strategy.reducer';
import { StrategyState } from '../strategy/models/strategy.model';
import { AccountData } from '../auth/models/userModel';
import { setUserKey } from '../report/store/report.actions';
import { GlobalStrategyUpdaterService } from '../../shared/services/global-strategy-updater.service';
import { PlanLimitationsGuard } from '../../core/guards';
import { AppContextService } from '../../shared/context';
import { StrategyCacheService } from './services/strategy-cache.service';
import { StrategyFilterService } from './services/strategy-filter.service';
import { StrategyLoadService } from './services/strategy-load.service';
import { StrategyPlanLimitationsService } from './services/strategy-plan-limitations.service';
import { StrategyCardsDataService } from './services/strategy-cards-data.service';
import { StrategyValidationService } from './services/strategy-validation.service';
import { StrategyActionsService } from './services/strategy-actions.service';
import { StrategyNavigationService } from './services/strategy-navigation.service';
import { StrategyContextBridgeService, StrategyContextBridgeHandlers } from './services/strategy-context-bridge.service';
import { StrategyCountService } from './services/strategy-count.service';
import { StrategyConfigService } from './services/strategy-config.service';
import { StrategyReportBridgeService } from './services/strategy-report-bridge.service';
import { StrategyNewStrategyFlowService } from './services/strategy-new-strategy-flow.service';
import { StrategyPageInitService } from './services/strategy-page-init.service';

import { AlertService } from '../../core/services';
import { ToastNotificationService } from '../../shared/services/toast-notification.service';


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
    StrategyFiltersComponent,
    StrategyListComponent,
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

  // Plan detection and banner (estado sincronizado desde StrategyPlanLimitationsService)
  accountsData: AccountData[] = [];
  showPlanBanner = false;
  planBannerMessage = '';
  planBannerType = 'info';
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
  strategyCardsData: StrategyCardData[] = [];
  
  // Sync status text for UI display
  syncStatusText: string = '';
  /** List filtered by search (from StrategyFilterService). */
  get filteredStrategies$() { return this.strategyFilterService.filteredStrategies$; }
  /** Search term (from StrategyFilterService). */
  get searchTerm$() { return this.strategyFilterService.searchTerm; }

  // Estado para controlar qué dropdown de reglas está abierto
  openRulesDropdown: { [strategyId: string]: boolean } = {};



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

  private navigationSubscription: Subscription | null = null;
  private contextSubscriptions: Subscription[] = [];

  private allowsMultipleStrategies = false;

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
    private strategyFilterService: StrategyFilterService,
    private strategyLoadService: StrategyLoadService,
    private planLimitationsService: StrategyPlanLimitationsService,
    private strategyCardsDataService: StrategyCardsDataService,
    private strategyValidationService: StrategyValidationService,
    private strategyActionsService: StrategyActionsService,
    private strategyNavigationService: StrategyNavigationService,
    private contextBridge: StrategyContextBridgeService,
    private strategyCountService: StrategyCountService,
    private strategyConfigService: StrategyConfigService,
    private reportBridge: StrategyReportBridgeService,
    private newStrategyFlowService: StrategyNewStrategyFlowService,
    private pageInitService: StrategyPageInitService,
    private alertService: AlertService,
    private toastService: ToastNotificationService
  ) { }

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

  private setupNavigationListener(): void {
    if (this.navigationSubscription) this.navigationSubscription.unsubscribe();
    this.navigationSubscription = this.strategyNavigationService.register({
      invalidateAndReload: () => this.invalidateCacheAndReload(),
      loadFromCache: () => this.loadAllStrategiesToCache(),
      getCacheSize: () => this.strategyCacheService.getCacheSize(),
      getCacheTimestamp: () => this.strategyCacheService.getCacheTimestamp(),
      getAccountsLength: () => this.accountsData.length,
      hasStrategiesInUI: () => (this.userStrategies?.length ?? 0) > 0,
      hasActiveStrategy: () => this.activeStrategy != null,
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

  private subscribeToContextData(): void {
    const handlers: StrategyContextBridgeHandlers = {
      setUser: u => this.user = u,
      setAccounts: a => this.accountsData = a ?? [],
      setUserStrategies: s => { this.userStrategies = s; this.updateStrategyCard(); },
      setLoading: l => this.loading = l?.strategies ?? false,
      onErrors: () => {},
      onPlanChange: () => this.checkPlanLimitations(),
      getActiveStrategyId: () => this.activeStrategy?.id ?? null,
      getCurrentUserStrategiesLength: () => this.userStrategies?.length ?? 0,
      onAccountsCountChange: (newCount) => {
        if (newCount > 0 && (this.strategyCacheService.getCacheSize() === 0 ||
            (!this.userStrategies?.length && !this.activeStrategy))) {
          setTimeout(() => this.invalidateCacheAndReload(), 500);
        }
      },
    };
    const subs = this.contextBridge.subscribe(handlers);
    this.contextSubscriptions.push(...subs);
  }

  private async initializeUserData(): Promise<void> {
    const { user } = await this.pageInitService.loadUser();
    this.user = user;
  }

  private async initializeAccounts(): Promise<void> {
    this.accountsData = await this.pageInitService.loadAccounts(this.user?.id ?? null);
    if (this.accountsData.length === 0) this.isAddStrategyDisabled = true;
    else {
      await this.checkPlanLimitations();
      this.fetchUserKey();
    }
    if (!this.user?.id) this.isAddStrategyDisabled = true;
  }

  /** Carga estrategias al cache (servicio) y actualiza cards + limitaciones en el componente. */
  private async loadAllStrategiesToCache(): Promise<void> {
    if (!this.user?.id) return;
    const startTime = Date.now();
    try {
      const result = await this.strategyLoadService.loadAllStrategiesToCache(this.user.id);
      this.userStrategies = result.userStrategies;
      this.activeStrategy = result.activeStrategy;
      await this.loadStrategyCardsData();
      if (this.activeStrategy) await this.updateStrategyCardWithActiveStrategy();
      await this.checkPlanLimitationsWithButtonState(result.button_state);
      
      const responseTime = Date.now() - startTime;
      this.syncStatusText = `Synced from Firebase in ${this.toastService.formatResponseTime(responseTime)}`;
    } catch (error) {
      console.error('Error loading strategies:', error);
      this.syncStatusText = 'Error loading strategies';
      this.toastService.showError('Failed to load strategies');
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

  private setupListeners(): void {
    this.subscribeToContextData();
    this.contextSubscriptions.push(
      this.reportBridge.subscribe(({ tradeWin, totalTrades, netPnL }) => {
        this.tradeWin = tradeWin;
        this.totalTrades = totalTrades;
        this.netPnL = netPnL;
        this.updateStrategyCard();
      })
    );
    if (this.user?.id) this.globalStrategyUpdater.updateAllStrategies(this.user.id);
  }

  ngOnDestroy(): void {
    this.contextSubscriptions.forEach(sub => sub.unsubscribe());
    this.contextSubscriptions = [];
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
      this.store.dispatch(setUserKey({ userKey: '' }));
    }
  }

  getActualBalance() {
    // Simplificado: cargar configuración con balance 0 inicialmente
    // El balance real se actualizará cuando el usuario interactúe o se cargue el reporte
    this.loadConfig(0);
  }

  async loadConfig(balance: number): Promise<void> {
    this.loading = true;
    try {
      this.config = this.strategyConfigService.loadConfig(balance, this.activeStrategy);
      await this.checkPlanLimitations();
    } catch (error) {
      console.error('Error loading config:', error);
      this.config = initialStrategyState;
    } finally {
      this.loading = false;
    }
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

  onSearchChange(value: string) {
    this.strategyFilterService.setSearchTerm(value);
  }

  onClearSearch(): void {
    this.strategyFilterService.clearSearch();
  }

  // Obtener datos de card por ID de estrategia
  getCardDataByStrategyId(strategyId: string): StrategyCardData | undefined {
    return this.strategyCardsData.find(card => card.id === strategyId);
  }

  private getTotalStrategiesCount(): Promise<number> {
    return this.strategyCountService.getTotalStrategiesCount(
      this.user?.id ?? null,
      this.userStrategies,
      this.activeStrategy
    );
  }

  async onNewStrategy(): Promise<void> {
    if (!this.user?.id || this.isCreatingStrategy) return;
    this.isCreatingStrategy = true;
    try {
      const result = await this.newStrategyFlowService.run({
        userId: this.user.id,
        accountsLength: this.accountsData.length,
        getTotalStrategiesCount: () => this.getTotalStrategiesCount(),
        showStrategyGuide: () => { this.showStrategyGuide = true; },
        createGenericStrategy: () => this.createGenericStrategy(),
        button_state: this.strategySvc.getCreateStrategyButtonState(),
      });
      if (result === 'max_reached') { /* botón deshabilitado, no hacer nada */ }
    } finally {
      this.isCreatingStrategy = false;
    }
  }

  // Strategy Card Event Handlers
  async onStrategyEdit(strategyId: string) {
    const resolvedId = await this.strategyValidationService.validateAndResolveStrategyId(
      strategyId,
      this.activeStrategy,
      this.getStrategyId.bind(this)
    );
    if (!resolvedId) return;

    // Verificar si el usuario no ha marcado "don't show again"
    const dontShowAgain = localStorage.getItem('strategy-guide-dont-show');

    // Si no ha marcado "don't show again", mostrar el modal de guía
    if (!dontShowAgain) {
      this.showStrategyGuide = true;
      return;
    }

    this.router.navigate(['/edit-strategy'], { queryParams: { strategyId: resolvedId } });
  }

  onStrategyFavorite(strategyId: string) {
    // TODO: Implementar funcionalidad de favoritos en la base de datos
    // Por ahora solo actualizar el estado local
    const strategy = this.userStrategies.find(s => {
      const id = this.getStrategyId(s);
      return id === strategyId;
    });
    if (strategy) {
    }
  }

  onStrategyMoreOptions(strategyId: string) {
    // TODO: Implementar menú de opciones (copiar, eliminar, etc.)
    // Por ahora mostrar opciones básicas
    const strategy = this.userStrategies.find(s => {
      const id = this.getStrategyId(s);
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
    const resolvedId = await this.strategyValidationService.validateAndResolveStrategyId(
      strategyId,
      this.activeStrategy,
      this.getStrategyId.bind(this)
    );
    if (!resolvedId) return;

    this.router.navigate(['/edit-strategy'], { queryParams: { strategyId: resolvedId } });
  }

  updateStrategyCard(): void {
    // Solo actualizar si hay una estrategia activa
    if (this.activeStrategy) {
      this.updateStrategyCardWithActiveStrategy();
    }
  }

  getActiveRuleNames(strategyId: string): string[] {
    return this.strategyCardsDataService.getActiveRuleNames(strategyId);
  }

  /**
   * Carga la configuración de una estrategia y la guarda en cache
   */
  async loadStrategyConfiguration(strategyId: string): Promise<void> {
    if (this.strategyCacheService.getStrategy(strategyId)?.configuration) {
      return; // Ya está en cache
    }

    try {
      // El servicio ya se encarga de guardar en cache
      await this.strategySvc.getStrategyView(strategyId);
    } catch (error) {
      console.error(`Error loading strategy configuration for ${strategyId}:`, error);
    }
  }

  /**
   * Toggle del dropdown de reglas
   */
  toggleRulesDropdown(strategyId: string): void {
    this.openRulesDropdown[strategyId] = !this.openRulesDropdown[strategyId];

    // Si se abre el dropdown, cargar la configuración si no está en cache
    if (this.openRulesDropdown[strategyId]) {
      this.loadStrategyConfiguration(strategyId);
    }
  }

  /**
   * Verifica si el dropdown de reglas está abierto
   */
  isRulesDropdownOpen(strategyId: string): boolean {
    return this.openRulesDropdown[strategyId] || false;
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
    return this.allowsMultipleStrategies;
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

  private async checkPlanLimitations(): Promise<void> {
    await this.planLimitationsService.refresh(
      this.user?.id ?? null,
      this.accountsData.length,
      () => this.getTotalStrategiesCount()
    );
    this.syncPlanLimitationsFromService();
  }

  private async checkPlanLimitationsWithButtonState(button_state: 'available' | 'plan_reached' | 'block'): Promise<void> {
    await this.planLimitationsService.refresh(
      this.user?.id ?? null,
      this.accountsData.length,
      () => this.getTotalStrategiesCount(),
      button_state
    );
    this.syncPlanLimitationsFromService();
  }

  private syncPlanLimitationsFromService(): void {
    const s = this.planLimitationsService.getState();
    this.showPlanBanner = s.showPlanBanner;
    this.planBannerMessage = s.planBannerMessage;
    this.planBannerType = s.planBannerType;
    this.isAddStrategyDisabled = s.isAddStrategyDisabled;
    this.allowsMultipleStrategies = s.allowsMultipleStrategies;
  }

  onUpgradePlan() {
    this.router.navigate(['/account'], {
      queryParams: { tab: 'plan' }
    });
  }

  onCloseBanner() {
    this.showPlanBanner = false;
  }


  async checkStrategyLimitations(): Promise<void> {
    await this.planLimitationsService.refreshButtonOnly(
      this.user?.id ?? null,
      this.accountsData.length,
      () => this.getTotalStrategiesCount()
    );
    this.isAddStrategyDisabled = this.planLimitationsService.isAddStrategyDisabled;
  }

  // ===== MÉTODOS PARA MÚLTIPLES ESTRATEGIAS =====


  async loadStrategyCardsData(): Promise<void> {
    this.strategyCardsData = await this.strategyCardsDataService.loadStrategyCardsData(this.userStrategies);
  }

  // Crear estrategia genérica automáticamente (para estrategias adicionales)
  async createGenericStrategy() {
    if (!this.user?.id) return;

    try {
      // 1. Primero recargar las strategies para tener el estado actualizado
      await this.invalidateCacheAndReload();

      // Preparar lista de todas las estrategias para verificar nombres y estado
      const allStrategies = [
        ...(this.activeStrategy ? [this.activeStrategy] : []),
        ...this.userStrategies
      ];

      // 2. Delegar la creación al servicio
      const strategyId = await this.strategySvc.createGenericStrategy(this.user.id, allStrategies);

      // 3. Invalidar cache y recargar estrategias para tener el estado actualizado
      await this.invalidateCacheAndReload();

      // 4. Actualizar el estado del plan en tiempo real después de crear
      await this.checkPlanLimitations();

      // 5. Redirigir directamente a edit-strategy con la nueva estrategia
      this.router.navigate(['/edit-strategy'], { queryParams: { strategyId: strategyId } });

    } catch (error) {
      console.error('Error creating generic strategy:', error);
      this.toastService.showBackendError(error, 'Error creating strategy');
    }
  }

  // Activar una estrategia (usa endpoint transaccional en backend)
  async activateStrategy(strategyId: string) {
    if (!this.user?.id) return;

    try {
      this.isProcessingStrategy = true;
      await this.strategyActionsService.activateStrategy(this.user.id, strategyId);
      await this.invalidateCacheAndReload();
      const balance = this.config?.riskPerTrade?.balance || 0;
      this.loadConfig(balance);
    } catch (error) {
      console.error('Error activating strategy:', error);
      this.toastService.showBackendError(error, 'Error activating strategy');
    } finally {
      this.isProcessingStrategy = false;
    }
  }

  // Eliminar estrategia
  deleteStrategy(strategyId: string) {
    // Validar que el ID no esté vacío
    if (!strategyId || strategyId.trim() === '') {
      console.error('❌ deleteStrategy called with empty strategyId', {
        strategyId,
        strategyCard: this.strategyCard,
        activeStrategy: this.activeStrategy
      });
      this.toastService.showError('Cannot delete strategy: Invalid strategy ID');
      return;
    }

    // Guardar el ID de la estrategia a eliminar y mostrar el popup de confirmación
    this.strategyToDeleteId = strategyId;
    this.showDeleteConfirmPopup = true;
  }

  // Confirmar eliminación de estrategia (marcar como deleted)
  confirmDeleteStrategy = async () => {
    if (!this.strategyToDeleteId || this.strategyToDeleteId.trim() === '') {
      console.error('❌ No strategy ID to delete', { strategyToDeleteId: this.strategyToDeleteId });
      this.toastService.showError('No strategy selected for deletion');
      this.showDeleteConfirmPopup = false;
      return;
    }

    const idToDelete = this.strategyToDeleteId;
    this.showDeleteConfirmPopup = false;
    this.strategyToDeleteId = '';

    try {
      this.isProcessingStrategy = true;
      await this.strategyActionsService.markStrategyAsDeleted(idToDelete);
      await this.invalidateCacheAndReload();

      await this.checkPlanLimitations();

      // Si se eliminó la estrategia activa, cargar la primera disponible o estado inicial
      if (!this.activeStrategy) {
        if (this.userStrategies.length > 0) {
          const firstStrategyId = (this.userStrategies[0].id || '');
          if (firstStrategyId) {
            await this.activateStrategy(firstStrategyId);
          }
        } else {
          this.config = initialStrategyState;
        }
      }
    } catch (error) {
      this.toastService.showBackendError(error, 'Error deleting strategy');
    } finally {
      this.isProcessingStrategy = false;
    }
  };

  // Cancelar eliminación de estrategia
  cancelDeleteStrategy = () => {
    this.showDeleteConfirmPopup = false;
    this.strategyToDeleteId = '';
  };

  // Actualizar nombre de estrategia
  async updateStrategyName(strategyId: string, newName: string) {
    try {
      await this.strategyActionsService.updateStrategyName(strategyId, newName);
      await this.loadAllStrategiesToCache();
    } catch (error) {
      this.toastService.showBackendError(error, 'Error updating strategy name');
    }
  }

  async updateStrategyCardWithActiveStrategy(): Promise<void> {
    if (!this.activeStrategy || !this.user?.id) return;
    if (!this.activeStrategy.id) {
      const id = this.strategyCardsDataService.getActiveStrategyIdFromCache();
      if (!id) return;
      (this.activeStrategy as any).id = id;
    }
    const card = await this.strategyCardsDataService.loadActiveStrategyCard(this.activeStrategy, this.strategyCard);
    if (card) this.strategyCard = card;
  }

  formatDate(date: Date): string {
    return this.strategyCardsDataService.formatDate(date);
  }

  getStrategyId(strategy: ConfigurationOverview): string {
    return strategy.id || '';
  }

  // Copiar estrategia (lógica en StrategyActionsService)
  async copyStrategy(strategyId: string) {
    if (!this.user?.id) return;

    try {
      this.isProcessingStrategy = true;
      const result = await this.strategyActionsService.copyStrategy(
        this.user.id,
        strategyId,
        this.userStrategies,
        this.activeStrategy,
        () => this.getTotalStrategiesCount(),
        (disabled) => { this.isAddStrategyDisabled = disabled; }
      );

      if (result === 'success') {
        await this.invalidateCacheAndReload();
        await this.checkPlanLimitations();
      }
    } catch (error) {
      this.alertService.showError('Error copying strategy. Please try again.', 'Strategy Copy Error');
    } finally {
      this.isProcessingStrategy = false;
    }
  }

  // Navegar a la página de trading accounts para añadir una cuenta
  navigateToTradingAccounts() {
    const accountsCount = this.accountsData?.length || 0;
    if (accountsCount >= 8) {
      return; // botón ya estará deshabilitado; no hacer nada
    }
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
