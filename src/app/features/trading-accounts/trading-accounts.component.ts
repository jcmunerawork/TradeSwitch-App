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

@Component({
  selector: 'app-trading-accounts',
  imports: [
    CommonModule,
    LoadingPopupComponent,
    FormsModule,
    AccountsTableComponent,
    CreateAccountPopupComponent,
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
    private userSvc: AuthService
  ) {}

  loading = false;
  usersData: AccountData[] = [];
  
  // Plan detection and modal
  showAddAccountModal = false;
  showUpgradeModal = false;
  upgradeModalMessage = '';

  ngOnInit(): void {
    this.store.select(selectUser).subscribe((userState) => {
      this.user = userState?.user ?? null;
      this.loadConfig();
    });
  }

  loadConfig() {
    this.getUserAccounts();
    this.checkPlanLimitations();
  }

  getUserAccounts() {
    this.userSvc
      .getUserAccounts(this.user?.id || '')
      .then((docSnap) => {
        if (docSnap && docSnap.length > 0) {
          this.usersData = docSnap;
          this.loading = false;
          this.getBalanceForAccounts();
          console.log('Accounts loaded', this.usersData);
        } else {
          this.usersData = [];
          this.loading = false;
          console.warn('No config');
        }
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
  onAddAccount() {
    const currentPlan = this.determineUserPlan();
    const currentAccountCount = this.usersData.length;
    
    // Check plan limits
    let maxAccounts = 0;
    switch (currentPlan) {
      case 'Free':
        maxAccounts = 1;
        break;
      case 'Starter':
        maxAccounts = 2;
        break;
      case 'Pro':
        maxAccounts = 6;
        break;
    }
    
    // If user has reached the limit, show upgrade modal
    if (currentAccountCount >= maxAccounts) {
      this.showUpgradeModal = true;
      this.upgradeModalMessage = `You've reached the account limit for your ${currentPlan} plan. Move to a higher plan and keep growing your account.`;
      return;
    }
    
    // If within limits, show add account modal
    this.showAddAccountModal = true;
  }

  // Plan detection methods
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

  private checkPlanLimitations() {
    const currentPlan = this.determineUserPlan();
    const currentAccountCount = this.usersData.length;
    
    // Check plan limits
    let maxAccounts = 0;
    switch (currentPlan) {
      case 'Free':
        maxAccounts = 1;
        break;
      case 'Starter':
        maxAccounts = 2;
        break;
      case 'Pro':
        maxAccounts = 6;
        break;
    }
    
    // Show banner if user is at or near the limit
    if (currentAccountCount >= maxAccounts) {
      this.showUpgradeModal = true;
      this.upgradeModalMessage = `You've reached the account limit for your ${currentPlan} plan. Move to a higher plan and keep growing your account.`;
    } else if (currentAccountCount >= maxAccounts - 1 && currentPlan !== 'Pro') {
      // Show warning when approaching limit (except for Pro plan)
      this.showUpgradeModal = true;
      this.upgradeModalMessage = `You're approaching the account limit for your ${currentPlan} plan. Consider upgrading to add more accounts.`;
    } else {
      this.showUpgradeModal = false;
    }
  }

  // Modal methods
  onCloseAddAccountModal() {
    this.showAddAccountModal = false;
  }

  onAccountCanceled() {
    this.showAddAccountModal = false;
  }

  onCloseUpgradeModal() {
    this.showUpgradeModal = false;
  }

  onSeeUpgradeOptions() {
    this.showUpgradeModal = false;
    // Navigate to account settings
    window.location.href = '/account';
  }

  // Popup event handlers
  onAccountCreated(accountData: any) {
    // Create new account data with proper structure
    const newAccountData: AccountData = {
      id: Date.now().toString(),
      userId: accountData.userId,
      accountName: accountData.accountName,
      server: accountData.server,
      balance: accountData.balance || 0,
      accountID: accountData.accountID,
      accountNumber: accountData.accountNumber,
      emailTradingAccount: accountData.emailTradingAccount,
      brokerPassword: accountData.brokerPassword,
      createdAt: accountData.createdAt,
    };

    // Save to Firebase accounts collection
    this.userSvc.createAccount(newAccountData)
      .then(() => {
        this.loadConfig(); // Reload accounts
        this.checkPlanLimitations(); // Check plan limitations after creating account
        console.log('Account created successfully in accounts collection');
      })
      .catch((error) => {
        console.error('Error creating account:', error);
        alert('Error creating account. Please try again.');
      });
  }

}
