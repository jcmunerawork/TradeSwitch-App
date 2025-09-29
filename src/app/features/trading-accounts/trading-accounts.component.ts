import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { FormsModule } from '@angular/forms';
import { OverviewService } from '../overview/services/overview.service';
import { AccountsTableComponent } from './components/accounts-table/accounts-table.component';
import { User, UserStatus } from '../overview/models/overview';
import { AuthService } from '../auth/service/authService';
import { AccountComponent } from '../account/account.component';
import { selectUser } from '../auth/store/user.selectios';
import { AccountData } from '../auth/models/userModel';
import { ReportService } from '../report/service/report.service';
import { setUserKey } from '../report/store/report.actions';
import { concatMap, from, catchError, of } from 'rxjs';
import { CreateAccountPopupComponent } from '../../shared/components/create-account-popup/create-account-popup.component';
import { Router } from '@angular/router';
import { PlanLimitationsGuard } from '../../guards/plan-limitations.guard';
import { PlanLimitationModalData } from '../../shared/interfaces/plan-limitation-modal.interface';
import { PlanLimitationModalComponent } from '../../shared/components/plan-limitation-modal/plan-limitation-modal.component';

@Component({
  selector: 'app-trading-accounts',
  imports: [
    CommonModule,
    LoadingPopupComponent,
    FormsModule,
    AccountsTableComponent,
    CreateAccountPopupComponent,
    PlanLimitationModalComponent,
  ],
  templateUrl: './trading-accounts.component.html',
  styleUrl: './trading-accounts.component.scss',
  standalone: true,
})
export class TradingAccountsComponent {
  user: User | null = null;
  userKey: string = '';
  fromDate: string = '';
  toDate: string = '';

  constructor(
    private store: Store,
    private reportSvc: ReportService,
    private userSvc: AuthService,
    private router: Router,
    private planLimitationsGuard: PlanLimitationsGuard
  ) {}

  loading = false;
  usersData: AccountData[] = [];
  
  // Plan detection and modal
  showAddAccountModal = false;
  planLimitationModal: PlanLimitationModalData = {
    showModal: false,
    modalType: 'upgrade',
    title: '',
    message: '',
    primaryButtonText: '',
    onPrimaryAction: () => {}
  };

  // Button state
  isAddAccountDisabled = false;

  // Plan detection and banner
  showPlanBanner = false;
  planBannerMessage = '';
  planBannerType = 'info'; // 'info', 'warning', 'success'

  ngOnInit(): void {
    this.store.select(selectUser).subscribe((userState) => {
      this.user = userState?.user ?? null;
      this.loadConfig();
    });
  }

  loadConfig() {
    this.getUserAccounts();
    // this.checkPlanLimitations(); // Comentado temporalmente
  }

  getUserAccounts() {
    this.userSvc
      .getUserAccounts(this.user?.id || '')
      .then((docSnap) => {
        if (docSnap && docSnap.length > 0) {
          this.usersData = docSnap;
          this.loading = false;
          this.getBalanceForAccounts();
        } else {
          this.usersData = [];
          this.loading = false;
        }
        
        // Verificar limitaciones después de cargar las cuentas
        this.checkAccountLimitations();
      })
      .catch((err) => {
        this.loading = false;
        console.error('Error to get the config', err);
      });
  }

  getBalanceForAccounts() {
    this.loading = true;
    from(this.usersData)
      .pipe(concatMap((account) => this.fetchUserKey(account)))
      .subscribe({
        next: () => {},
        complete: () => {
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          console.error(
            'Error en el proceso de actualización de balances',
            err
          );
        },
      });
  }

  fetchUserKey(account: AccountData) {
    return this.reportSvc
      .getUserKey(
        account.emailTradingAccount,
        account.brokerPassword,
        account.server
      )
      .pipe(
        concatMap((key: string) => {
          this.store.dispatch(setUserKey({ userKey: key }));
          return this.getActualBalance(key, account);
        })
      );
  }

  getActualBalance(key: string, account: AccountData) {
    return this.reportSvc
      .getBalanceData(account.accountID, key, account.accountNumber)
      .pipe(
        concatMap((balance) => {
          account.balance = balance;
          return [account];
        })
      );
  }

  deleteAccount(account: AccountData) {
    this.loading = true;
    this.userSvc
      .deleteAccount(account.id)
      .then(() => {
        this.loading = false;
        this.loadConfig();
        this.checkPlanLimitations(); // Check plan limitations after deleting account
        this.usersData = [...this.usersData];
      })
      .catch((err) => {
        this.loading = false;
        console.error('Error deleting account', err);
      });
  }

  // Add account functionality
  async onAddAccount() {
    if (!this.user?.id || this.isAddAccountDisabled) return;

    const currentAccountCount = this.usersData.length;
    const accessCheck = await this.planLimitationsGuard.checkAccountCreationWithModal(this.user.id, currentAccountCount);
    
    if (!accessCheck.canCreate) {
      if (accessCheck.modalData) {
        this.planLimitationModal = accessCheck.modalData;
      }
      return;
    }
    
    // If within limits, show add account modal
    this.showAddAccountModal = true;
  }

  // Modal methods
  onCloseAddAccountModal() {
    this.showAddAccountModal = false;
  }

  onAccountCanceled() {
    this.showAddAccountModal = false;
  }

  // Plan limitation modal methods
  onClosePlanLimitationModal() {
    this.planLimitationModal.showModal = false;
  }

  // Check account limitations and update button state
  async checkAccountLimitations() {
    if (!this.user?.id) {
      this.isAddAccountDisabled = true;
      return;
    }

    try {
      const currentAccountCount = this.usersData.length;
      const accessCheck = await this.planLimitationsGuard.checkAccountCreationWithModal(this.user.id, currentAccountCount);
      
      this.isAddAccountDisabled = !accessCheck.canCreate;
      
      // Show banner based on limitations
      this.checkPlanLimitations();
    } catch (error) {
      console.error('Error checking account limitations:', error);
      this.isAddAccountDisabled = true;
    }
  }

  // Plan detection and banner methods
  private checkPlanLimitations() {
    const currentPlan = this.determineUserPlan();
    const currentAccountCount = this.usersData.length;
    
    this.showPlanBanner = false;
    this.planBannerMessage = '';
    this.planBannerType = 'info';

    switch (currentPlan) {
      case 'Free':
        if (currentAccountCount >= 1) {
          this.showPlanBanner = true;
          this.planBannerMessage = 'You have reached your account limit on the Free plan. Want more? Upgrade anytime.';
          this.planBannerType = 'warning';
        }
        break;
        
      case 'Starter':
        if (currentAccountCount >= 2) {
          this.showPlanBanner = true;
          this.planBannerMessage = 'You have reached your account limit on the Starter plan. Want more? Upgrade anytime.';
          this.planBannerType = 'warning';
        } else if (currentAccountCount >= 1) {
          this.showPlanBanner = true;
          this.planBannerMessage = `You have ${2 - currentAccountCount} accounts left on your current plan. Want more? Upgrade anytime.`;
          this.planBannerType = 'info';
        }
        break;
        
      case 'Pro':
        if (currentAccountCount >= 6) {
          this.showPlanBanner = true;
          this.planBannerMessage = 'You have reached your account limit on the Pro plan. Contact support for custom solutions.';
          this.planBannerType = 'warning';
        } else if (currentAccountCount >= 4) {
          this.showPlanBanner = true;
          this.planBannerMessage = `You have ${6 - currentAccountCount} accounts left on your current plan. Want more? Upgrade anytime.`;
          this.planBannerType = 'info';
        }
        break;
    }
  }

  private determineUserPlan(): string {
    if (!this.user) return 'Free';
    
    // Check if user has subscription_date (indicates paid plan)
    if (this.user.subscription_date && this.user.subscription_date > 0) {
      if (this.user.status === 'purchased') {
        const accountCount = this.usersData.length;
        
        // Pro Plan: 6 accounts, or high usage indicators
        if (accountCount >= 6 || (accountCount >= 2 && this.user.number_trades > 100)) {
          return 'Pro';
        }
        // Starter Plan: 2 accounts, or moderate usage
        else if (accountCount >= 2 || (accountCount >= 1 && this.user.number_trades > 20)) {
          return 'Starter';
        }
        // Free Plan: 1 account
        else {
          return 'Free';
        }
      }
    }
    
    // Check if user has any trading activity
    if (this.user.number_trades && this.user.number_trades > 0) {
      const accountCount = this.usersData.length;
      if (accountCount >= 2) {
        return 'Starter';
      }
    }
    
    return 'Free';
  }

  onUpgradePlan() {
    this.router.navigate(['/account']);
  }

  onCloseBanner() {
    this.showPlanBanner = false;
  }

  // Popup event handlers
  onAccountCreated(accountData: any) {
    // Account is already created in Firebase by the popup component
    // Just reload the accounts and check plan limitations
    this.loadConfig(); // Reload accounts
    this.checkPlanLimitations();
  }

}
