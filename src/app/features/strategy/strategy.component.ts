import { MaxDailyTradesComponent } from './components/max-daily-trades/max-daily-trades.component';
import { RiskRewardComponent } from './components/risk-reward/risk-reward.component';
import { RiskPerTradeComponent } from './components/risk-per-trade/risk-per-trade.component';
import { DaysAllowedComponent } from './components/days-allowed/days-allowed.component';
import { HoursAllowedComponent } from './components/hours-allowed/hours-allowed.component';
import { AssetsAllowedComponent } from './components/assets-allowed/assets-allowed.component';
import { Store } from '@ngrx/store';
import { allRules } from './store/strategy.selectors';
import { StrategyState } from './models/strategy.model';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../overview/models/overview';
import { selectUser } from '../auth/store/user.selectios';
import { SettingsService } from './service/strategy.service';
import { ReportService } from '../report/service/report.service';
import { selectUserKey, selectTradeWin, selectTotalTrades, selectNetPnL } from '../report/store/report.selectors';
import { setUserKey } from '../report/store/report.actions';
import { resetConfig } from './store/strategy.actions';
import { initialStrategyState } from './store/strategy.reducer';
import { TextInputComponent, StrategyCardComponent, StrategyCardData } from '../../shared/components';
import { AccountData } from '../auth/models/userModel';
import { AuthService } from '../auth/service/authService';

@Component({
  selector: 'app-strategy',
  imports: [
    CommonModule,
    MaxDailyTradesComponent,
    RiskRewardComponent,
    RiskPerTradeComponent,
    DaysAllowedComponent,
    HoursAllowedComponent,
    AssetsAllowedComponent,
    TextInputComponent,
    StrategyCardComponent,
  ],
  templateUrl: './strategy.component.html',
  styleUrl: './strategy.component.scss',
  standalone: true,
})
export class Strategy implements OnInit {
  config!: StrategyState;
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
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.getUserData();
    this.getActualBalance();
    this.listenConfigurations();
    this.fetchUserAccounts();
    this.listenReportData();
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
              this.reportSvc.getBalanceData(firstAccount.accountID, userKey, firstAccount.accountNumber).subscribe({
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
    this.strategySvc
      .getStrategyConfig(this.user?.id)
      .then((docSnap) => {
        if (docSnap && docSnap['exists']()) {
          const data = docSnap['data']() as StrategyState;
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
          this.checkPlanLimitations();
        } else {
          this.store.dispatch(resetConfig({ config: initialStrategyState }));
          this.loading = false;
          console.warn('No config');
          this.checkPlanLimitations();
        }
      })
      .catch((err) => {
        this.store.dispatch(resetConfig({ config: initialStrategyState }));
        this.loading = false;
        console.error('Error to get the config', err);
        this.checkPlanLimitations();
      });
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
    console.log('Search term:', value);
    // TODO: Implement search functionality
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
    console.log('Edit strategy name:', strategyId);
    // TODO: Implement edit strategy name functionality
    // This should open a modal or inline edit for the strategy name
  }

  onStrategyFavorite(strategyId: string) {
    console.log('Toggle favorite for strategy:', strategyId);
    this.strategyCard.isFavorite = !this.strategyCard.isFavorite;
  }

  onStrategyMoreOptions(strategyId: string) {
    console.log('More options for strategy:', strategyId);
    // TODO: Implement more options menu
  }

  onStrategyCustomize(strategyId: string) {
    console.log('Customize strategy rules:', strategyId);
    this.router.navigate(['/edit-strategy']);
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
    // Calculate win rate
    const winRate = this.totalTrades > 0 ? Math.round((this.tradeWin / this.totalTrades) * 100) : 0;
    
    // Count active rules
    const activeRules = this.config ? this.countActiveRules(this.config) : 0;
    
    // Get last modified date
    const lastModified = this.getLastModifiedDate();
    
    this.strategyCard = {
      id: '1',
      name: 'My Trading Strategy',
      status: 'Active',
      lastModified: lastModified,
      rules: activeRules,
      timesApplied: this.totalTrades,
      winRate: winRate,
      isFavorite: this.strategyCard.isFavorite
    };
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
      if (rule && rule.isActive) {
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
}
