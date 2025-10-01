import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { FormsModule } from '@angular/forms';
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
import { Instrument } from '../../report/models/report.model';

@Component({
  selector: 'app-edit-strategy',
  imports: [
    FormsModule,
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

  constructor(
    private store: Store,
    private router: Router,
    private route: ActivatedRoute,
    private strategySvc: SettingsService,
    private reportSvc: ReportService,
    private authService: AuthService,
    private pluginHistoryService: PluginHistoryService
  ) {
    this.config$ = this.store.select(allRules);
  }

  ngOnInit() {
    // 0. LIMPIAR ESTADO INICIAL para evitar datos residuales
    this.clearState();
    
    // FLUJO SIMPLIFICADO:
    // 1. Obtener datos del usuario autenticado
    this.getUserData();
    
    // 2. Cargar cuentas del usuario para obtener credenciales
    this.fetchUserAccounts();
    
    // 3. Escuchar cambios en el store de reglas (SIEMPRE)
    this.listenConfigurations();
    
    // 4. Obtener ID de estrategia desde la URL (si existe)
    this.getStrategyId();
    
    // 5. Configurar listener en tiempo real para plugin history (después de obtener user)
    // Se ejecutará en getUserData() cuando el usuario esté disponible
  }

  /**
   * MÉTODO 1: Obtener ID de estrategia desde la URL
   * - Escucha cambios en los parámetros de la URL
   * - Si hay strategyId, carga la configuración de esa estrategia específica
   * - Si no hay strategyId, se trata de una nueva estrategia
   */
  getStrategyId() {
    this.route.queryParams.subscribe(params => {
      const newStrategyId = params['strategyId'] || null;
      
      // Si cambió la estrategia, limpiar el estado para evitar datos mezclados
      if (this.strategyId !== newStrategyId) {
        this.clearState();
      }
      
      this.strategyId = newStrategyId;
      
      // FLUJO SIMPLIFICADO: SIEMPRE cargar desde Firebase si hay strategyId
      if (this.strategyId) {
        this.loadStrategyConfiguration();
      }
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
      riskReward: { isActive: false, type: RuleType.RISK_REWARD_RATIO, riskRewardRatio: '1:1' },
      riskPerTrade: { isActive: false, type: RuleType.MAX_RISK_PER_TRADE, maxRiskPerTrade: 0, maxRiskPercentage: 0, balance: 0 },
      daysAllowed: { isActive: false, type: RuleType.DAYS_ALLOWED, tradingDays: [] },
      assetsAllowed: { isActive: false, type: RuleType.ASSETS_ALLOWED, assetsAllowed: [] },
      hoursAllowed: { isActive: false, type: RuleType.TRADING_HOURS, tradingOpenTime: '09:00', tradingCloseTime: '17:00', timezone: 'UTC' }
    };
    this.store.dispatch(resetConfig({ config: emptyState }));
  }

  /**
   * MÉTODO NUEVO: Analizar reglas y distribuir según su estado
   * LÓGICA PRINCIPAL:
   * - Si TODAS las reglas están en false = tratar como nueva estrategia
   * - Si hay AL MENOS UNA regla en true = distribuir entre paneles
   */
  analyzeAndDistributeRules(configurationData: StrategyState) {
    // Verificar si todas las reglas están en false
    const allRulesInactive = !configurationData.maxDailyTrades.isActive &&
                            !configurationData.riskReward.isActive &&
                            !configurationData.riskPerTrade.isActive &&
                            !configurationData.daysAllowed.isActive &&
                            !configurationData.assetsAllowed.isActive &&
                            !configurationData.hoursAllowed.isActive;

    if (allRulesInactive) {
      // TODAS LAS REGLAS EN FALSE = Tratar como nueva estrategia
      this.initializeAsNewStrategy();
    } else {
      // HAY REGLAS ACTIVAS = Distribuir entre paneles
      this.distributeActiveRules(configurationData);
    }
  }

  /**
   * MÉTODO NUEVO: Inicializar como nueva estrategia
   * FLUJO PARA NUEVA ESTRATEGIA:
   * - Available Rules: Todas las reglas (isActive = true para mostrar)
   * - My Choices: Vacío (isActive = false)
   */
  initializeAsNewStrategy() {
    // Cargar configuración por defecto con balance
    this.loadBalanceAndInitialize();
  }

  /**
   * MÉTODO NUEVO: Distribuir reglas activas entre paneles
   * FLUJO PARA ESTRATEGIA CON REGLAS ACTIVAS:
   * - My Choices: Solo reglas con isActive = true
   * - Available Rules: Solo reglas con isActive = false
   */
  distributeActiveRules(configurationData: StrategyState) {
    // Cargar configuración en el store
    this.store.dispatch(resetConfig({ config: configurationData }));

    // My Choices: Solo reglas activas (isActive = true)
    this.myChoices = {
      maxDailyTrades: { isActive: configurationData.maxDailyTrades.isActive, type: configurationData.maxDailyTrades.type, maxDailyTrades: configurationData.maxDailyTrades.maxDailyTrades },
      riskReward: { isActive: configurationData.riskReward.isActive, type: configurationData.riskReward.type, riskRewardRatio: configurationData.riskReward.riskRewardRatio },
      riskPerTrade: { isActive: configurationData.riskPerTrade.isActive, type: configurationData.riskPerTrade.type, maxRiskPerTrade: configurationData.riskPerTrade.maxRiskPerTrade, maxRiskPercentage: configurationData.riskPerTrade.maxRiskPercentage, balance: configurationData.riskPerTrade.balance },
      daysAllowed: { isActive: configurationData.daysAllowed.isActive, type: configurationData.daysAllowed.type, tradingDays: configurationData.daysAllowed.tradingDays },
      assetsAllowed: { isActive: configurationData.assetsAllowed.isActive, type: configurationData.assetsAllowed.type, assetsAllowed: configurationData.assetsAllowed.assetsAllowed },
      hoursAllowed: { isActive: configurationData.hoursAllowed.isActive, type: configurationData.hoursAllowed.type, tradingOpenTime: configurationData.hoursAllowed.tradingOpenTime, tradingCloseTime: configurationData.hoursAllowed.tradingCloseTime, timezone: configurationData.hoursAllowed.timezone }
    };

    // Available Rules: Solo reglas NO activas (isActive = false)
    this.config = {
      maxDailyTrades: { isActive: !configurationData.maxDailyTrades.isActive, type: configurationData.maxDailyTrades.type, maxDailyTrades: configurationData.maxDailyTrades.maxDailyTrades },
      riskReward: { isActive: !configurationData.riskReward.isActive, type: configurationData.riskReward.type, riskRewardRatio: configurationData.riskReward.riskRewardRatio },
      riskPerTrade: { isActive: !configurationData.riskPerTrade.isActive, type: configurationData.riskPerTrade.type, maxRiskPerTrade: configurationData.riskPerTrade.maxRiskPerTrade, maxRiskPercentage: configurationData.riskPerTrade.maxRiskPercentage, balance: configurationData.riskPerTrade.balance },
      daysAllowed: { isActive: !configurationData.daysAllowed.isActive, type: configurationData.daysAllowed.type, tradingDays: configurationData.daysAllowed.tradingDays },
      assetsAllowed: { isActive: !configurationData.assetsAllowed.isActive, type: configurationData.assetsAllowed.type, assetsAllowed: configurationData.assetsAllowed.assetsAllowed },
      hoursAllowed: { isActive: !configurationData.hoursAllowed.isActive, type: configurationData.hoursAllowed.type, tradingOpenTime: configurationData.hoursAllowed.tradingOpenTime, tradingCloseTime: configurationData.hoursAllowed.tradingCloseTime, timezone: configurationData.hoursAllowed.timezone }
    };
  }

  /**
   * MÉTODO 2: Cargar configuración de estrategia
   * NUEVA LÓGICA SIMPLIFICADA:
   * 1. Obtener configuration-overview (metadatos)
   * 2. Obtener configurations (reglas)
   * 3. Analizar reglas: si todas están en false = tratar como nueva, si hay alguna en true = distribuir
   */
  async loadStrategyConfiguration() {
    if (!this.strategyId) return;
    
    try {
      // PASO 1: Obtener metadatos de la estrategia
      const overviewData = await this.strategySvc.getConfigurationOverview(this.strategyId);
      if (!overviewData) {
        console.error('No se encontró la estrategia');
        return;
      }
      
      // Actualizar mini card
      this.currentStrategyName = overviewData.name;
      this.lastModifiedText = this.formatDate(overviewData.updated_at.toDate());
      this.isFavorited = false;
      
      // PASO 2: Obtener reglas de la estrategia
      if (overviewData.configurationId) {
        const configurationData = await this.strategySvc.getConfigurationById(overviewData.configurationId);
        if (configurationData) {
          // PASO 3: Analizar reglas y distribuir según su estado
          this.analyzeAndDistributeRules(configurationData);
        } else {
          console.error('No se encontró la configuración de la estrategia');
          // Si no hay configuración, tratar como nueva estrategia
          this.initializeAsNewStrategy();
        }
      } else {
        console.error('La estrategia no tiene configurationId');
        // Si no hay configurationId, tratar como nueva estrategia
        this.initializeAsNewStrategy();
      }
    } catch (error) {
      console.error('Error loading strategy configuration:', error);
      // En caso de error, tratar como nueva estrategia
      this.initializeAsNewStrategy();
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
      console.warn('No user email or accounts available for fetching user key');
      this.store.dispatch(setUserKey({ userKey: '' }));
    }
  }

  loadInstruments(userKey: string, account: AccountData) {
    this.reportSvc.getAllInstruments(
      userKey, 
      account.accountNumber, 
      account.accountID
    ).subscribe({
      next: (instruments: Instrument[]) => {
        // Extraer solo los nombres de los instrumentos
        this.availableInstruments = instruments.map(instrument => instrument.name);
      },
      error: (err) => {
        console.error('Error loading instruments:', err);
        this.availableInstruments = [];
      }
    });
  }

  getActualBalance() {
    this.store
      .select(selectUserKey)
      .pipe()
      .subscribe({
        next: (userKey) => {
          if (userKey === '') {
            this.fetchUserKey();
          } else {
            // Use the first account's data dynamically
            if (this.accountsData.length > 0) {
              const firstAccount = this.accountsData[0];
              this.reportSvc.getBalanceData(firstAccount.accountID as string, userKey, firstAccount.accountNumber as number).subscribe({
                next: (balance) => {
                  this.loadConfig(balance);
                },
                error: (err) => {
                  console.error('Error fetching balance data', err);
                },
              });
            } else {
              console.warn('No accounts available for fetching balance');
              this.loadConfig(0);
            }
          }
        },
      });
  }

  getUserData() {
    this.store.select(selectUser).subscribe({
      next: (user) => {
        this.user = user.user;
        
        // Configurar listener de plugin history cuando el usuario esté disponible
        if (this.user?.id) {
          this.setupPluginHistoryListener();
        } else {
          console.warn('User ID not available yet');
        }
      },
      error: (err) => {
        console.error('Error fetching user data', err);
      },
    });
  }

  /**
   * MÉTODO NUEVO: Cargar balance e inicializar como nueva estrategia
   * FLUJO PARA NUEVA ESTRATEGIA:
   * 1. Obtener balance de la cuenta
   * 2. Cargar configuración por defecto con balance
   * 3. Inicializar paneles (Available = todas, My Choices = vacío)
   */
  loadBalanceAndInitialize() {
    this.store
      .select(selectUserKey)
      .pipe()
      .subscribe({
        next: (userKey) => {
          if (userKey === '') {
            this.fetchUserKey();
          } else {
            // Usar datos de la primera cuenta para obtener balance
            if (this.accountsData.length > 0) {
              const firstAccount = this.accountsData[0];
              this.reportSvc.getBalanceData(firstAccount.accountID as string, userKey, firstAccount.accountNumber as number).subscribe({
                next: (balance) => {
                  this.loadConfigWithBalance(balance);
                },
                error: (err) => {
                  console.error('Error fetching balance data', err);
                  this.loadConfigWithBalance(0);
                },
              });
            } else {
              console.warn('No accounts available for fetching balance');
              this.loadConfigWithBalance(0);
            }
          }
        },
      });
  }

  /**
   * MÉTODO NUEVO: Cargar configuración con balance
   * FLUJO ESPECÍFICO PARA NUEVA ESTRATEGIA:
   * 1. Cargar configuración por defecto con balance
   * 2. Inicializar paneles correctamente
   */
  loadConfigWithBalance(balance: number) {
    this.loading = true;
    this.strategySvc
      .getConfiguration(this.user?.id || '')
      .then((data) => {
        if (data) {
          const riskPerTradeBalance = {
            ...data.riskPerTrade,
            balance: balance,
          };

          // Cargar configuración por defecto con balance
          this.store.dispatch(
            resetConfig({
              config: { ...data, riskPerTrade: riskPerTradeBalance },
            })
          );
          
          // INICIALIZAR PANELES PARA NUEVA ESTRATEGIA
          this.initializePanelsForNewStrategy({ ...data, riskPerTrade: riskPerTradeBalance });
          this.loading = false;
        } else {
          // Usar configuración inicial con balance
          const initialConfigWithBalance = {
            ...initialStrategyState,
            riskPerTrade: {
              ...initialStrategyState.riskPerTrade,
              balance: balance
            }
          };
          this.store.dispatch(resetConfig({ config: initialConfigWithBalance }));
          
          // INICIALIZAR PANELES PARA NUEVA ESTRATEGIA
          this.initializePanelsForNewStrategy(initialConfigWithBalance);
          this.loading = false;
          console.warn('No config - using initial state');
        }
      })
      .catch((err) => {
        // Usar configuración inicial con balance en caso de error
        const initialConfigWithBalance = {
          ...initialStrategyState,
          riskPerTrade: {
            ...initialStrategyState.riskPerTrade,
            balance: balance
          }
        };
        this.store.dispatch(resetConfig({ config: initialConfigWithBalance }));
        
        // INICIALIZAR PANELES PARA NUEVA ESTRATEGIA
        this.initializePanelsForNewStrategy(initialConfigWithBalance);
        this.loading = false;
        console.error('Error to get the config', err);
      });
  }

  /**
   * MÉTODO NUEVO: Inicializar paneles para nueva estrategia
   * FLUJO PARA NUEVA ESTRATEGIA:
   * - Available Rules: Todas las reglas (isActive = true para mostrar)
   * - My Choices: Vacío (isActive = false)
   */
  initializePanelsForNewStrategy(configurationData: StrategyState) {
    // My Choices: Vacío (todas las reglas con isActive = false)
    this.myChoices = {
      maxDailyTrades: { isActive: false, type: configurationData.maxDailyTrades.type, maxDailyTrades: configurationData.maxDailyTrades.maxDailyTrades },
      riskReward: { isActive: false, type: configurationData.riskReward.type, riskRewardRatio: configurationData.riskReward.riskRewardRatio },
      riskPerTrade: { isActive: false, type: configurationData.riskPerTrade.type, maxRiskPerTrade: configurationData.riskPerTrade.maxRiskPerTrade, maxRiskPercentage: configurationData.riskPerTrade.maxRiskPercentage, balance: configurationData.riskPerTrade.balance },
      daysAllowed: { isActive: false, type: configurationData.daysAllowed.type, tradingDays: configurationData.daysAllowed.tradingDays },
      assetsAllowed: { isActive: false, type: configurationData.assetsAllowed.type, assetsAllowed: configurationData.assetsAllowed.assetsAllowed },
      hoursAllowed: { isActive: false, type: configurationData.hoursAllowed.type, tradingOpenTime: configurationData.hoursAllowed.tradingOpenTime, tradingCloseTime: configurationData.hoursAllowed.tradingCloseTime, timezone: configurationData.hoursAllowed.timezone }
    };

    // Available Rules: Todas las reglas (isActive = true para mostrar)
    this.config = {
      maxDailyTrades: { isActive: true, type: configurationData.maxDailyTrades.type, maxDailyTrades: configurationData.maxDailyTrades.maxDailyTrades },
      riskReward: { isActive: true, type: configurationData.riskReward.type, riskRewardRatio: configurationData.riskReward.riskRewardRatio },
      riskPerTrade: { isActive: true, type: configurationData.riskPerTrade.type, maxRiskPerTrade: configurationData.riskPerTrade.maxRiskPerTrade, maxRiskPercentage: configurationData.riskPerTrade.maxRiskPercentage, balance: configurationData.riskPerTrade.balance },
      daysAllowed: { isActive: true, type: configurationData.daysAllowed.type, tradingDays: configurationData.daysAllowed.tradingDays },
      assetsAllowed: { isActive: true, type: configurationData.assetsAllowed.type, assetsAllowed: configurationData.assetsAllowed.assetsAllowed },
      hoursAllowed: { isActive: true, type: configurationData.hoursAllowed.type, tradingOpenTime: configurationData.hoursAllowed.tradingOpenTime, tradingCloseTime: configurationData.hoursAllowed.tradingCloseTime, timezone: configurationData.hoursAllowed.timezone }
    };

  }

  /**
   * MÉTODO LEGACY: Cargar configuración (mantener para compatibilidad)
   * NOTA: Este método se mantiene pero ya no se usa en el flujo principal
   */
  loadConfig(balance: number) {
    this.loading = true;
    this.strategySvc
      .getConfiguration(this.user?.id || '')
      .then((data) => {
        if (data) {
          const riskPerTradeBalance = {
            ...data.riskPerTrade,
            balance: balance,
          };

          this.store.dispatch(
            resetConfig({
              config: { ...data, riskPerTrade: riskPerTradeBalance },
            })
          );
          this.loading = false;
        } else {
          this.store.dispatch(resetConfig({ config: initialStrategyState }));
          this.loading = false;
          console.warn('No config');
        }
      })
      .catch((err) => {
        this.store.dispatch(resetConfig({ config: initialStrategyState }));
        this.loading = false;
        console.error('Error to get the config', err);
      });
  }

  /**
   * MÉTODO 3: Escuchar cambios en el store de reglas
   * FLUJO SIMPLIFICADO:
   * - Solo escuchar cambios para actualizar la UI en tiempo real
   * - NO inicializar aquí, eso se hace en loadStrategyConfiguration
   */
  listenConfigurations() {
    this.store
      .select(allRules)
      .pipe()
      .subscribe((config) => {
        // SOLO escuchar cambios para actualizar la UI en tiempo real
        this.listenToStoreChanges();
      });
  }

  initializeMyChoices() {
    if (this.config) {
      this.myChoices = {
        maxDailyTrades: { isActive: this.config.maxDailyTrades.isActive, type: this.config.maxDailyTrades.type, maxDailyTrades: this.config.maxDailyTrades.maxDailyTrades },
        riskReward: { isActive: this.config.riskReward.isActive, type: this.config.riskReward.type, riskRewardRatio: this.config.riskReward.riskRewardRatio },
        riskPerTrade: { isActive: this.config.riskPerTrade.isActive, type: this.config.riskPerTrade.type, maxRiskPerTrade: this.config.riskPerTrade.maxRiskPerTrade, maxRiskPercentage: this.config.riskPerTrade.maxRiskPercentage, balance: this.config.riskPerTrade.balance },
        daysAllowed: { isActive: this.config.daysAllowed.isActive, type: this.config.daysAllowed.type, tradingDays: this.config.daysAllowed.tradingDays },
        assetsAllowed: { isActive: this.config.assetsAllowed.isActive, type: this.config.assetsAllowed.type, assetsAllowed: this.config.assetsAllowed.assetsAllowed },
        hoursAllowed: { isActive: this.config.hoursAllowed.isActive, type: this.config.hoursAllowed.type, tradingOpenTime: this.config.hoursAllowed.tradingOpenTime, tradingCloseTime: this.config.hoursAllowed.tradingCloseTime, timezone: this.config.hoursAllowed.timezone }
      };
    }
  }

  /**
   * MÉTODO 5: Escuchar cambios en tiempo real
   * FLUJO DE ACTUALIZACIÓN EN TIEMPO REAL:
   * - Cuando el usuario interactúa con las reglas, el store se actualiza
   * - Este método detecta esos cambios y actualiza la UI
   * - Las reglas se mueven automáticamente entre Available y My Choices
   */
  listenToStoreChanges() {
    this.config$.subscribe(config => {
      if (this.config && this.myChoices) {
        // Detectar cambios en las reglas y actualizar la UI
        this.updateMyChoicesFromConfig(config);
      }
    });
  }

  /**
   * MÉTODO 6: Actualizar UI en tiempo real
   * FLUJO DE ACTUALIZACIÓN DE UI:
   * - Cuando el usuario selecciona/deselecciona reglas, el store se actualiza
   * - Este método recrea los paneles basándose en el estado actual del store
   * - Las reglas se mueven automáticamente entre Available y My Choices
   * @param newConfig - Nueva configuración desde el store
   */
  updateMyChoicesFromConfig(newConfig: StrategyState) {
    if (!this.myChoices || !this.config) return;

    // ACTUALIZACIÓN EN TIEMPO REAL: Recrear paneles basándose en el store
    // My Choices: Solo las reglas que están activas en newConfig
    this.myChoices = {
      maxDailyTrades: { isActive: newConfig.maxDailyTrades.isActive, type: newConfig.maxDailyTrades.type, maxDailyTrades: newConfig.maxDailyTrades.maxDailyTrades },
      riskReward: { isActive: newConfig.riskReward.isActive, type: newConfig.riskReward.type, riskRewardRatio: newConfig.riskReward.riskRewardRatio },
      riskPerTrade: { isActive: newConfig.riskPerTrade.isActive, type: newConfig.riskPerTrade.type, maxRiskPerTrade: newConfig.riskPerTrade.maxRiskPerTrade, maxRiskPercentage: newConfig.riskPerTrade.maxRiskPercentage, balance: newConfig.riskPerTrade.balance },
      daysAllowed: { isActive: newConfig.daysAllowed.isActive, type: newConfig.daysAllowed.type, tradingDays: newConfig.daysAllowed.tradingDays },
      assetsAllowed: { isActive: newConfig.assetsAllowed.isActive, type: newConfig.assetsAllowed.type, assetsAllowed: newConfig.assetsAllowed.assetsAllowed },
      hoursAllowed: { isActive: newConfig.hoursAllowed.isActive, type: newConfig.hoursAllowed.type, tradingOpenTime: newConfig.hoursAllowed.tradingOpenTime, tradingCloseTime: newConfig.hoursAllowed.tradingCloseTime, timezone: newConfig.hoursAllowed.timezone }
    };

    // Available Rules: Solo las reglas que NO están activas en newConfig
    this.config = {
      maxDailyTrades: { isActive: !newConfig.maxDailyTrades.isActive, type: newConfig.maxDailyTrades.type, maxDailyTrades: newConfig.maxDailyTrades.maxDailyTrades },
      riskReward: { isActive: !newConfig.riskReward.isActive, type: newConfig.riskReward.type, riskRewardRatio: newConfig.riskReward.riskRewardRatio },
      riskPerTrade: { isActive: !newConfig.riskPerTrade.isActive, type: newConfig.riskPerTrade.type, maxRiskPerTrade: newConfig.riskPerTrade.maxRiskPerTrade, maxRiskPercentage: newConfig.riskPerTrade.maxRiskPercentage, balance: newConfig.riskPerTrade.balance },
      daysAllowed: { isActive: !newConfig.daysAllowed.isActive, type: newConfig.daysAllowed.type, tradingDays: newConfig.daysAllowed.tradingDays },
      assetsAllowed: { isActive: !newConfig.assetsAllowed.isActive, type: newConfig.assetsAllowed.type, assetsAllowed: newConfig.assetsAllowed.assetsAllowed },
      hoursAllowed: { isActive: !newConfig.hoursAllowed.isActive, type: newConfig.hoursAllowed.type, tradingOpenTime: newConfig.hoursAllowed.tradingOpenTime, tradingCloseTime: newConfig.hoursAllowed.tradingCloseTime, timezone: newConfig.hoursAllowed.timezone }
    };
  }

  saveStrategy() {
    // Verificar si se puede guardar (plugin no activo)
    if (!this.canSaveStrategy()) {
      alert('Cannot save strategy while plugin is active. Please deactivate the plugin first.');
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
        riskPerTrade: { isActive: this.myChoices.riskPerTrade.isActive, type: this.myChoices.riskPerTrade.type, maxRiskPerTrade: this.myChoices.riskPerTrade.maxRiskPerTrade, maxRiskPercentage: this.myChoices.riskPerTrade.maxRiskPercentage, balance: this.myChoices.riskPerTrade.balance },
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
          .then(() => {
            // Actualizar fecha de modificación en la mini card
            this.lastModifiedText = this.formatDate(new Date());
            alert('Strategy Updated');
            this.router.navigate(['/strategy']);
          })
          .catch((err) => {
            console.error('Update Error:', err);
            alert('Error Updating Strategy');
          })
          .finally(() => {
            this.loading = false;
            this.closeConfirmModal();
          });
      } else {
        // CASO B: Nueva estrategia - Crear en Firebase
        this.strategySvc
          .createStrategyView(this.user.id, this.currentStrategyName, newConfig)
          .then((strategyId) => {
            alert('Strategy Created');
            this.router.navigate(['/strategy']);
          })
          .catch((err) => {
            console.error('Create Error:', err);
            alert('Error Creating Strategy');
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
        // Actualizar nombre en configuration-overview
        await this.strategySvc.updateConfigurationOverview(this.strategyId, { 
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
      alert('Error updating strategy name');
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
    console.log('Strategy favorited:', this.isFavorited);
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

  /**
   * MÉTODO 8: Cargar plugin history y verificar si está activo
   * FLUJO DE VERIFICACIÓN:
   * - Cargar plugin history desde Firebase
   * - Verificar si algún plugin está activo
   * - Bloquear botón de guardar si está activo
   */
  setupPluginHistoryListener() {
    
    if (!this.user?.id) {
      console.warn('No user ID available for plugin history listener');
      return;
    }

    try {
      
      // Suscribirse al Observable del servicio con userId
      this.pluginSubscription = this.pluginHistoryService.getPluginHistoryRealtime(this.user.id).subscribe({
        next: (pluginHistory: PluginHistory[]) => {
          this.pluginHistory = pluginHistory;
          
          // Verificar si el plugin está activo (solo hay uno por usuario)
          if (pluginHistory.length > 0) {
            this.isPluginActive = pluginHistory[0].isActive === true;
          } else {
            // No hay plugin para este usuario
            this.isPluginActive = false;
            console.log('No plugin found for user');
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
    return !this.isPluginActive;
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

