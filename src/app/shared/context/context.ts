import { Injectable, signal, computed, effect } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map, distinctUntilChanged } from 'rxjs';
import { User } from '../../features/overview/models/overview';
import { AccountData } from '../../features/auth/models/userModel';
import { ConfigurationOverview } from '../../features/strategy/models/strategy.model';
import { BalanceData } from '../../features/report/models/report.model';
import { Plan } from '../services/planService';

// Interfaces para datos de API externa
export interface TradeLockerAccountData {
  accountId: string;
  balance: BalanceData;
  lastUpdated: number;
  isValid: boolean;
}

export interface PluginHistoryData {
  id: string;
  userId: string;
  action: string;
  timestamp: number;
  details: any;
}

export interface UserPlanData {
  planId: string;
  planName: string;
  maxAccounts: number;
  maxStrategies: number;
  features: string[];
  isActive: boolean;
  expiresAt?: number;
}

export interface AppContextState {
  // Usuario autenticado
  currentUser: User | null;
  isAuthenticated: boolean;
  
  // Datos del usuario
  userAccounts: AccountData[];
  userStrategies: ConfigurationOverview[];
  userPlan: UserPlanData | null;
  pluginHistory: PluginHistoryData[];
  
  // Planes globales (cargados una vez al login)
  globalPlans: Plan[];
  planLimits: { [planName: string]: { tradingAccounts: number; strategies: number } };
  
  // Datos de reportes
  reportData: {
    accountHistory: any[];
    stats: any;
    balanceData: any;
    monthlyReports: any[];
  };
  
  // Datos de overview (para admins)
  overviewData: {
    allUsers: User[];
    subscriptions: any[];
    monthlyReports: any[];
    allAccounts: AccountData[];
    allStrategies: ConfigurationOverview[];
  };
  
  // Datos de API externa (con caché)
  tradeLockerData: Map<string, TradeLockerAccountData>;
  apiCache: Map<string, { data: any; timestamp: number; ttl: number }>;
  
  // Estados de carga
  isLoading: {
    user: boolean;
    accounts: boolean;
    strategies: boolean;
    plan: boolean;
    pluginHistory: boolean;
    tradeLocker: boolean;
    report: boolean;
    overview: boolean;
    globalPlans: boolean;
  };
  
  // Estados de error
  errors: {
    user: string | null;
    accounts: string | null;
    strategies: string | null;
    plan: string | null;
    pluginHistory: string | null;
    tradeLocker: string | null;
    report: string | null;
    overview: string | null;
    globalPlans: string | null;
  };
  
  // Configuración de caché
  cacheConfig: {
    tradeLockerTtl: number; // 5 minutos
    apiTtl: number; // 10 minutos
    maxCacheSize: number; // 100 elementos
  };
}

@Injectable({
  providedIn: 'root'
})
export class AppContextService {
  // Estado inicial
  private initialState: AppContextState = {
    currentUser: null,
    isAuthenticated: false,
    userAccounts: [],
    userStrategies: [],
    userPlan: null,
    pluginHistory: [],
    globalPlans: [],
    planLimits: {},
    reportData: {
      accountHistory: [],
      stats: null,
      balanceData: null,
      monthlyReports: []
    },
    overviewData: {
      allUsers: [],
      subscriptions: [],
      monthlyReports: [],
      allAccounts: [],
      allStrategies: []
    },
    tradeLockerData: new Map(),
    apiCache: new Map(),
    isLoading: {
      user: false,
      accounts: false,
      strategies: false,
      plan: false,
      pluginHistory: false,
      tradeLocker: false,
      report: false,
      overview: false,
      globalPlans: false
    },
    errors: {
      user: null,
      accounts: null,
      strategies: null,
      plan: null,
      pluginHistory: null,
      tradeLocker: null,
      report: null,
      overview: null,
      globalPlans: null
    },
    cacheConfig: {
      tradeLockerTtl: 5 * 60 * 1000, // 5 minutos
      apiTtl: 10 * 60 * 1000, // 10 minutos
      maxCacheSize: 100
    }
  };

  // Estado reactivo principal
  private stateSubject = new BehaviorSubject<AppContextState>(this.initialState);
  public state$ = this.stateSubject.asObservable();

  // Signals para datos específicos (más eficientes para UI)
  public currentUser = signal<User | null>(null);
  public isAuthenticated = signal<boolean>(false);
  public userAccounts = signal<AccountData[]>([]);
  public userStrategies = signal<ConfigurationOverview[]>([]);
  public userPlan = signal<UserPlanData | null>(null);
  public pluginHistory = signal<PluginHistoryData[]>([]);
  
  // Signals para planes globales
  public globalPlans = signal<Plan[]>([]);
  public planLimits = signal<{ [planName: string]: { tradingAccounts: number; strategies: number } }>({});
  
  // Signals para datos de reportes
  public reportData = signal<{
    accountHistory: any[];
    stats: any;
    balanceData: any;
    monthlyReports: any[];
  }>({
    accountHistory: [],
    stats: null,
    balanceData: null,
    monthlyReports: []
  });
  
  // Signals para datos de overview
  public overviewData = signal<{
    allUsers: User[];
    subscriptions: any[];
    monthlyReports: any[];
    allAccounts: AccountData[];
    allStrategies: ConfigurationOverview[];
  }>({
    allUsers: [],
    subscriptions: [],
    monthlyReports: [],
    allAccounts: [],
    allStrategies: []
  });

  // Computed signals para datos derivados
  public activeStrategies = computed(() => 
    this.userStrategies().filter(strategy => strategy.status === true)
  );

  public totalAccounts = computed(() => 
    this.userAccounts().length
  );

  public totalStrategies = computed(() => 
    this.userStrategies().length
  );

  public canCreateAccount = computed(() => {
    const plan = this.userPlan();
    const currentCount = this.totalAccounts();
    return plan ? currentCount < plan.maxAccounts : false;
  });

  public canCreateStrategy = computed(() => {
    const plan = this.userPlan();
    const currentCount = this.totalStrategies();
    return plan ? currentCount < plan.maxStrategies : false;
  });

  public planLimitations = computed(() => ({
    maxAccounts: this.userPlan()?.maxAccounts || 0,
    currentAccounts: this.totalAccounts(),
    maxStrategies: this.userPlan()?.maxStrategies || 0,
    currentStrategies: this.totalStrategies(),
    canCreateAccount: this.canCreateAccount(),
    canCreateStrategy: this.canCreateStrategy()
  }));

  // Computed signals para planes globales
  public orderedPlans = computed(() => {
    const plans = this.globalPlans();
    
    const orderedPlanNames = ['Free', 'Starter', 'Pro'];
    const orderedPlans: Plan[] = [];
    
    orderedPlanNames.forEach(planName => {
      const plan = plans.find(p => p.name.toLowerCase() === planName.toLowerCase());
      if (plan) {
        orderedPlans.push(plan);
      }
    });
    
    return orderedPlans;
  });

  // Observables específicos para suscripciones
  public currentUser$ = this.state$.pipe(
    map(state => state.currentUser),
    distinctUntilChanged()
  );

  public userAccounts$ = this.state$.pipe(
    map(state => state.userAccounts),
    distinctUntilChanged()
  );

  public userStrategies$ = this.state$.pipe(
    map(state => state.userStrategies),
    distinctUntilChanged()
  );

  public userPlan$ = this.state$.pipe(
    map(state => state.userPlan),
    distinctUntilChanged()
  );

  public pluginHistory$ = this.state$.pipe(
    map(state => state.pluginHistory),
    distinctUntilChanged()
  );

  public isLoading$ = this.state$.pipe(
    map(state => state.isLoading),
    distinctUntilChanged()
  );

  public errors$ = this.state$.pipe(
    map(state => state.errors),
    distinctUntilChanged()
  );

  public reportData$ = this.state$.pipe(
    map(state => state.reportData),
    distinctUntilChanged()
  );

  public overviewData$ = this.state$.pipe(
    map(state => state.overviewData),
    distinctUntilChanged()
  );

  public globalPlans$ = this.state$.pipe(
    map(state => state.globalPlans),
    distinctUntilChanged()
  );

  public planLimits$ = this.state$.pipe(
    map(state => state.planLimits),
    distinctUntilChanged()
  );

  constructor() {
    // Sincronizar signals con el estado principal
    effect(() => {
      this.updateState({
        currentUser: this.currentUser(),
        isAuthenticated: this.isAuthenticated(),
        userAccounts: this.userAccounts(),
        userStrategies: this.userStrategies(),
        userPlan: this.userPlan(),
        pluginHistory: this.pluginHistory(),
        globalPlans: this.globalPlans(),
        planLimits: this.planLimits(),
        reportData: this.reportData(),
        overviewData: this.overviewData()
      });
    });
  }

  // ===== MÉTODOS DE ACTUALIZACIÓN DE ESTADO =====

  private updateState(updates: Partial<AppContextState>): void {
    const currentState = this.stateSubject.value;
    const newState = { ...currentState, ...updates };
    this.stateSubject.next(newState);
  }

  // ===== MÉTODOS DE USUARIO =====

  setCurrentUser(user: User | null): void {
    this.currentUser.set(user);
    this.isAuthenticated.set(user !== null);
    
    if (user) {
      this.updateState({
        currentUser: user,
        isAuthenticated: true
      });
    } else {
      this.clearUserData();
    }
  }

  updateUserData(userData: Partial<User>): void {
    const currentUser = this.currentUser();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...userData };
      this.currentUser.set(updatedUser);
    }
  }

  clearUserData(): void {
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.userAccounts.set([]);
    this.userStrategies.set([]);
    this.userPlan.set(null);
    this.pluginHistory.set([]);
    // No limpiar globalPlans y planLimits ya que son globales
    
    this.updateState({
      currentUser: null,
      isAuthenticated: false,
      userAccounts: [],
      userStrategies: [],
      userPlan: null,
      pluginHistory: []
    });
  }

  // ===== MÉTODOS DE CUENTAS =====

  setUserAccounts(accounts: AccountData[]): void {
    this.userAccounts.set(accounts);
  }

  addAccount(account: AccountData): void {
    const currentAccounts = this.userAccounts();
    this.userAccounts.set([...currentAccounts, account]);
  }

  updateAccount(accountId: string, updates: Partial<AccountData>): void {
    const currentAccounts = this.userAccounts();
    const updatedAccounts = currentAccounts.map(account => 
      account.id === accountId ? { ...account, ...updates } : account
    );
    this.userAccounts.set(updatedAccounts);
  }

  removeAccount(accountId: string): void {
    const currentAccounts = this.userAccounts();
    const filteredAccounts = currentAccounts.filter(account => account.id !== accountId);
    this.userAccounts.set(filteredAccounts);
  }

  // ===== MÉTODOS DE ESTRATEGIAS =====

  setUserStrategies(strategies: ConfigurationOverview[]): void {
    this.userStrategies.set(strategies);
  }

  addStrategy(strategy: ConfigurationOverview & { id: string }): void {
    const currentStrategies = this.userStrategies();
    this.userStrategies.set([...currentStrategies, strategy]);
  }

  updateStrategy(strategyId: string, updates: Partial<ConfigurationOverview>): void {
    const currentStrategies = this.userStrategies();
    const updatedStrategies = currentStrategies.map(strategy => 
      (strategy as any).id === strategyId ? { ...strategy, ...updates } : strategy
    );
    this.userStrategies.set(updatedStrategies);
  }

  removeStrategy(strategyId: string): void {
    const currentStrategies = this.userStrategies();
    const filteredStrategies = currentStrategies.filter(strategy => (strategy as any).id !== strategyId);
    this.userStrategies.set(filteredStrategies);
  }

  activateStrategy(strategyId: string): void {
    const currentStrategies = this.userStrategies();
    const updatedStrategies = currentStrategies.map(strategy => ({
      ...strategy,
      status: (strategy as any).id === strategyId
    }));
    this.userStrategies.set(updatedStrategies);
  }

  // ===== MÉTODOS DE PLAN =====

  setUserPlan(plan: UserPlanData | null): void {
    this.userPlan.set(plan);
  }

  updateUserPlan(planUpdates: Partial<UserPlanData>): void {
    const currentPlan = this.userPlan();
    if (currentPlan) {
      const updatedPlan = { ...currentPlan, ...planUpdates };
      this.userPlan.set(updatedPlan);
    }
  }

  // ===== MÉTODOS DE PLANES GLOBALES =====

  setGlobalPlans(plans: Plan[]): void {
    this.globalPlans.set(plans);
    
    // Crear mapa de límites automáticamente
    const limits: { [planName: string]: { tradingAccounts: number; strategies: number } } = {};
    plans.forEach(plan => {
      // Usar el nombre original del plan como clave
      limits[plan.name] = {
        tradingAccounts: plan.tradingAccounts,
        strategies: plan.strategies
      };
    });
    this.planLimits.set(limits);
  }

  getPlanByName(planName: string): Plan | undefined {
    const plans = this.globalPlans();
    return plans.find(plan => plan.name.toLowerCase() === planName.toLowerCase());
  }

  getPlanById(planId: string): Plan | undefined {
    const plans = this.globalPlans();
    return plans.find(plan => plan.id === planId);
  }

  getPlanLimits(planName: string): { tradingAccounts: number; strategies: number } | null {
    const limits = this.planLimits();
    // Buscar por nombre exacto primero
    if (limits[planName]) {
      return limits[planName];
    }
    
    // Si no se encuentra, buscar case-insensitive
    const planKey = Object.keys(limits).find(key => 
      key.toLowerCase() === planName.toLowerCase()
    );
    
    return planKey ? limits[planKey] : null;
  }

  // ===== MÉTODOS DE HISTORIAL DE PLUGINS =====

  setPluginHistory(history: PluginHistoryData[]): void {
    this.pluginHistory.set(history);
  }

  addPluginHistoryEntry(entry: PluginHistoryData): void {
    const currentHistory = this.pluginHistory();
    this.pluginHistory.set([entry, ...currentHistory]);
  }

  // ===== MÉTODOS DE CACHÉ DE API =====

  setTradeLockerData(accountId: string, data: TradeLockerAccountData): void {
    const currentState = this.stateSubject.value;
    const newTradeLockerData = new Map(currentState.tradeLockerData);
    newTradeLockerData.set(accountId, data);
    
    this.updateState({
      tradeLockerData: newTradeLockerData
    });
  }

  getTradeLockerData(accountId: string): TradeLockerAccountData | null {
    const currentState = this.stateSubject.value;
    return currentState.tradeLockerData.get(accountId) || null;
  }

  isTradeLockerDataValid(accountId: string): boolean {
    const data = this.getTradeLockerData(accountId);
    if (!data) return false;
    
    const now = Date.now();
    const ttl = this.stateSubject.value.cacheConfig.tradeLockerTtl;
    return (now - data.lastUpdated) < ttl;
  }

  setApiCache(key: string, data: any, ttl?: number): void {
    const currentState = this.stateSubject.value;
    const newApiCache = new Map(currentState.apiCache);
    const cacheTtl = ttl || currentState.cacheConfig.apiTtl;
    
    newApiCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: cacheTtl
    });
    
    // Limpiar caché si excede el tamaño máximo
    if (newApiCache.size > currentState.cacheConfig.maxCacheSize) {
      const entries = Array.from(newApiCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Eliminar el 20% más antiguo
      const toRemove = Math.floor(entries.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        newApiCache.delete(entries[i][0]);
      }
    }
    
    this.updateState({
      apiCache: newApiCache
    });
  }

  getApiCache(key: string): any | null {
    const currentState = this.stateSubject.value;
    const cached = currentState.apiCache.get(key);
    
    if (!cached) return null;
    
    const now = Date.now();
    if ((now - cached.timestamp) > cached.ttl) {
      // Expirar caché
      const newApiCache = new Map(currentState.apiCache);
      newApiCache.delete(key);
      this.updateState({ apiCache: newApiCache });
      return null;
    }
    
    return cached.data;
  }

  clearApiCache(): void {
    this.updateState({
      tradeLockerData: new Map(),
      apiCache: new Map()
    });
  }

  // ===== MÉTODOS DE ESTADO DE CARGA =====

  setLoading(component: keyof AppContextState['isLoading'], loading: boolean): void {
    const currentState = this.stateSubject.value;
    this.updateState({
      isLoading: {
        ...currentState.isLoading,
        [component]: loading
      }
    });
  }

  setError(component: keyof AppContextState['errors'], error: string | null): void {
    const currentState = this.stateSubject.value;
    this.updateState({
      errors: {
        ...currentState.errors,
        [component]: error
      }
    });
  }

  clearErrors(): void {
    this.updateState({
      errors: {
        user: null,
        accounts: null,
        strategies: null,
        plan: null,
        pluginHistory: null,
        tradeLocker: null,
        report: null,
        overview: null,
        globalPlans: null
      }
    });
  }

  // ===== MÉTODOS DE UTILIDAD =====

  getCurrentState(): AppContextState {
    return this.stateSubject.value;
  }

  resetState(): void {
    this.stateSubject.next(this.initialState);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.userAccounts.set([]);
    this.userStrategies.set([]);
    this.userPlan.set(null);
    this.pluginHistory.set([]);
    this.globalPlans.set([]);
    this.planLimits.set({});
  }

  // ===== MÉTODOS DE VALIDACIÓN =====

  isDataStale(component: keyof AppContextState['isLoading'], maxAge: number = 5 * 60 * 1000): boolean {
    // Implementar lógica para verificar si los datos están obsoletos
    // Esto se puede usar para decidir si hacer nuevas peticiones
    return true; // Placeholder
  }

  // ===== MÉTODOS DE SUSCRIPCIÓN =====

  subscribeToUserChanges(): Observable<User | null> {
    return this.currentUser$;
  }

  subscribeToAccountsChanges(): Observable<AccountData[]> {
    return this.userAccounts$;
  }

  subscribeToStrategiesChanges(): Observable<ConfigurationOverview[]> {
    return this.userStrategies$;
  }

  subscribeToPlanChanges(): Observable<UserPlanData | null> {
    return this.userPlan$;
  }

  subscribeToPluginHistoryChanges(): Observable<PluginHistoryData[]> {
    return this.pluginHistory$;
  }

  subscribeToGlobalPlansChanges(): Observable<Plan[]> {
    return this.globalPlans$;
  }

  subscribeToPlanLimitsChanges(): Observable<{ [planName: string]: { tradingAccounts: number; strategies: number } }> {
    return this.planLimits$;
  }

  // ===== MÉTODOS DE DATOS DE REPORTES =====

  setReportData(data: {
    accountHistory?: any[];
    stats?: any;
    balanceData?: any;
    monthlyReports?: any[];
  }): void {
    const currentData = this.reportData();
    this.reportData.set({ ...currentData, ...data });
  }

  updateReportStats(stats: any): void {
    const currentData = this.reportData();
    this.reportData.set({ ...currentData, stats });
  }

  updateReportBalance(balanceData: any): void {
    const currentData = this.reportData();
    this.reportData.set({ ...currentData, balanceData });
  }

  updateReportHistory(accountHistory: any[]): void {
    const currentData = this.reportData();
    this.reportData.set({ ...currentData, accountHistory });
  }

  // ===== MÉTODOS DE DATOS DE OVERVIEW =====

  setOverviewData(data: {
    allUsers?: User[];
    subscriptions?: any[];
    monthlyReports?: any[];
    allAccounts?: AccountData[];
    allStrategies?: ConfigurationOverview[];
  }): void {
    const currentData = this.overviewData();
    this.overviewData.set({ ...currentData, ...data });
  }

  updateOverviewUsers(allUsers: User[]): void {
    const currentData = this.overviewData();
    this.overviewData.set({ ...currentData, allUsers });
  }

  updateOverviewSubscriptions(subscriptions: any[]): void {
    const currentData = this.overviewData();
    this.overviewData.set({ ...currentData, subscriptions });
  }

  updateOverviewAccounts(allAccounts: AccountData[]): void {
    const currentData = this.overviewData();
    this.overviewData.set({ ...currentData, allAccounts });
  }

  updateOverviewStrategies(allStrategies: ConfigurationOverview[]): void {
    const currentData = this.overviewData();
    this.overviewData.set({ ...currentData, allStrategies });
  }
}
