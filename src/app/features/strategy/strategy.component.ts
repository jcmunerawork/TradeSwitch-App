import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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
import { allRules } from '../strategy/store/strategy.selectors';
import { selectNetPnL } from '../report/store/report.selectors';


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
export class Strategy implements OnInit {
  config: any = {};
  user: User | null = null;
  loading = false;
  
  // Plan detection and banner
  accountsData: AccountData[] = [];
  showPlanBanner = false;
  planBannerMessage = '';
  planBannerType = 'info'; // 'info', 'warning', 'success'
  
  // Upgrade modal
  showUpgradeModal = false;
  upgradeModalMessage = '';
  
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
    status: 'Active',
    lastModified: 'Never',
    rules: 0,
    timesApplied: 0,
    winRate: 0,
    isFavorite: false
  };

  constructor(
    private store: Store,
    private router: Router,
    private strategySvc: SettingsService,
    private reportSvc: ReportService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.getUserData();
    this.getActualBalance();
    this.listenConfigurations();
    this.fetchUserAccounts();
    this.listenReportData();
    this.loadUserStrategies();
  }

  fetchUserKey() {
    if (this.user?.email && this.accountsData.length > 0) {
      // Use the first account's credentials
      const firstAccount = this.accountsData[0];
      this.reportSvc
        .getUserKey(this.user.email, firstAccount.brokerPassword, firstAccount.server)
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
      },
      error: (err) => {
        console.error('Error fetching user data', err);
      },
    });
  }

  loadConfig(balance: number) {
    this.loading = true;
    
    // Primero intentar cargar la estrategia activa
    if (this.activeStrategy) {
      this.loadActiveStrategyConfig(balance);
      return;
    }

    // Si no hay estrategia activa, cargar desde configurations (compatibilidad)
    this.strategySvc
      .getConfiguration(this.user?.id || '')
      .then((configuration) => {
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
        this.checkPlanLimitations();
      })
      .catch((err) => {
        this.store.dispatch(resetConfig({ config: initialStrategyState }));
        this.loading = false;
        console.error('Error to get the config', err);
        this.checkPlanLimitations();
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

  onNewStrategy() {
    const currentPlan = this.determineUserPlan();
    const activeStrategies = this.getActiveStrategyCount();
    
    // Check plan limits
    let maxStrategies = 0;
    switch (currentPlan) {
      case 'Free':
        maxStrategies = 1;
        break;
      case 'Starter':
        maxStrategies = 3;
        break;
      case 'Pro':
        maxStrategies = 8;
        break;
    }
    
    // If user has reached the limit, show upgrade modal
    if (activeStrategies >= maxStrategies) {
      this.showUpgradeModal = true;
      this.upgradeModalMessage = `You've reached the strategy limit for your ${currentPlan} plan. Move to a higher plan and keep growing your account.`;
      return;
    }
    
    // If within limits, proceed to create new strategy
    console.log('Creating new strategy...');
    this.router.navigate(['/edit-strategy']);
  }

  // Strategy Card Event Handlers
  onStrategyEdit(strategyId: string) {
    this.router.navigate(['/edit-strategy'], { queryParams: { strategyId: strategyId } });
  }

  onStrategyFavorite(strategyId: string) {
    console.log('Toggle favorite for strategy:', strategyId);
    // TODO: Implementar funcionalidad de favoritos en la base de datos
    // Por ahora solo actualizar el estado local
    const strategy = this.userStrategies.find(s => (s as any).id === strategyId);
    if (strategy) {
      // Aquí se podría actualizar en la base de datos
      console.log('Strategy favorited:', strategy.name);
    }
  }

  onStrategyMoreOptions(strategyId: string) {
    console.log('More options for strategy:', strategyId);
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
    console.log('Customize strategy rules:', strategyId);
    this.router.navigate(['/edit-strategy'], { queryParams: { strategyId: strategyId } });
  }

  // Plan detection and banner methods
  fetchUserAccounts() {
    if (this.user?.id) {
      this.authService.getUserAccounts(this.user.id).then((accounts) => {
        this.accountsData = accounts || [];
        this.checkPlanLimitations();
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

  private determineUserPlan(): string {
    if (!this.user) return 'Free';
    
    // Check if user has subscription_date (indicates paid plan)
    if (this.user.subscription_date && this.user.subscription_date > 0) {
      if (this.user.status === 'purchased') {
        const accountCount = this.accountsData.length;
        const strategyCount = this.getActiveStrategyCount();
        
        // Pro Plan: 6 accounts, 8 strategies, or high usage indicators
        if (accountCount >= 6 || (accountCount >= 2 && this.user.number_trades > 100)) {
          return 'Pro';
        }
        // Starter Plan: 2 accounts, 3 strategies, or moderate usage
        else if (accountCount >= 2 || (accountCount >= 1 && this.user.number_trades > 20)) {
          return 'Starter';
        }
        // Free Plan: 1 account, 1 strategy
        else {
          return 'Free';
        }
      }
    }
    
    // Check if user has any trading activity
    if (this.user.number_trades && this.user.number_trades > 0) {
      const accountCount = this.accountsData.length;
      if (accountCount >= 2) {
        return 'Starter';
      }
    }
    
    return 'Free';
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

  private checkPlanLimitations() {
    const currentPlan = this.determineUserPlan();
    const activeStrategies = this.getActiveStrategyCount();
    
    this.showPlanBanner = false;
    this.planBannerMessage = '';
    this.planBannerType = 'info';

    switch (currentPlan) {
      case 'Free':
        if (activeStrategies >= 1) {
          this.showPlanBanner = true;
          this.planBannerMessage = 'You have reached your strategy limit on the Free plan. Want more? Upgrade anytime.';
          this.planBannerType = 'warning';
        }
        break;
        
      case 'Starter':
        if (activeStrategies >= 3) {
          this.showPlanBanner = true;
          this.planBannerMessage = 'You have reached your strategy limit on the Starter plan. Want more? Upgrade anytime.';
          this.planBannerType = 'warning';
        } else if (activeStrategies >= 2) {
          this.showPlanBanner = true;
          this.planBannerMessage = `You have ${3 - activeStrategies} strategies left on your current plan. Want more? Upgrade anytime.`;
          this.planBannerType = 'info';
        }
        break;
        
      case 'Pro':
        if (activeStrategies >= 8) {
          this.showPlanBanner = true;
          this.planBannerMessage = 'You have reached your strategy limit on the Pro plan. Contact support for custom solutions.';
          this.planBannerType = 'warning';
        } else if (activeStrategies >= 6) {
          this.showPlanBanner = true;
          this.planBannerMessage = `You have ${8 - activeStrategies} strategies left on your current plan. Want more? Upgrade anytime.`;
          this.planBannerType = 'info';
        }
        break;
    }
  }

  onUpgradePlan() {
    this.router.navigate(['/account']);
  }

  onCloseBanner() {
    this.showPlanBanner = false;
  }

  // Upgrade modal methods
  onCloseUpgradeModal() {
    this.showUpgradeModal = false;
  }

  onSeeUpgradeOptions() {
    this.showUpgradeModal = false;
    this.router.navigate(['/account']);
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
          status: strategy.status ? 'Active' : 'Inactive',
          lastModified: this.formatDate(strategy.updated_at.toDate()),
          rules: 0,
          timesApplied: strategy.days_active || 0,
          winRate: 0,
          isFavorite: false
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
      
      console.log('New strategy created:', strategyId);
    } catch (error) {
      console.error('Error creating strategy:', error);
      alert('Error creating strategy. Please try again.');
    }
  }

  // Activar una estrategia
  async activateStrategy(strategyId: string) {
    if (!this.user?.id) return;

    try {
      await this.strategySvc.activateStrategyView(this.user.id, strategyId);
      
      // Recargar estrategias (una sola llamada)
      await this.loadUserStrategies();
      
      // Recargar configuración con la nueva estrategia activa
      // Obtener balance desde la configuración actual
      const currentConfig = this.config;
      const balance = currentConfig?.riskPerTrade?.balance || 0;
      this.loadConfig(balance);
      
      console.log('Strategy activated:', strategyId);
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
      
      console.log('Strategy deleted:', strategyId);
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
      
      console.log('Strategy name updated:', strategyId);
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
        status: strategyData.overview.status ? 'Active' : 'Inactive', // Estado desde overview
        lastModified: lastModified, // updated_at formateado desde overview
        rules: activeRules, // Reglas activas de configuration
        timesApplied: strategyData.overview.days_active || 0, // days_active desde overview
        winRate: winRate, // Win rate (por implementar)
        isFavorite: this.strategyCard.isFavorite
      } as StrategyCardData;
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
          status: strategy.status ? 'Active' : 'Inactive',
          lastModified: this.formatDate(strategy.updated_at.toDate()),
          rules: 0,
          timesApplied: strategy.days_active || 0,
          winRate: 0,
          isFavorite: false
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
        status: strategyData.overview.status ? 'Active' : 'Inactive', // Estado desde overview
        lastModified: lastModified, // updated_at desde overview
        rules: activeRules, // Reglas activas de configuration
        timesApplied: strategyData.overview.days_active || 0, // days_active desde overview
        winRate: winRate, // Win rate (por implementar)
        isFavorite: false
      };

      return cardData;
    } catch (error) {
      console.error('Error getting strategy card data:', error);
      // Retornar datos básicos en caso de error
      return {
        id: (strategy as any).id,
        name: strategy.name,
        status: strategy.status ? 'Active' : 'Inactive',
        lastModified: this.formatDate(strategy.updated_at.toDate()),
        rules: 0,
        timesApplied: strategy.days_active || 0,
        winRate: 0,
        isFavorite: false
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
      
      console.log('Strategy copied:', newStrategyId);
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
