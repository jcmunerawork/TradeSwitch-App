import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
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
import { PlanBannerComponent } from '../../shared/components/plan-banner/plan-banner.component';
import { AppContextService } from '../../shared/context';

/**
 * Main component for managing trading accounts.
 *
 * This component provides functionality for viewing, adding, editing, and deleting
 * trading accounts. It also handles plan limitations, account balance fetching,
 * and displays plan banners when users approach or reach account limits.
 *
 * Features:
 * - Display all user trading accounts in a table
 * - Add new trading accounts (with plan limitation checks)
 * - Edit existing trading accounts
 * - Delete trading accounts with confirmation
 * - Fetch and display account balances from API
 * - Plan limitation detection and warnings
 * - Plan upgrade prompts
 *
 * Relations:
 * - AccountsTableComponent: Displays accounts in table format
 * - CreateAccountPopupComponent: Modal for adding/editing accounts
 * - PlanLimitationModalComponent: Modal for plan upgrade prompts
 * - PlanBannerComponent: Banner for plan limitation warnings
 * - AuthService: Account CRUD operations
 * - ReportService: Fetching account balances and user keys
 * - PlanLimitationsGuard: Checking plan limitations
 * - AppContextService: Global state management
 *
 * @component
 * @selector app-trading-accounts
 * @standalone true
 */
@Component({
  selector: 'app-trading-accounts',
  imports: [
    CommonModule,
    LoadingSpinnerComponent,
    FormsModule,
    AccountsTableComponent,
    CreateAccountPopupComponent,
    PlanLimitationModalComponent,
    PlanBannerComponent,
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
    private planLimitationsGuard: PlanLimitationsGuard,
    private appContext: AppContextService
  ) {}

  loading = false;
  usersData: AccountData[] = [];
  
  // Plan detection and modal
  showAddAccountModal = false;
  editMode = false;
  accountToEdit: AccountData | null = null;
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

  /**
   * Initializes the component on load.
   *
   * Subscribes to context data and store to get user information,
   * then loads configuration and account data.
   *
   * @memberof TradingAccountsComponent
   */
  ngOnInit(): void {
    // Suscribirse a los datos del contexto
    this.subscribeToContextData();
    
    this.store.select(selectUser).subscribe((userState) => {
      this.user = userState?.user ?? null;
      this.loadConfig();
    });
  }

  /**
   * Subscribes to data from AppContextService.
   *
   * Listens to changes in:
   * - Current user
   * - User accounts
   * - Loading states
   * - Error states
   *
   * Related to:
   * - AppContextService: Global state management
   *
   * @private
   * @memberof TradingAccountsComponent
   */
  private subscribeToContextData() {
    // Suscribirse a los datos del usuario
    this.appContext.currentUser$.subscribe(user => {
      this.user = user;
    });

    // Suscribirse a las cuentas del usuario
    this.appContext.userAccounts$.subscribe(accounts => {
      this.usersData = accounts;
    });

    // Suscribirse a los estados de carga
    this.appContext.isLoading$.subscribe(loading => {
      this.loading = loading.accounts;
    });

    // Suscribirse a los errores
    this.appContext.errors$.subscribe(errors => {
      if (errors.accounts) {
        console.error('Error en cuentas:', errors.accounts);
      }
    });
  }

  /**
   * Loads initial configuration.
   *
   * Fetches user accounts and checks plan limitations.
   *
   * @memberof TradingAccountsComponent
   */
  loadConfig() {
    this.getUserAccounts();
    // this.checkPlanLimitations(); // Comentado temporalmente
  }

  /**
   * Fetches all trading accounts for the current user.
   *
   * Uses AuthService to get accounts from Firebase, then fetches
   * balance data for each account. Also checks account limitations
   * after loading.
   *
   * Related to:
   * - AuthService.getUserAccounts(): Fetches accounts from Firebase
   * - getBalanceForAccounts(): Fetches balances for all accounts
   * - checkAccountLimitations(): Checks plan limitations
   *
   * @memberof TradingAccountsComponent
   */
  getUserAccounts() {
    this.userSvc
      .getUserAccounts(this.user?.id || '')
      .then((docSnap) => {
        
        if (docSnap && docSnap.length > 0) {
          this.usersData = docSnap;
          // Don't set loading = false here, wait for balances to load
          this.getBalanceForAccounts();
        } else {
          this.usersData = [];
          this.loading = false; // No accounts, no balances to load
        }
        
        // Verificar limitaciones después de cargar las cuentas
        this.checkAccountLimitations();
      })
      .catch((err) => {
        this.loading = false;
        console.error('Error to get the config', err);
      });
  }

  /**
   * Fetches balance data for all accounts.
   *
   * Processes accounts sequentially, fetching user key and balance
   * for each account. Updates account balance property with real-time
   * data from the trading API.
   *
   * Related to:
   * - fetchUserKey(): Gets authentication token for each account
   * - getActualBalance(): Fetches balance from API
   * - ReportService: API communication
   *
   * @memberof TradingAccountsComponent
   */
  getBalanceForAccounts() {
    // Loading is already active from getUserAccounts, don't set it again
    from(this.usersData)
      .pipe(concatMap((account) => this.fetchUserKey(account)))
      .subscribe({
        next: () => {},
        complete: () => {
          this.loading = false; // Only set to false when balances are loaded
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

  /**
   * Fetches user authentication key for an account.
   *
   * Authenticates with trading account credentials and stores the key
   * in NgRx store, then fetches the actual balance for the account.
   *
   * Related to:
   * - ReportService.getUserKey(): Authenticates and gets token
   * - Store.dispatch(setUserKey()): Stores token in NgRx
   * - getActualBalance(): Fetches balance after authentication
   *
   * @param account - Trading account data with credentials
   * @returns Observable that completes when balance is fetched
   * @memberof TradingAccountsComponent
   */
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

  /**
   * Fetches actual balance for an account from the trading API.
   *
   * Uses the authentication key to fetch balance data and updates
   * the account's balance property.
   *
   * Related to:
   * - ReportService.getBalanceData(): Fetches balance from API
   *
   * @param key - User authentication token
   * @param account - Account to fetch balance for
   * @returns Observable that emits the account with updated balance
   * @memberof TradingAccountsComponent
   */
  getActualBalance(key: string, account: AccountData) {
    return this.reportSvc
      .getBalanceData(account.accountID, key, account.accountNumber)
      .pipe(
        concatMap((balanceData) => {
          // Guardar el balance en la cuenta
          account.balance = balanceData.balance || 0;
          return [account];
        })
      );
  }

  /**
   * Deletes a trading account.
   *
   * Removes the account from Firebase and reloads the account list.
   * Also checks plan limitations after deletion.
   *
   * Related to:
   * - AuthService.deleteAccount(): Deletes account from Firebase
   * - loadConfig(): Reloads accounts after deletion
   * - checkPlanLimitations(): Updates limitation status
   *
   * @param account - Account to delete
   * @memberof TradingAccountsComponent
   */
  deleteAccount(account: AccountData) {
    this.loading = true;
    this.userSvc
      .deleteAccount(account.id)
      .then(async () => {
        // Reload everything after deletion
        this.loadConfig();
        await this.checkPlanLimitations(); // Check plan limitations after deleting account
        this.usersData = [...this.usersData];
      })
      .catch((err) => {
        this.loading = false;
        console.error('Error deleting account', err);
      });
  }

  /**
   * Handles the add account button click.
   *
   * Checks plan limitations before allowing account creation.
   * If user has reached limit, shows upgrade modal or redirects to plan management.
   * If within limits, opens the add account modal.
   *
   * Related to:
   * - PlanLimitationsGuard.checkAccountCreationWithModal(): Checks if user can create account
   * - Router.navigate(): Redirects to plan management if needed
   *
   * @memberof TradingAccountsComponent
   */
  // Add account functionality
  async onAddAccount() {
    if (!this.user?.id) return;

    const currentAccountCount = this.usersData.length;
    const accessCheck = await this.planLimitationsGuard.checkAccountCreationWithModal(this.user.id, currentAccountCount);
    
    if (!accessCheck.canCreate) {
      // Check if user has Pro plan with maximum accounts (should disable button)
      const limitations = await this.planLimitationsGuard.checkUserLimitations(this.user.id);
      const isProPlanWithMaxAccounts = limitations.planName.toLowerCase().includes('pro') && 
                                      limitations.maxAccounts === 10 && 
                                      currentAccountCount >= 10;
      
      if (isProPlanWithMaxAccounts) {
        // Pro plan with maximum accounts: button should be disabled (do nothing)
        return;
      } else {
        // Other plans: redirect to account/plan-management
        this.router.navigate(['/account'], { 
          queryParams: { tab: 'plan' } 
        });
        return;
      }
    }
    
    // If within limits, show add account modal
    this.editMode = false;
    this.accountToEdit = null;
    this.showAddAccountModal = true;
  }

  /**
   * Handles editing an existing account.
   *
   * Opens the account creation modal in edit mode with the account data pre-filled.
   *
   * @param account - Account to edit
   * @memberof TradingAccountsComponent
   */
  // Edit account functionality
  onEditAccount(account: AccountData) {
    this.editMode = true;
    this.accountToEdit = account;
    this.showAddAccountModal = true;
  }

  // Modal methods
  onCloseAddAccountModal() {
    this.showAddAccountModal = false;
    this.editMode = false;
    this.accountToEdit = null;
  }

  onAccountCanceled() {
    this.showAddAccountModal = false;
    this.editMode = false;
    this.accountToEdit = null;
  }

  // Plan limitation modal methods
  onClosePlanLimitationModal() {
    this.planLimitationModal.showModal = false;
  }

  /**
   * Checks account limitations and updates button state.
   *
   * Determines if the "Add Account" button should be disabled based on
   * the user's plan and current account count. Also shows plan banners
   * when approaching or at limits.
   *
   * Related to:
   * - PlanLimitationsGuard.checkUserLimitations(): Gets plan limitations
   * - checkPlanLimitations(): Shows plan banners
   *
   * @memberof TradingAccountsComponent
   */
  // Check account limitations and update button state
  async checkAccountLimitations() {
    if (!this.user?.id) {
      this.isAddAccountDisabled = false; // Always active, will redirect if needed
      return;
    }

    try {
      const currentAccountCount = this.usersData.length;
      const limitations = await this.planLimitationsGuard.checkUserLimitations(this.user.id);
      
      // Only disable button for Pro plan with maximum accounts (10 accounts)
      const isProPlanWithMaxAccounts = limitations.planName.toLowerCase().includes('pro') && 
                                      limitations.maxAccounts === 10 && 
                                      currentAccountCount >= 10;
      
      this.isAddAccountDisabled = isProPlanWithMaxAccounts;
      
      // Show banner based on limitations
      await this.checkPlanLimitations();
    } catch (error) {
      console.error('Error checking account limitations:', error);
      this.isAddAccountDisabled = false; // Default to active
    }
  }

  /**
   * Checks plan limitations and displays appropriate banners.
   *
   * Determines if user needs subscription, is banned/cancelled, or has reached
   * account limits. Shows warning or info banners accordingly.
   *
   * Related to:
   * - PlanLimitationsGuard.checkUserLimitations(): Gets plan limitations
   *
   * @private
   * @memberof TradingAccountsComponent
   */
  // Plan detection and banner methods
  private async checkPlanLimitations() {
    if (!this.user?.id) {
      this.showPlanBanner = false;
      return;
    }

    try {
      // Get user's plan limitations from the guard
      const limitations = await this.planLimitationsGuard.checkUserLimitations(this.user.id);
      const currentAccountCount = this.usersData.length;
      
      this.showPlanBanner = false;
      this.planBannerMessage = '';
      this.planBannerType = 'info';

      // If user needs subscription or is banned/cancelled
      if (limitations.needsSubscription || limitations.isBanned || limitations.isCancelled) {
        this.showPlanBanner = true;
        this.planBannerMessage = this.getBlockedMessage(limitations);
        this.planBannerType = 'warning';
        return;
      }

      // Check if user has reached account limit
      if (currentAccountCount >= limitations.maxAccounts) {
        this.showPlanBanner = true;
        this.planBannerMessage = `You've reached the account limit for your ${limitations.planName} plan. Move to a higher plan and keep growing your account.`;
        this.planBannerType = 'warning';
      } else if (currentAccountCount >= limitations.maxAccounts - 1) {
        // Show warning when close to limit
        this.showPlanBanner = true;
        this.planBannerMessage = `You have ${limitations.maxAccounts - currentAccountCount} accounts left on your current plan. Want more? Upgrade anytime.`;
        this.planBannerType = 'info';
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
    this.router.navigate(['/account']);
  }

  onCloseBanner() {
    this.showPlanBanner = false;
  }

  /**
   * Handles account creation event from popup.
   *
   * Reloads account list and checks plan limitations after a new account is created.
   *
   * @param accountData - Created account data (not used, account already in Firebase)
   * @memberof TradingAccountsComponent
   */
  // Popup event handlers
  async onAccountCreated(accountData: any) {
    // Account is already created in Firebase by the popup component
    // Show loading and reload everything
    this.loading = true;
    this.loadConfig(); // Reload accounts
    await this.checkPlanLimitations();
  }

  async onAccountUpdated(accountData: any) {
    // Account is already updated in Firebase by the popup component
    // Show loading and reload everything
    this.loading = true;
    this.loadConfig(); // Reload accounts
    await this.checkPlanLimitations();
  }

}
