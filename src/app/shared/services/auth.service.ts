import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { BehaviorSubject, filter, Observable } from 'rxjs';
import { AppContextService } from '../context';
import { PlanService, Plan } from './planService';
import { SubscriptionService, Subscription } from './subscription-service';
import { UserStatus } from '../../features/overview/models/overview';
import { UsersOperationsService } from './users-operations.service';
import { AccountsOperationsService } from './accounts-operations.service';
import { StrategyOperationsService } from './strategy-operations.service';
import { TokensOperationsService, LinkToken } from './tokens-operations.service';
import { User } from '../../features/overview/models/overview';
import { AccountData, UserCredentials } from '../../features/auth/models/userModel';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private isBrowser: boolean;
  private authStateSubject = new BehaviorSubject<boolean | null>(null);
  authStateChanged = this.authStateSubject.asObservable();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private usersOperationsService: UsersOperationsService,
    private accountsOperationsService: AccountsOperationsService,
    private strategyOperationsService: StrategyOperationsService,
    private tokensOperationsService: TokensOperationsService,
    private appContext: AppContextService,
    private planService: PlanService,
    private subscriptionService: SubscriptionService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (this.isBrowser) {
      onAuthStateChanged(getAuth(), async (user) => {
        this.authStateSubject.next(user !== null);
        if (user?.uid) {
          await this.startUserPlanListener(user.uid);
        } else {
          this.stopUserPlanListener();
          this.appContext.setUserPlan(null);
        }
      });
    } else {
      this.authStateSubject.next(false);
    }
  }

  private subscriptionUnsubscribe: (() => void) | null = null;

  private async startUserPlanListener(userId: string): Promise<void> {
    this.stopUserPlanListener();
    
    // Cargar planes globales si no están cargados
    await this.loadGlobalPlansIfNeeded();
    
    this.subscriptionUnsubscribe = this.subscriptionService.listenToUserLatestSubscription(
      userId,
      async (subscription) => {
        await this.updateUserPlanFromSubscription(subscription);
      }
    );
  }

  private stopUserPlanListener(): void {
    if (this.subscriptionUnsubscribe) {
      this.subscriptionUnsubscribe();
      this.subscriptionUnsubscribe = null;
    }
  }

  private async loadGlobalPlansIfNeeded(): Promise<void> {
    // Verificar si los planes globales ya están cargados
    const currentPlans = this.appContext.globalPlans();
    if (currentPlans.length > 0) {
      return;
    }

    try {
      const plans = await this.planService.getAllPlans();
      this.appContext.setGlobalPlans(plans);
    } catch (error) {
      console.error('❌ Error cargando planes globales:', error);
    }
  }

  private async updateUserPlanFromSubscription(subscription: Subscription | null): Promise<void> {
    try {
      if (!subscription) {
        this.appContext.setUserPlan(null);
        return;
      }

      const status = subscription.status;

      // Estado baneado: bloquear uso
      if (status === UserStatus.BANNED) {
        this.appContext.setUserPlan({
          planId: subscription.planId,
          planName: 'Banned',
          maxAccounts: 0,
          maxStrategies: 0,
          features: [],
          isActive: false,
          expiresAt: subscription.periodEnd ? (subscription.periodEnd as any).toMillis?.() ?? undefined : undefined,
          // extensiones opcionales
          status: UserStatus.BANNED,
          price: '0'
        } as any);
        return;
      }

      // Estado cancelado: plan Free
      if (status === UserStatus.CANCELLED) {
        this.appContext.setUserPlan({
          planId: 'free',
          planName: 'Free',
          maxAccounts: 1,
          maxStrategies: 1,
          features: [],
          isActive: true,
          status: UserStatus.CANCELLED,
          price: '0'
        } as any);
        return;
      }

      // Activo: cargar plan y mapear límites
      const plan: Plan | undefined = await this.planService.getPlanById(subscription.planId);
      if (!plan) {
        // Si el plan no existe, tratar como sin plan
        this.appContext.setUserPlan(null);
        return;
      }

      this.appContext.setUserPlan({
        planId: plan.id,
        planName: plan.name,
        maxAccounts: plan.tradingAccounts ?? 1,
        maxStrategies: plan.strategies ?? 1,
        features: [],
        isActive: true,
        status,
        price: plan.price
      } as any);
    } catch (error) {
      console.error('Error actualizando user plan desde subscription:', error);
      this.appContext.setUserPlan(null);
    }
  }

  // Firebase Auth primitives
  getAuth() { return getAuth(); }
  register(user: UserCredentials) { return createUserWithEmailAndPassword(getAuth(), user.email, user.password); }
  login(user: UserCredentials) { return signInWithEmailAndPassword(getAuth(), user.email, user.password); }
  loginWithGoogle() { const provider = new GoogleAuthProvider(); return signInWithPopup(getAuth(), provider); }
  loginWithApple() { const provider = new OAuthProvider('apple.com'); return signInWithPopup(getAuth(), provider); }
  logout() { return getAuth().signOut(); }

  async sendPasswordReset(email: string): Promise<void> {
    const { sendPasswordResetEmail } = await import('firebase/auth');
    return sendPasswordResetEmail(getAuth(), email);
  }

  // Observabilidad de sesión
  isAuthenticated(): Observable<boolean> {
    return this.authStateSubject.asObservable().pipe(filter((state): state is boolean => state !== null));
  }

  getCurrentUser(): any {
    try {
      if (!this.isBrowser) return null;
      return getAuth().currentUser;
    } catch (error) {
      console.error('Error obteniendo usuario actual:', error);
      return null;
    }
  }

  async getBearerTokenFirebase(userId: string): Promise<string> {
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) throw new Error('Token not found');
    return token;
  }

  // Users collection operations
  async getUserData(uid: string): Promise<User> {
    this.appContext.setLoading('user', true);
    this.appContext.setError('user', null);
    try {
      const userData = await this.usersOperationsService.getUserData(uid);
      
      // Actualizar conteos de trading_accounts y strategies
      await this.updateUserCounts(uid);
      
      // Obtener nuevamente los datos actualizados después de actualizar los conteos
      const updatedUserData = await this.usersOperationsService.getUserData(uid);
      
      this.appContext.setCurrentUser(updatedUserData);
      this.appContext.setLoading('user', false);
      return updatedUserData;
    } catch (error) {
      this.appContext.setLoading('user', false);
      this.appContext.setError('user', 'Error al obtener datos del usuario');
      throw error;
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.usersOperationsService.getUserById(userId);
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<void> {
    return this.usersOperationsService.updateUser(userId, userData);
  }

  async createUser(user: User) { return this.usersOperationsService.createUser(user); }
  async createLinkToken(token: LinkToken) { return this.tokensOperationsService.createLinkToken(token); }
  async deleteLinkToken(tokenId: string) { return this.tokensOperationsService.deleteLinkToken(tokenId); }
  async deleteUser(userId: string) { return this.usersOperationsService.deleteUser(userId); }

  // Accounts operations
  async createAccount(account: AccountData) {
    this.appContext.setLoading('accounts', true);
    this.appContext.setError('accounts', null);
    try {
      await this.accountsOperationsService.createAccount(account);
      this.appContext.addAccount(account);
      
      // Actualizar conteos del usuario
      if (account.userId) {
        await this.updateUserCounts(account.userId);
      }
      
      this.appContext.setLoading('accounts', false);
    } catch (error) {
      this.appContext.setLoading('accounts', false);
      this.appContext.setError('accounts', 'Error al crear cuenta');
      throw error;
    }
  }

  async getUserAccounts(userId: string): Promise<AccountData[] | null> {
    this.appContext.setLoading('accounts', true);
    this.appContext.setError('accounts', null);
    try {
      const accounts = await this.accountsOperationsService.getUserAccounts(userId);
      this.appContext.setUserAccounts(accounts || []);
      this.appContext.setLoading('accounts', false);
      return accounts;
    } catch (error) {
      this.appContext.setLoading('accounts', false);
      this.appContext.setError('accounts', 'Error al obtener cuentas del usuario');
      throw error;
    }
  }

  async getAllAccounts(): Promise<AccountData[] | null> { return this.accountsOperationsService.getAllAccounts(); }
  async checkEmailExists(emailTradingAccount: string, currentUserId: string): Promise<boolean> { return this.accountsOperationsService.checkEmailExists(emailTradingAccount, currentUserId); }
  async checkAccountIdExists(accountID: string, currentUserId: string): Promise<boolean> { return this.accountsOperationsService.checkAccountIdExists(accountID, currentUserId); }
  async checkAccountExists(broker: string, server: string, accountID: string, currentUserId: string): Promise<boolean> { return this.accountsOperationsService.checkAccountExists(broker, server, accountID, currentUserId); }
  async updateAccount(accountId: string, accountData: AccountData): Promise<void> { return this.accountsOperationsService.updateAccount(accountId, accountData); }
  async deleteAccount(accountId: string): Promise<void> {
    const userId = await this.accountsOperationsService.deleteAccount(accountId);
    
    // Actualizar conteos del usuario después de eliminar la cuenta
    if (userId) {
      await this.updateUserCounts(userId);
    }
  }

  // Verificar si un email de usuario ya está registrado
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await this.usersOperationsService.getUserByEmail(email);
    } catch (error) {
      console.error('Error checking if email exists:', error);
      return null;
    }
  }

  // Método para obtener datos del usuario para validaciones (cuentas y estrategias)
  async getUserDataForValidation(userId: string): Promise<{
    accounts: AccountData[];
    strategies: any[];
  }> {
    try {
      const [accounts, strategies] = await Promise.all([
        this.accountsOperationsService.getUserAccounts(userId),
        this.strategyOperationsService.getUserStrategyViews(userId)
      ]);

      return {
        accounts: accounts || [],
        strategies: strategies || []
      };
    } catch (error) {
      console.error('Error getting user data for validation:', error);
      return {
        accounts: [],
        strategies: []
      };
    }
  }

  /**
   * Actualizar los conteos de trading_accounts y strategies del usuario
   */
  async updateUserCounts(userId: string): Promise<void> {
    try {
      const [tradingAccountsCount, strategiesCount] = await Promise.all([
        this.accountsOperationsService.getAllLengthUserAccounts(userId),
        this.strategyOperationsService.getAllLengthConfigurationsOverview(userId)
      ]);

      await this.updateUser(userId, {
        trading_accounts: tradingAccountsCount,
        strategies: strategiesCount
      });
    } catch (error) {
      console.error('Error updating user counts:', error);
    }
  }
}


