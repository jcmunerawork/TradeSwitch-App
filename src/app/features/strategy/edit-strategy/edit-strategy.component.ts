import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { allRules } from '../store/strategy.selectors';
import { StrategyState, RuleType } from '../models/strategy.model';
import { resetConfig } from '../store/strategy.actions';
import { SettingsService } from '../service/strategy.service';
import { ReportService } from '../../report/service/report.service';
import { User } from '../../overview/models/overview';
import { selectUser } from '../../auth/store/user.selectios';
import { selectUserKey } from '../../report/store/report.selectors';
import { setUserKey } from '../../report/store/report.actions';
import { initialStrategyState } from '../store/strategy.reducer';
import { EditPopupComponent } from '../../../shared/pop-ups/edit-pop-up/edit-popup.component';
import { ConfirmPopupComponent } from '../../../shared/pop-ups/confirm-pop-up/confirm-popup.component';
import { LoadingPopupComponent } from '../../../shared/pop-ups/loading-pop-up/loading-popup.component';

// Importar componentes de reglas edit-*
import { EditMaxDailyTradesComponent } from './components/edit-max-daily-trades/edit-max-daily-trades.component';
import { EditRiskRewardComponent } from './components/edit-risk-reward/edit-risk-reward.component';
import { EditRiskPerTradeComponent } from './components/edit-risk-per-trade/edit-risk-per-trade.component';
import { EditDaysAllowedComponent } from './components/edit-days-allowed/edit-days-allowed.component';
import { EditAssetsAllowedComponent } from './components/edit-assets-allowed/edit-assets-allowed.component';
import { EditHoursAllowedComponent } from './components/edit-hours-allowed/edit-hours-allowed.component';
import { AuthService } from '../../auth/service/authService';
import { AccountData } from '../../auth/models/userModel';
import { PluginHistoryService, PluginHistory } from '../../../shared/services/plugin-history.service';
import { AlertService } from '../../../core/services';
import { Instrument } from '../../report/models/report.model';
import { StrategyCacheService } from '../services/strategy-cache.service';
import { BalanceCacheService } from '../services/balance-cache.service';
import { AppContextService } from '../../../shared/context';

/**
 * Component for editing trading strategy configurations.
 *
 * This component provides a comprehensive interface for editing all aspects
 * of a trading strategy, including all six trading rules. It supports both
 * creating new strategies and editing existing ones.
 *
 * Features:
 * - Edit all six trading rules (risk/reward, risk per trade, max daily trades,
 *   days allowed, hours allowed, assets allowed)
 * - Strategy name editing
 * - Save and cancel functionality
 * - Validation before saving
 * - Loading states
 * - Plugin history integration
 * - Instrument fetching for assets allowed
 *
 * Relations:
 * - EditMaxDailyTradesComponent: Max daily trades rule editor
 * - EditRiskRewardComponent: Risk/reward ratio rule editor
 * - EditRiskPerTradeComponent: Risk per trade rule editor
 * - EditDaysAllowedComponent: Days allowed rule editor
 * - EditHoursAllowedComponent: Trading hours rule editor
 * - EditAssetsAllowedComponent: Assets allowed rule editor
 * - SettingsService: Saving strategy configurations
 * - StrategyCacheService: Loading strategies from cache
 * - BalanceCacheService: Getting account balances
 * - Store (NgRx): Managing strategy state
 *
 * @component
 * @selector app-edit-strategy
 * @standalone true
 */
@Component({
  selector: 'app-edit-strategy',
  imports: [
    FormsModule,
    NgIf,
    EditMaxDailyTradesComponent,
    EditRiskRewardComponent,
    EditRiskPerTradeComponent,
    EditDaysAllowedComponent,
    EditAssetsAllowedComponent,
    EditHoursAllowedComponent,
    EditPopupComponent,
    ConfirmPopupComponent,
    LoadingPopupComponent
  ],
  templateUrl: './edit-strategy.component.html',
  styleUrl: './edit-strategy.component.scss',
  standalone: true,
})
export class EditStrategyComponent implements OnInit, OnDestroy {
  config$: Observable<StrategyState>;
  config: StrategyState | null = null;
  myChoices: StrategyState | null = null;
  loading = false;
  initialLoading = true; // Loading global para evitar tambaleo
  user: User | null = null;
  editPopupVisible = false;
  confirmPopupVisible = false;
  strategyId: string | null = null;
  
  // Mini card properties
  currentStrategyName: string = 'My Strategy';
  lastModifiedText: string = 'Never modified';
  isFavorited: boolean = false;
  isEditingName: boolean = false;
  editingStrategyName: string = '';
  accountsData: AccountData[] = [];
  currentAccount: AccountData | null = null;
  availableInstruments: string[] = [];
  
  // Plugin history properties
  pluginHistory: PluginHistory[] = [];
  isPluginActive: boolean = false;
  private pluginSubscription: any = null;

  // Referencias a componentes de reglas para validación
  @ViewChild('hoursAllowedRef') hoursAllowedRef?: EditHoursAllowedComponent;
  @ViewChild('daysAllowedRef') daysAllowedRef?: EditDaysAllowedComponent;
  @ViewChild('assetsAllowedRef') assetsAllowedRef?: EditAssetsAllowedComponent;
  @ViewChild('maxDailyTradesRef') maxDailyTradesRef?: EditMaxDailyTradesComponent;
  @ViewChild('riskPerTradeRef') riskPerTradeRef?: EditRiskPerTradeComponent;

  constructor(
    private store: Store,
    private router: Router,
    private route: ActivatedRoute,
    private strategySvc: SettingsService,
    private reportSvc: ReportService,
    private authService: AuthService,
    private pluginHistoryService: PluginHistoryService,
    private strategyCacheService: StrategyCacheService,
    private balanceCacheService: BalanceCacheService,
    private alertService: AlertService,
    private appContext: AppContextService
  ) {
    this.config$ = this.store.select(allRules);
  }

  async ngOnInit() {
    this.initialLoading = true;
    
    try {
      // FLUJO SIMPLIFICADO: Cargar todo antes de mostrar la UI
      await this.initializeEverything();
    } catch (error) {
      console.error('Error during initialization:', error);
    } finally {
      this.initialLoading = false;
    }
  }

  /**
   * Inicializar todo antes de mostrar la UI
   */
  private async initializeEverything(): Promise<void> {
    // 1. Obtener datos del usuario
    await this.getUserDataAsync();
    
    // 2. Configurar listeners
    this.listenConfigurations();
    
    // 3. Obtener ID de estrategia y cargar configuración
    this.getStrategyId();
  }

  /**
   * MÉTODO SIMPLIFICADO: Obtener ID de estrategia desde la URL
   * - Si hay strategyId: Cargar desde cache
   * - Si no hay strategyId: Nueva estrategia
   */
  getStrategyId() {
    this.route.queryParams.subscribe(params => {
      const newStrategyId = params['strategyId'] || null;
      
      // Si cambió la estrategia, limpiar el estado
      if (this.strategyId !== newStrategyId) {
        this.clearState();
      }
      
      this.strategyId = newStrategyId;
      
      // Cargar configuración usando el cache
      this.loadStrategyFromCache();
    });
  }

  /**
   * Limpia el estado al cambiar entre estrategias
   */
  clearState() {
    // Limpiar variables del componente
    this.myChoices = null;
    this.config = null;
    this.currentStrategyName = 'My Strategy';
    this.lastModifiedText = 'Never modified';
    this.isFavorited = false;
    this.isEditingName = false;
    this.editingStrategyName = '';
    
    // LIMPIAR EL STORE para evitar datos de estrategias anteriores
    // Usar un estado inicial vacío en lugar de null
    const emptyState: StrategyState = {
      maxDailyTrades: { isActive: false, type: RuleType.MAX_DAILY_TRADES, maxDailyTrades: 0 },
      riskReward: { isActive: false, type: RuleType.RISK_REWARD_RATIO, riskRewardRatio: '1:2' },
      riskPerTrade: { isActive: false, type: RuleType.MAX_RISK_PER_TRADE, review_type: 'MAX', number_type: 'PERCENTAGE', percentage_type: 'NULL', risk_ammount: 0, balance: 0, actualBalance: 0 },
      daysAllowed: { isActive: false, type: RuleType.DAYS_ALLOWED, tradingDays: [] },
      assetsAllowed: { isActive: false, type: RuleType.ASSETS_ALLOWED, assetsAllowed: [] },
      hoursAllowed: { isActive: false, type: RuleType.TRADING_HOURS, tradingOpenTime: '', tradingCloseTime: '', timezone: '' }
    };
    
    this.store.dispatch(resetConfig({ config: emptyState }));
  }

  /**
   * MÉTODO PRINCIPAL: Cargar estrategia desde backend
   * FLUJO SIMPLIFICADO:
   * - Si hay strategyId: Cargar desde backend (siempre solicita al backend)
   * - Si no hay strategyId: Inicializar como nueva estrategia
   */
  loadStrategyFromCache() {
    if (this.strategyId) {
      // Cargar estrategia existente desde backend (siempre solicita al backend)
      this.loadStrategyFromBackend();
    } else {
      // Inicializar como nueva estrategia
      this.initializeAsNewStrategy();
    }
  }

  /**
   * Cargar estrategia directamente desde backend (siempre solicita al backend)
   */
  async loadStrategyFromBackend() {
    if (!this.strategyId || !this.user?.id) {
      this.initializeAsNewStrategy();
      return;
    }

    try {
      this.initialLoading = true;
      
      // Cargar estrategia directamente desde backend
      const strategyData = await this.strategySvc.getStrategyView(this.strategyId);
      
      if (!strategyData || !strategyData.configuration) {
        console.error('Strategy data not found or missing configuration');
        this.initializeAsNewStrategy();
        return;
      }

      // Actualizar mini card
      this.currentStrategyName = strategyData.overview.name;
      
      // Manejar diferentes formatos de updated_at (Firebase Timestamp o objeto con seconds/nanoseconds)
      const updatedAt = this.parseDate(strategyData.overview.updated_at);
      this.lastModifiedText = this.formatDate(updatedAt);
      this.isFavorited = false;

      // Cargar balance y inicializar con configuración
      this.loadBalanceAndInitializeWithConfig(strategyData.configuration);
      
    } catch (error) {
      console.error('Error loading strategy from backend:', error);
      this.initializeAsNewStrategy();
    } finally {
      this.initialLoading = false;
    }
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
    return new Date();
  }

  /**
   * Cargar balance e inicializar con configuración específica
   */
  loadBalanceAndInitializeWithConfig(configuration: StrategyState) {
    // Obtener balance desde cache primero
    let balance = 0;
    if (this.accountsData.length > 0) {
      const firstAccount = this.accountsData[0];
      balance = this.balanceCacheService.getBalance(firstAccount.accountID);
    }

    // Inicializar con balance del cache
    this.initializeWithConfigAndBalance(configuration, balance);

    // Si necesita actualización, hacer petición en background
    if (this.accountsData.length > 0) {
      const firstAccount = this.accountsData[0];
      if (this.balanceCacheService.needsUpdate(firstAccount.accountID)) {
        this.updateBalanceInBackground(firstAccount);
      }
    }
  }

  /**
   * Actualizar balance en background sin bloquear la UI
   */
  private updateBalanceInBackground(account: AccountData) {
    // El backend gestiona el accessToken automáticamente
    this.reportSvc.getBalanceData(account.accountID as string, account.accountNumber as number).subscribe({
      next: (balance) => {
        // Actualizar cache con nuevo balance
        this.balanceCacheService.setBalance(account.accountID, balance);
      },
      error: (err) => {
        console.error('Error fetching balance data in background:', err);
      },
    });
  }

  /**
   * Inicializar con configuración y balance específicos
   */
  initializeWithConfigAndBalance(configuration: StrategyState, balance: number) {
    // Solo actualizar balance si es para balance actual (ACTUAL_B)
    // Para balance inicial (INITIAL_B), mantener el valor de Firebase
    let configWithBalance = { ...configuration };
    
    if (configuration.riskPerTrade.percentage_type === 'ACTUAL_B') {
      // Para balance actual, usar el balance del cache
      configWithBalance = {
        ...configuration,
        riskPerTrade: {
          ...configuration.riskPerTrade,
          actualBalance: balance
        }
      };
    } else if (configuration.riskPerTrade.percentage_type === 'INITIAL_B') {
      // Para balance inicial, mantener el valor de Firebase (no modificar)
      configWithBalance = configuration;
    } else {
      // Para otros casos, usar el balance del cache
      configWithBalance = {
        ...configuration,
        riskPerTrade: {
          ...configuration.riskPerTrade,
          balance: balance
        }
      };
    }

    // Cargar en el store
    this.store.dispatch(resetConfig({ config: configWithBalance }));

    // Distribuir reglas entre paneles
    this.distributeRulesBetweenPanels(configWithBalance);
  }

  /**
   * MÉTODO SIMPLIFICADO: Inicializar como nueva estrategia
   * FLUJO PARA NUEVA ESTRATEGIA:
   * - Available Rules: Todas las reglas (isActive = true para mostrar)
   * - My Choices: Vacío (isActive = false)
   */
  initializeAsNewStrategy() {
    // Cargar configuración por defecto con balance
    this.loadBalanceAndInitialize();
  }

  /**
   * MÉTODO SIMPLIFICADO: Distribuir reglas entre paneles
   * LÓGICA UNIFICADA:
   * - My Choices: Reglas con isActive = true
   * - Available Rules: Reglas con isActive = false
   */
  distributeRulesBetweenPanels(configurationData: StrategyState) {
    // My Choices: Solo reglas activas (isActive = true)
    this.myChoices = {
      maxDailyTrades: { 
        isActive: configurationData.maxDailyTrades.isActive, 
        type: configurationData.maxDailyTrades.type, 
        maxDailyTrades: configurationData.maxDailyTrades.maxDailyTrades 
      },
      riskReward: { 
        isActive: configurationData.riskReward.isActive, 
        type: configurationData.riskReward.type, 
        riskRewardRatio: configurationData.riskReward.riskRewardRatio 
      },
      riskPerTrade: { 
        isActive: configurationData.riskPerTrade.isActive, 
        type: configurationData.riskPerTrade.type, 
        review_type: configurationData.riskPerTrade.review_type, 
        number_type: configurationData.riskPerTrade.number_type, 
        percentage_type: configurationData.riskPerTrade.percentage_type, 
        risk_ammount: configurationData.riskPerTrade.risk_ammount, 
        balance: configurationData.riskPerTrade.balance,
        actualBalance: configurationData.riskPerTrade.actualBalance 
      },
      daysAllowed: { 
        isActive: configurationData.daysAllowed.isActive, 
        type: configurationData.daysAllowed.type, 
        tradingDays: configurationData.daysAllowed.tradingDays 
      },
      assetsAllowed: { 
        isActive: configurationData.assetsAllowed.isActive, 
        type: configurationData.assetsAllowed.type, 
        assetsAllowed: configurationData.assetsAllowed.assetsAllowed 
      },
      hoursAllowed: { 
        isActive: configurationData.hoursAllowed.isActive, 
        type: configurationData.hoursAllowed.type, 
        tradingOpenTime: configurationData.hoursAllowed.tradingOpenTime, 
        tradingCloseTime: configurationData.hoursAllowed.tradingCloseTime, 
        timezone: configurationData.hoursAllowed.timezone 
      }
    };

    // Available Rules: Solo reglas NO activas (isActive = false)
    this.config = {
      maxDailyTrades: { 
        isActive: !configurationData.maxDailyTrades.isActive, 
        type: configurationData.maxDailyTrades.type, 
        maxDailyTrades: configurationData.maxDailyTrades.maxDailyTrades 
      },
      riskReward: { 
        isActive: !configurationData.riskReward.isActive, 
        type: configurationData.riskReward.type, 
        riskRewardRatio: configurationData.riskReward.riskRewardRatio 
      },
      riskPerTrade: { 
        isActive: !configurationData.riskPerTrade.isActive, 
        type: configurationData.riskPerTrade.type, 
        review_type: configurationData.riskPerTrade.review_type, 
        number_type: configurationData.riskPerTrade.number_type, 
        percentage_type: configurationData.riskPerTrade.percentage_type, 
        risk_ammount: configurationData.riskPerTrade.risk_ammount, 
        balance: configurationData.riskPerTrade.balance,
        actualBalance: configurationData.riskPerTrade.actualBalance 
      },
      daysAllowed: { 
        isActive: !configurationData.daysAllowed.isActive, 
        type: configurationData.daysAllowed.type, 
        tradingDays: configurationData.daysAllowed.tradingDays 
      },
      assetsAllowed: { 
        isActive: !configurationData.assetsAllowed.isActive, 
        type: configurationData.assetsAllowed.type, 
        assetsAllowed: configurationData.assetsAllowed.assetsAllowed 
      },
      hoursAllowed: { 
        isActive: !configurationData.hoursAllowed.isActive, 
        type: configurationData.hoursAllowed.type, 
        tradingOpenTime: configurationData.hoursAllowed.tradingOpenTime, 
        tradingCloseTime: configurationData.hoursAllowed.tradingCloseTime, 
        timezone: configurationData.hoursAllowed.timezone 
      }
    };
  }

  /**
   * Cargar cuentas de forma asíncrona
   */
  private async fetchUserAccountsAsync(): Promise<void> {
    if (this.user?.id) {
      try {
        const accounts = await this.authService.getUserAccounts(this.user.id);
        this.accountsData = accounts || [];
        
        // Cargar instruments para todas las cuentas si no están en el contexto
        if (this.accountsData.length > 0) {
          await this.loadInstrumentsForAllAccounts();
          
          // Actualizar availableInstruments con la primera cuenta
          const firstAccount = this.accountsData[0];
          if (firstAccount?.accountID) {
            const cachedInstruments = this.appContext.getInstrumentsForAccount(firstAccount.accountID);
            if (cachedInstruments && cachedInstruments.length > 0) {
              this.availableInstruments = cachedInstruments.map((instrument: any) => 
                instrument.name || instrument.localizedName || ''
              ).filter((name: string) => name);
            }
          }
        }
        
        // After loading accounts, try to fetch user key
        await this.fetchUserKeyAsync();
      } catch (error) {
        console.error('Error loading accounts:', error);
        this.accountsData = [];
      }
    }
  }

  fetchUserAccounts() {
    if (this.user?.id) {
      this.authService.getUserAccounts(this.user.id).then((accounts) => {
        this.accountsData = accounts || [];
        // After loading accounts, try to fetch user key
        this.fetchUserKey();
      });
    }
  }

  /**
   * Obtener userKey de forma asíncrona
   */
  private async fetchUserKeyAsync(): Promise<void> {
    if (this.user?.email && this.accountsData.length > 0) {
      // Use the first account's credentials
      const firstAccount = this.accountsData[0];
      
      try {
        const key = await firstValueFrom(this.reportSvc.getUserKey(
          firstAccount.emailTradingAccount, 
          firstAccount.brokerPassword, 
          firstAccount.server
        ));
        
        this.store.dispatch(setUserKey({ userKey: key || '' }));
        // After getting userKey, load instruments
        this.loadInstruments(key || '', firstAccount);
      } catch (err) {
        console.error('Error fetching user key:', err);
        this.store.dispatch(setUserKey({ userKey: '' }));
      }
    } else {
      this.store.dispatch(setUserKey({ userKey: '' }));
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
            // After getting userKey, load instruments
            this.loadInstruments(key, firstAccount);
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

  /**
   * Guardar instruments en localStorage
   */
  private saveInstrumentsToLocalStorage(accountId: string, instruments: any[]): void {
    try {
      const key = `tradeswitch_instruments_${accountId}`;
      localStorage.setItem(key, JSON.stringify({
        instruments,
        timestamp: Date.now()
      }));
    } catch (error) {
    }
  }

  /**
   * Obtener instruments desde localStorage
   */
  private getInstrumentsFromLocalStorage(accountId: string): any[] | null {
    try {
      const key = `tradeswitch_instruments_${accountId}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.instruments && Array.isArray(parsed.instruments)) {
          return parsed.instruments;
        }
      }
    } catch (error) {
    }
    
    return null;
  }

  /**
   * Cargar instruments para todas las cuentas si no están en el contexto o localStorage
   */
  private async loadInstrumentsForAllAccounts(): Promise<void> {
    if (!this.accountsData || this.accountsData.length === 0) {
      return;
    }

    // Cargar instruments para cada cuenta que no los tenga en el contexto o localStorage
    const loadPromises = this.accountsData.map(async (account) => {
      if (!account.accountID || account.accountNumber === undefined) {
        return;
      }

      // 1. Verificar si ya están cargados en el contexto
      let cachedInstruments = this.appContext.getInstrumentsForAccount(account.accountID);
      if (cachedInstruments && cachedInstruments.length > 0) {
        return;
      }

      // 2. Verificar localStorage
      cachedInstruments = this.getInstrumentsFromLocalStorage(account.accountID);
      if (cachedInstruments && cachedInstruments.length > 0) {
        // Guardar en el contexto también
        this.appContext.setInstrumentsForAccount(account.accountID, cachedInstruments);
        return;
      }

      // 3. Si no están cargados, cargarlos desde el backend
      // El backend gestiona el accessToken automáticamente, no es necesario userKey
      try {
        const instruments = await firstValueFrom(this.reportSvc.getAllInstruments(
          account.accountID,
          account.accountNumber
        ));

        if (instruments && instruments.length > 0) {
          // Guardar en el contexto
          this.appContext.setInstrumentsForAccount(account.accountID, instruments);
          // Guardar en localStorage
          this.saveInstrumentsToLocalStorage(account.accountID, instruments);
        }
      } catch (error) {
        console.error(`❌ EditStrategy: Error cargando instruments para cuenta ${account.accountID}:`, error);
        // No lanzar error, continuar con otras cuentas
      }
    });

    await Promise.all(loadPromises);
  }

  loadInstruments(userKey: string, account: AccountData) {
    // 1. Primero intentar obtener instrumentos del contexto
    let cachedInstruments = this.appContext.getInstrumentsForAccount(account.accountID);
    
    // 2. Si no están en el contexto, verificar localStorage
    if (!cachedInstruments || cachedInstruments.length === 0) {
      cachedInstruments = this.getInstrumentsFromLocalStorage(account.accountID);
      if (cachedInstruments && cachedInstruments.length > 0) {
        // Guardar en el contexto también
        this.appContext.setInstrumentsForAccount(account.accountID, cachedInstruments);
      }
    }
    
    if (cachedInstruments && cachedInstruments.length > 0) {
      // Extraer solo los nombres de los instrumentos
      this.availableInstruments = cachedInstruments.map((instrument: any) => 
        instrument.name || instrument.localizedName || ''
      ).filter((name: string) => name);
      
      // Guardar instrumentos en localStorage para uso en reglas de estrategia (formato antiguo para compatibilidad)
      try {
        const instrumentNames = cachedInstruments
          .map((instrument: any) => instrument.name || instrument.localizedName)
          .filter((name: string) => name && name.trim() !== '');
        localStorage.setItem('tradeswitch_available_instruments', JSON.stringify(instrumentNames));
      } catch (error) {
        console.error('   ❌ [LOCALSTORAGE] Error guardando instrumentos en localStorage:', error);
      }
      return;
    }
    
    // 3. Si no están en el contexto ni localStorage, cargarlos desde el backend
    // El backend gestiona el accessToken automáticamente, no es necesario userKey
    this.reportSvc.getAllInstruments(
      account.accountID,
      account.accountNumber
    ).subscribe({
      next: (instruments: Instrument[]) => {
        // Extraer solo los nombres de los instrumentos
        this.availableInstruments = instruments.map(instrument => instrument.name);
        
        // Guardar en el contexto para futuras referencias
        if (instruments.length > 0) {
          this.appContext.setInstrumentsForAccount(account.accountID, instruments);
          // Guardar en localStorage con la nueva clave
          this.saveInstrumentsToLocalStorage(account.accountID, instruments);
          
          // Guardar instrumentos en localStorage para uso en reglas de estrategia (formato antiguo para compatibilidad)
          try {
            const instrumentNames = instruments
              .map((instrument: Instrument) => instrument.name || instrument.localizedName)
              .filter((name: string) => name && name.trim() !== '');
            localStorage.setItem('tradeswitch_available_instruments', JSON.stringify(instrumentNames));
          } catch (error) {
            console.error('   ❌ [LOCALSTORAGE] Error guardando instrumentos en localStorage:', error);
          }
        }
      },
      error: (err) => {
        console.error('   ❌ [API] Error loading instruments:', err);
        this.availableInstruments = [];
      }
    });
  }

  getActualBalance() {
    // El backend gestiona el accessToken automáticamente, no es necesario userKey para getBalanceData
    // Use the first account's data dynamically
    if (this.accountsData.length > 0) {
      const firstAccount = this.accountsData[0];
      // El servicio ya actualiza el contexto automáticamente
      this.reportSvc.getBalanceData(firstAccount.accountID as string, firstAccount.accountNumber as number).subscribe({
        next: (balance) => {
          this.initializeWithConfigAndBalance(initialStrategyState, balance);
        },
        error: (err) => {
          console.error('Error fetching balance data', err);
          this.initializeWithConfigAndBalance(initialStrategyState, 0);
        },
      });
    } else {
      this.initializeWithConfigAndBalance(initialStrategyState, 0);
    }
  }

  /**
   * Obtener datos del usuario de forma asíncrona
   */
  private async getUserDataAsync(): Promise<void> {
    return new Promise((resolve) => {
      this.store.select(selectUser).subscribe({
        next: async (user) => {
          this.user = user.user;
          
          // Cargar cuentas y configurar plugin history cuando el usuario esté disponible
          if (this.user?.id) {
            await this.fetchUserAccountsAsync();
            this.setupPluginHistoryListener();
          } else {
          }
          resolve();
        },
        error: (err) => {
          console.error('Error fetching user data', err);
          resolve();
        },
      });
    });
  }

  getUserData() {
    this.store.select(selectUser).subscribe({
      next: (user) => {
        this.user = user.user;
        
        // Cargar cuentas y configurar plugin history cuando el usuario esté disponible
        if (this.user?.id) {
          this.fetchUserAccounts();
          this.setupPluginHistoryListener();
        } else {
        }
      },
      error: (err) => {
        console.error('Error fetching user data', err);
      },
    });
  }

  /**
   * MÉTODO SIMPLIFICADO: Cargar balance e inicializar como nueva estrategia
   */
  loadBalanceAndInitialize() {
    // Obtener balance desde cache primero
    let balance = 0;
    if (this.accountsData.length > 0) {
      const firstAccount = this.accountsData[0];
      balance = this.balanceCacheService.getBalance(firstAccount.accountID);
    }

    // Inicializar con balance del cache
    this.initializeWithConfigAndBalance(initialStrategyState, balance);

    // Si necesita actualización, hacer petición en background
    if (this.accountsData.length > 0) {
      const firstAccount = this.accountsData[0];
      if (this.balanceCacheService.needsUpdate(firstAccount.accountID)) {
        this.updateBalanceInBackground(firstAccount);
      }
    }
  }

  /**
   * MÉTODO SIMPLIFICADO: Escuchar cambios en el store de reglas
   */
  listenConfigurations() {
    this.store
      .select(allRules)
      .pipe()
      .subscribe((config) => {
        // Actualizar UI en tiempo real
        this.listenToStoreChanges();
      });
  }


  /**
   * MÉTODO SIMPLIFICADO: Escuchar cambios en tiempo real
   */
  listenToStoreChanges() {
    this.config$.subscribe(config => {
      if (this.config && this.myChoices) {
        // Actualizar UI en tiempo real
        this.updateMyChoicesFromConfig(config);
      }
    });
  }

  /**
   * MÉTODO SIMPLIFICADO: Actualizar UI en tiempo real
   */
  updateMyChoicesFromConfig(newConfig: StrategyState) {
    if (!this.myChoices || !this.config) return;

    // Usar el método unificado para distribuir reglas
    this.distributeRulesBetweenPanels(newConfig);
  }

  saveStrategy() {
    // Verificar si se puede guardar (plugin no activo)
    if (!this.canSaveStrategy()) {
      this.alertService.showWarning('Cannot save strategy while plugin is active. Please deactivate the plugin first.', 'Plugin Active');
      return;
    }

    // Validar todas las reglas activas
    if (!this.validateActiveRules()) {
      return;
    }
    
    this.confirmPopupVisible = true;
  }

  /**
   * MÉTODO 7: Guardar configuración
   * FLUJO DE GUARDADO:
   * - Solo se guardan las reglas que están en My Choices (isActive = true)
   * - Si hay strategyId: Actualizar estrategia existente
   * - Si no hay strategyId: Crear nueva estrategia
   */
  save = () => {
    if (this.myChoices && this.user?.id) {
      this.loading = true;
      
      // GUARDADO: Crear configuración solo con las reglas de My Choices
      // Las reglas que están en My Choices son las que se guardarán como activas
      const newConfig: StrategyState = {
        maxDailyTrades: { isActive: this.myChoices.maxDailyTrades.isActive, type: this.myChoices.maxDailyTrades.type, maxDailyTrades: this.myChoices.maxDailyTrades.maxDailyTrades },
        riskReward: { isActive: this.myChoices.riskReward.isActive, type: this.myChoices.riskReward.type, riskRewardRatio: this.myChoices.riskReward.riskRewardRatio },
        riskPerTrade: { isActive: this.myChoices.riskPerTrade.isActive, type: this.myChoices.riskPerTrade.type, review_type: this.myChoices.riskPerTrade.review_type, number_type: this.myChoices.riskPerTrade.number_type, percentage_type: this.myChoices.riskPerTrade.percentage_type, risk_ammount: this.myChoices.riskPerTrade.risk_ammount, balance: this.myChoices.riskPerTrade.balance, actualBalance: this.myChoices.riskPerTrade.actualBalance },
        daysAllowed: { isActive: this.myChoices.daysAllowed.isActive, type: this.myChoices.daysAllowed.type, tradingDays: this.myChoices.daysAllowed.tradingDays },
        assetsAllowed: { isActive: this.myChoices.assetsAllowed.isActive, type: this.myChoices.assetsAllowed.type, assetsAllowed: this.myChoices.assetsAllowed.assetsAllowed },
        hoursAllowed: { isActive: this.myChoices.hoursAllowed.isActive, type: this.myChoices.hoursAllowed.type, tradingOpenTime: this.myChoices.hoursAllowed.tradingOpenTime, tradingCloseTime: this.myChoices.hoursAllowed.tradingCloseTime, timezone: this.myChoices.hoursAllowed.timezone }
      };

      // Actualizar el store con la nueva configuración
      this.store.dispatch(resetConfig({ config: newConfig }));

      // CASO A: Estrategia existente - Actualizar en Firebase
      if (this.strategyId) {
        this.strategySvc
          .updateStrategyView(this.strategyId, {
            configuration: newConfig
          })
          .then(async () => {
            // Actualizar fecha de modificación en la mini card
            this.lastModifiedText = this.formatDate(new Date());
            
            // NOTA: updateStrategyView ya llama a reloadAllStrategiesToCache internamente
            // No es necesario limpiar el cache aquí, ya se recarga automáticamente
            
            this.router.navigate(['/strategy']);
          })
          .catch((err) => {
            console.error('Update Error:', err);
            this.alertService.showError('Error Updating Strategy', 'Update Error');
          })
          .finally(() => {
            this.loading = false;
            this.closeConfirmModal();
          });
      } else {
        // CASO B: Nueva estrategia - Crear en Firebase
        this.strategySvc
          .createStrategyView(this.user.id, this.currentStrategyName, newConfig)
          .then(async (strategyId) => {
            // ✅ createStrategyView ya guarda la strategy en cache y localStorage automáticamente
            // No es necesario recargar todas las strategies
            
            this.router.navigate(['/strategy']);
          })
          .catch((err) => {
            console.error('Create Error:', err);
            this.alertService.showError('Error Creating Strategy', 'Creation Error');
          })
          .finally(() => {
            this.loading = false;
            this.closeConfirmModal();
          });
      }
    }
  };

  closePopup = () => {
    this.editPopupVisible = false;
  };

  openConfirmPopup() {
    this.confirmPopupVisible = true;
  }

  closeConfirmModal = () => {
    this.confirmPopupVisible = false;
  };

  /**
   * Método que se ejecuta cuando se confirma el guardado
   * Hace la validación final antes de proceder con el guardado
   */
  confirmSave = () => {
    // Validar todas las reglas activas una vez más
    if (!this.validateActiveRules()) {
      return; // No proceder con el guardado
    }
    
    this.save();
  };

  /**
   * Valida todas las reglas activas antes de permitir guardar
   */
  private validateActiveRules(): boolean {
    if (!this.myChoices) {
      return true; // Si no hay reglas activas, permitir guardar
    }

    const validationErrors: string[] = [];

    // Validar regla de horas permitidas
    if (this.myChoices.hoursAllowed.isActive && this.hoursAllowedRef) {
      if (!this.hoursAllowedRef.isRuleValid()) {
        validationErrors.push(`Hours Allowed: ${this.hoursAllowedRef.getErrorMessage()}`);
      }
    }

    // Validar regla de días permitidos
    if (this.myChoices.daysAllowed.isActive && this.daysAllowedRef) {
      if (!this.daysAllowedRef.isRuleValid()) {
        validationErrors.push(`Days Allowed: ${this.daysAllowedRef.getErrorMessage()}`);
      }
    }

    // Validar regla de assets permitidos
    if (this.myChoices.assetsAllowed.isActive && this.assetsAllowedRef) {
      if (!this.assetsAllowedRef.isRuleValid()) {
        validationErrors.push(`Assets Allowed: ${this.assetsAllowedRef.getErrorMessage()}`);
      }
    }

    // Validar regla de máximo de trades diarios
    if (this.myChoices.maxDailyTrades.isActive && this.maxDailyTradesRef) {
      if (!this.maxDailyTradesRef.isRuleValid()) {
        validationErrors.push(`Max Daily Trades: ${this.maxDailyTradesRef.getErrorMessage()}`);
      }
    }

    // Validar regla de riesgo por trade
    if (this.myChoices.riskPerTrade.isActive && this.riskPerTradeRef) {
      if (!this.riskPerTradeRef.isRuleValid()) {
        validationErrors.push(`Risk Per Trade: ${this.riskPerTradeRef.getErrorMessage()}`);
      }
    }

    if (validationErrors.length > 0) {
      const errorMessage = 'Cannot save strategy. Please complete the following rules:\n\n' + 
                          validationErrors.join('\n') + 
                          '\n\nAll required fields must be filled before saving.';
      this.alertService.showError(errorMessage, 'Validation Error');
      return false;
    }

    return true;
  }

  // Mini card methods
  startEditName() {
    this.isEditingName = true;
    this.editingStrategyName = this.currentStrategyName;
    // Focus on input after view update
    setTimeout(() => {
      const input = document.querySelector('.strategy-name-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  async saveStrategyName() {
    if (!this.editingStrategyName.trim()) {
      this.cancelEditName();
      return;
    }

    if (this.editingStrategyName.trim() === this.currentStrategyName) {
      this.cancelEditName();
      return;
    }

    try {
      if (this.strategyId) {
        // ✅ Usar updateStrategyView para que se actualice automáticamente el cache y localStorage
        await this.strategySvc.updateStrategyView(this.strategyId, { 
          name: this.editingStrategyName.trim() 
        });
        
        // Actualizar UI
        this.currentStrategyName = this.editingStrategyName.trim();
        this.lastModifiedText = this.formatDate(new Date());
      } else {
        // Si no hay strategyId, solo actualizar localmente
        this.currentStrategyName = this.editingStrategyName.trim();
        this.lastModifiedText = this.formatDate(new Date());
      }
      
      this.isEditingName = false;
    } catch (error) {
      console.error('Error updating strategy name:', error);
      this.alertService.showError('Error updating strategy name', 'Name Update Error');
      this.cancelEditName();
    }
  }

  cancelEditName() {
    this.isEditingName = false;
    this.editingStrategyName = '';
  }

  toggleFavorite() {
    this.isFavorited = !this.isFavorited;
    // TODO: Implementar persistencia de favoritos en Firebase
  }

  formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `Last modified: ${month} ${day}, ${year}`;
  }

  discardChanges() {
    this.router.navigate(['/strategy']);
  }

  resetStrategy() {
    // Verificar si se puede resetear (plugin no activo)
    if (!this.canSaveStrategy()) {
      this.alertService.showWarning('Cannot reset strategy while plugin is active. Please deactivate the plugin first.', 'Plugin Active');
      return;
    }

    // Confirmar la acción
    const confirmed = confirm('Are you sure you want to reset the strategy? This will move all rules back to Available Rules and cannot be undone.');
    
    if (confirmed) {
      // Resetear a configuración inicial (todas las reglas en Available Rules)
      this.initializeWithConfigAndBalance(initialStrategyState, 0);
    }
  }

  /**
   * MÉTODO 8: Cargar plugin history y verificar si está activo
   * FLUJO DE VERIFICACIÓN:
   * - Cargar plugin history desde Firebase
   * - Verificar si algún plugin está activo
   * - Bloquear botón de guardar si está activo
   */
  setupPluginHistoryListener() {
    
    if (!this.user?.id) {
      return;
    }

    try {
      
      // Suscribirse al Observable del servicio con userId
      this.pluginSubscription = this.pluginHistoryService.getPluginHistoryRealtime(this.user.id).subscribe({
        next: (pluginHistory: PluginHistory[]) => {
          this.pluginHistory = pluginHistory;
          
          // Verificar si el plugin está activo usando la nueva lógica de fechas
          if (pluginHistory.length > 0) {
            const plugin = pluginHistory[0];
            this.isPluginActive = this.pluginHistoryService.isPluginActiveByDates(plugin);
          } else {
            // No hay plugin para este usuario
            this.isPluginActive = false;
          }
          
        },
        error: (error) => {
          console.error('Error in plugin history subscription:', error);
          this.isPluginActive = false;
        }
      });
      
    } catch (error) {
      console.error('Error setting up plugin history listener:', error);
      this.isPluginActive = false;
    }
  }

  /**
   * MÉTODO 9: Verificar si se puede guardar la estrategia
   * FLUJO DE VALIDACIÓN:
   * - Si el plugin está activo, no se puede guardar
   * - Si el plugin no está activo, se puede guardar normalmente
   */
  canSaveStrategy(): boolean {
    const canSave = !this.isPluginActive;
    return canSave;
  }

  /**
   * MÉTODO 10: Limpiar recursos al destruir el componente
   * FLUJO DE LIMPIEZA:
   * - Desuscribirse del listener de Firebase
   * - Evitar memory leaks
   */
  ngOnDestroy() {
    if (this.pluginSubscription) {
      this.pluginSubscription.unsubscribe();
      this.pluginSubscription = null;
    }
  }
}

