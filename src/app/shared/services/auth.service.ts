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
import { BehaviorSubject, filter, Observable, Subscription as RxSubscription } from 'rxjs';
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
import { BackendApiService } from '../../core/services/backend-api.service';
import { SessionCookieService } from './session-cookie.service';
import { AccountStatusService } from './account-status.service';

/**
 * Authentication service for Firebase Auth and user management.
 *
 * This service provides comprehensive authentication functionality including
 * user registration, login (email/password, Google, Apple), logout, password
 * reset, and user data management. It also manages user plan subscriptions
 * and integrates with AppContextService for global state management.
 *
 * Features:
 * - User registration and login (email/password, Google, Apple)
 * - Logout functionality
 * - Password reset
 * - Authentication state observables
 * - User data CRUD operations
 * - Account management (trading accounts)
 * - Strategy management
 * - Token management (link tokens)
 * - User plan subscription management
 * - Global plans loading
 * - Real-time subscription listener
 *
 * Plan Management:
 * - Listens to user subscription changes
 * - Updates AppContextService with plan data
 * - Handles banned, cancelled, and active subscription states
 * - Loads global plans on authentication
 *
 * Relations:
 * - UsersOperationsService: User data operations
 * - AccountsOperationsService: Trading account operations
 * - StrategyOperationsService: Strategy operations
 * - TokensOperationsService: Link token operations
 * - SubscriptionService: Subscription management
 * - PlanService: Plan information
 * - AppContextService: Global state management
 *
 * @service
 * @injectable
 * @providedIn root
 */
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
    private subscriptionService: SubscriptionService,
    private backendApi: BackendApiService,
    private sessionCookie: SessionCookieService,
    private accountStatusService: AccountStatusService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (this.isBrowser) {
      onAuthStateChanged(getAuth(), async (user) => {
        this.authStateSubject.next(user !== null);
        if (user?.uid) {
          await this.startUserPlanListener(user.uid);
          // Conectar WebSocket y cargar cuentas para AccountStatus
          await this.connectAccountStatusService(user.uid);
        } else {
          this.stopUserPlanListener();
          this.appContext.setUserPlan(null);
          // Desconectar WebSocket cuando el usuario cierre sesión
          this.accountStatusService.disconnect();
        }
      });
    } else {
      this.authStateSubject.next(false);
    }
  }

  private subscriptionUnsubscribe: (() => void) | null = null;
  private accountsSubscription?: RxSubscription;

  /**
   * Connect to AccountStatus WebSocket service when user is authenticated
   * Solo se conecta si el usuario tiene cuentas en Firebase
   */
  private async connectAccountStatusService(userId: string): Promise<void> {
    try {
      // Get user accounts
      const accounts = await this.accountsOperationsService.getUserAccounts(userId);
      
      // Solo conectar si hay cuentas
      if (accounts && accounts.length > 0) {
        // Cargar balances de todas las cuentas después del login
        await this.loadAccountBalancesOnLogin(userId, accounts);
        
        // Conectar a streams
        this.accountStatusService.connect(userId, accounts);
      } else {
        return; // No conectar si no hay cuentas
      }

      // Subscribe to account changes to update backend
      this.accountsSubscription = this.appContext.userAccounts$.subscribe(accounts => {
        if (this.accountStatusService.isConnected() && accounts && accounts.length > 0) {
          this.accountStatusService.updateAccounts(accounts);
        }
      });
    } catch (error) {
      console.error('❌ AuthService: Error connecting AccountStatus service:', error);
      // No intentar conectar si hay error obteniendo cuentas
    }
  }

  /**
   * Cargar balances e instrumentos de todas las cuentas después del login
   * Llama a:
   * - GET /api/v1/tradelocker/balance/{accountId}?accNum={accNum} para cada cuenta
   * - GET /api/v1/tradelocker/instruments/{accountId}?accNum={accNum} para cada cuenta
   */
  private async loadAccountBalancesOnLogin(userId: string, accounts: AccountData[]): Promise<void> {
    try {
      // Obtener token de Firebase
      const auth = await import('firebase/auth');
      const { getAuth } = auth;
      const authInstance = getAuth();
      const user = authInstance.currentUser;
      
      if (!user) {
        console.warn('⚠️ AuthService: No hay usuario autenticado para cargar balances e instrumentos');
        return;
      }
      
      const idToken = await user.getIdToken();
      
      // Cargar balances e instrumentos en paralelo para todas las cuentas
      const accountPromises = accounts.map(async (account) => {
        try {
          if (!account.accountID || account.accountNumber === undefined) {
            console.warn(`⚠️ AuthService: Cuenta sin accountID o accountNumber, saltando:`, account);
            return;
          }
          
          // 1. Cargar balance
          const balanceResponse = await this.backendApi.getTradeLockerBalance(
            account.accountID,
            account.accountNumber,
            idToken
          );
          
          if (balanceResponse.success && balanceResponse.data) {
            // Extraer el balance (equity) de la respuesta
            // El backend puede devolver: response.data.equity, response.data.balance, o response.data.d.equity
            const balance = balanceResponse.data.equity 
              || balanceResponse.data.balance 
              || (balanceResponse.data.d && (balanceResponse.data.d.equity || balanceResponse.data.d.balance))
              || 0;
            
            // Actualizar balance en el contexto (account balance)
            // Usar accountID (Firebase ID) para actualizar el balance
            if (balance > 0 || balance === 0) { // Incluir 0 como valor válido
              this.appContext.updateAccountBalance(account.accountID, balance);
              
              // Actualizar balance en Firebase también
              try {
                const updatedAccount = {
                  ...account,
                  balance: balance
                };
                await this.accountsOperationsService.updateAccount(account.id, updatedAccount);
              } catch (error) {
                console.error(`❌ AuthService: Error actualizando balance en Firebase para cuenta ${account.accountID}:`, error);
                // No lanzar error, solo loguear - el balance ya está en el contexto
              }
            }
          } else {
            console.warn(`⚠️ AuthService: Respuesta de balance no exitosa para cuenta ${account.accountID}:`, balanceResponse);
          }
          
          // 2. Cargar instrumentos
          const instrumentsResponse = await this.backendApi.getTradeLockerAllInstruments(
            account.accountID,
            account.accountNumber,
            idToken
          );
          
          if (instrumentsResponse.success && instrumentsResponse.data) {
            // Extraer instrumentos de la respuesta
            // El backend puede devolver: response.data.instruments, response.data.d.instruments, o response.data directamente
            let instruments = instrumentsResponse.data.instruments 
              || instrumentsResponse.data.d?.instruments 
              || (Array.isArray(instrumentsResponse.data) ? instrumentsResponse.data : []);
            
            // Guardar instrumentos en el contexto usando accountID (Firebase ID)
            if (Array.isArray(instruments) && instruments.length > 0) {
              this.appContext.setInstrumentsForAccount(account.accountID, instruments);
              
              // Guardar instrumentos en localStorage para uso en reglas de estrategia
              if (this.isBrowser) {
                try {
                  const instrumentNames = instruments
                    .map((inst: any) => inst.name || inst.localizedName)
                    .filter((name: string) => name && name.trim() !== '');
                  localStorage.setItem('tradeswitch_available_instruments', JSON.stringify(instrumentNames));
                } catch (error) {
                  console.error('❌ AuthService: Error guardando instrumentos en localStorage:', error);
                }
              }
            } else {
              console.warn(`⚠️ AuthService: No se encontraron instrumentos en la respuesta para cuenta ${account.accountID}`);
              console.warn(`⚠️ AuthService: Estructura completa de la respuesta:`, JSON.stringify(instrumentsResponse.data, null, 2));
            }
          } else {
            console.warn(`⚠️ AuthService: Respuesta de instrumentos no exitosa para cuenta ${account.accountID}:`, instrumentsResponse);
          }
        } catch (error) {
          console.error(`❌ AuthService: Error cargando balance/instrumentos para cuenta ${account.accountID}:`, error);
          // Continuar con las demás cuentas aunque una falle
        }
      });
      
      await Promise.all(accountPromises);
    } catch (error) {
      console.error('❌ AuthService: Error cargando balances después del login:', error);
    }
  }

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
  
  /**
   * Register a new user.
   * DEPRECATED: Usar backendApi.signup() directamente.
   * El backend maneja TODO: Firebase Auth creation, user document, link token, subscription.
   * Este método se mantiene solo para compatibilidad.
   */
  async register(user: UserCredentials) {
    // El backend ahora maneja todo el registro
    // Llamar al backend con datos mínimos (el componente debe pasar todos los datos)
    await this.backendApi.signup({
      email: user.email,
      password: user.password
    });
    
    // BackendApiService.signup ya hace sign in automáticamente, obtener el usuario actual
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not found after registration');
    }
    
    // Return user credential-like object for compatibility
    return {
      user: currentUser
    } as any;
  }
  
  /**
   * Login user.
   * Now uses backend API for authentication.
   * The backend verifies credentials and returns user data.
   * Maintains same interface as before but uses backend.
   * Saves session token in cookie for automatic login.
   */
  async login(user: UserCredentials) {
    // Call backend to login (backend handles credential verification)
    await this.backendApi.login({
      email: user.email,
      password: user.password
    });
    
    // BackendApiService.login already signs in to Firebase Auth, so get current user
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not found after login');
    }
    
    // Obtener token de Firebase Auth y guardarlo en cookie
    try {
      const idToken = await currentUser.getIdToken();
      this.sessionCookie.setSessionToken(idToken);
    } catch (error) {
      console.warn('Error saving session token to cookie:', error);
      // Continuar aunque falle guardar la cookie
    }
    
    // Return user credential-like object for compatibility
    return {
      user: currentUser
    } as any;
  }
  
  loginWithGoogle() { const provider = new GoogleAuthProvider(); return signInWithPopup(getAuth(), provider); }
  loginWithApple() { const provider = new OAuthProvider('apple.com'); return signInWithPopup(getAuth(), provider); }
  
  /**
   * Logout user.
   * Clears session cookie and signs out from Firebase Auth.
   */
  async logout() {
    // Limpiar cookie de sesión
    this.sessionCookie.clearSessionToken();
    // Cerrar sesión en Firebase Auth
    return getAuth().signOut();
  }

  /**
   * Verificar token de sesión en cookie y hacer login automático si es válido.
   * Este método se llama al iniciar la aplicación.
   * Si el login es exitoso, carga los datos del usuario en el contexto.
   */
  async checkSessionTokenAndAutoLogin(): Promise<boolean> {
    if (!this.isBrowser) return false;

    try {
      // Verificar si hay un token en la cookie
      const sessionToken = this.sessionCookie.getSessionToken();
      if (!sessionToken) {
        return false;
      }

      // Verificar primero si Firebase Auth ya tiene una sesión activa
      const auth = getAuth();
      let currentUser = auth.currentUser;

      // Si hay un usuario en Firebase Auth, verificar que el token sea válido
      if (currentUser) {
        try {
          // Verificar que el token actual sea válido
          const newToken = await currentUser.getIdToken(true); // Force refresh
          
          // Actualizar token en cookie
          this.sessionCookie.setSessionToken(newToken);
          
          // Cargar datos del usuario y actualizar contexto
          try {
            const userData = await this.getUserData(currentUser.uid);
            return true;
          } catch (error) {
            console.warn('Error loading user data after auto-login:', error);
            return true;
          }
        } catch (error) {
          // Token expirado o inválido, limpiar cookie
          this.sessionCookie.clearSessionToken();
          return false;
        }
      }

      // Si no hay usuario en Firebase Auth, verificar el token con el backend
      const response = await this.backendApi.login({
        idToken: sessionToken
      });

      if (response.success && response.data) {
        // El backend verifica el token, pero necesitamos que Firebase Auth tenga la sesión
        // Esperar un momento para que Firebase Auth se sincronice
        await new Promise(resolve => setTimeout(resolve, 500));
        
        currentUser = auth.currentUser;
        
        if (currentUser) {
          // Obtener nuevo token y actualizar cookie
          try {
            const newToken = await currentUser.getIdToken(true);
            this.sessionCookie.setSessionToken(newToken);
            
            // Cargar datos del usuario
            try {
              const userData = await this.getUserData(currentUser.uid);
              return true;
            } catch (error) {
              console.warn('Error loading user data after auto-login:', error);
              return true;
            }
          } catch (error) {
            this.sessionCookie.clearSessionToken();
            return false;
          }
        } else {
          // El backend aceptó el token pero Firebase Auth no tiene sesión
          // Esto puede pasar si el usuario cerró sesión manualmente
          // Limpiar cookie y requerir login manual
          this.sessionCookie.clearSessionToken();
          return false;
        }
      }

      // Si el backend rechazó el token, limpiar cookie
      this.sessionCookie.clearSessionToken();
      return false;
    } catch (error) {
      console.warn('Error checking session token:', error);
      // Si hay error, limpiar cookie por seguridad
      this.sessionCookie.clearSessionToken();
      return false;
    }
  }

  /**
   * Send password reset email.
   * Calls backend to verify user exists, then sends email via Firebase Auth.
   * Maintains same interface as before but uses backend for validation.
   */
  async sendPasswordReset(email: string): Promise<void> {
    // Verify user exists via backend
    await this.backendApi.forgotPassword(email);
    
    // Then send email via Firebase Auth (client-side)
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
    // Get token from Firebase Auth (still needed for backend API calls)
    // The backend will verify this token
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    const token = await currentUser.getIdToken();
    if (!token) throw new Error('Token not found');
    return token;
  }

  // Users collection operations
  /**
   * Get user data.
   * Now uses backend API but maintains same interface.
   * Implements caching to prevent too many requests (429 errors).
   */
  private userDataCache: Map<string, { user: User; timestamp: number }> = new Map();
  private readonly USER_DATA_CACHE_TTL = 5 * 60 * 1000; // 5 minutos - aumentado para evitar peticiones en navegación
  private pendingUserDataRequests = new Map<string, Promise<User>>();

  async getUserData(uid: string): Promise<User> {
    // Verificar si hay una petición pendiente para este usuario
    const pendingRequest = this.pendingUserDataRequests.get(uid);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Verificar caché
    const cached = this.userDataCache.get(uid);
    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp < this.USER_DATA_CACHE_TTL) {
        // Caché válido, retornar datos en caché
        this.appContext.setCurrentUser(cached.user);
        return cached.user;
      }
      // Caché expirado, limpiar
      this.userDataCache.delete(uid);
    }

    // Crear nueva petición
    const request = this.fetchUserData(uid);
    this.pendingUserDataRequests.set(uid, request);

    try {
      const result = await request;
      return result;
    } finally {
      // Limpiar petición pendiente
      this.pendingUserDataRequests.delete(uid);
    }
  }

  /**
   * Realizar la petición HTTP para obtener los datos del usuario
   */
  private async fetchUserData(uid: string): Promise<User> {
    this.appContext.setLoading('user', true);
    this.appContext.setError('user', null);
    try {
      // Get ID token from Firebase Auth
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      const idToken = await currentUser.getIdToken();
      
      // Call backend to get user data
      const response = await this.backendApi.getCurrentUser(idToken);
      
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to get user data');
      }
      
      const userData = response.data.user as User;
      
      // Actualizar conteos de trading_accounts y strategies
      await this.updateUserCounts(uid);
      
      // En lugar de hacer otra petición, actualizar los datos localmente
      // ya que updateUserCounts solo actualiza los conteos en el backend
      const updatedUserData: User = {
        ...userData,
        trading_accounts: userData.trading_accounts || 0,
        strategies: userData.strategies || 0
      };
      
      // Guardar en caché
      this.userDataCache.set(uid, { user: updatedUserData, timestamp: Date.now() });
      
      this.appContext.setCurrentUser(updatedUserData);
      this.appContext.setLoading('user', false);
      return updatedUserData;
    } catch (error: any) {
      this.appContext.setLoading('user', false);
      this.appContext.setError('user', 'Error al obtener datos del usuario');
      
      // En caso de error 429, intentar usar caché si existe (aunque esté expirado)
      if (error?.status === 429 || (error?.error && error.error.status === 429)) {
        const cached = this.userDataCache.get(uid);
        if (cached) {
          console.warn('Rate limit exceeded (429) for getCurrentUser, returning cached data');
          this.appContext.setCurrentUser(cached.user);
          return cached.user;
        }
      }
      
      throw error;
    }
  }

  /**
   * Obtener datos del usuario con opción de forzar refresh
   * @param uid ID del usuario
   * @param forceRefresh Si es true, ignora el caché y hace petición HTTP
   */
  async refreshUserData(uid: string, forceRefresh: boolean = false): Promise<User> {
    if (forceRefresh) {
      this.invalidateUserDataCache(uid);
    }
    return this.getUserData(uid);
  }

  /**
   * Invalidar caché de datos del usuario
   * Útil después de actualizar datos del usuario
   */
  invalidateUserDataCache(uid: string): void {
    this.userDataCache.delete(uid);
    this.pendingUserDataRequests.delete(uid);
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.usersOperationsService.getUserById(userId);
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<void> {
    await this.usersOperationsService.updateUser(userId, userData);
    // Invalidar caché después de actualizar datos del usuario
    this.invalidateUserDataCache(userId);
  }

  /**
   * Create user document in Firestore.
   * Now handled by backend during signup, but kept for compatibility.
   */
  async createUser(user: User) { 
    // User creation is now handled by backend during signup
    // This method is kept for compatibility but may not be needed
    return this.usersOperationsService.createUser(user); 
  }
  
  /**
   * Create link token.
   * Now handled by backend during signup, but kept for compatibility.
   */
  async createLinkToken(token: LinkToken) { 
    // Token creation is now handled by backend during signup
    // This method is kept for compatibility but may not be needed
    return this.tokensOperationsService.createLinkToken(token); 
  }
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
      // Nota: updateUserCounts() ya invalida el caché automáticamente a través de updateUser()
      if (account.userId) {
        await this.updateUserCounts(account.userId);
      }
      
      // Cargar instrumentos para la nueva cuenta
      if (account.accountID && account.accountNumber !== undefined) {
        try {
          const auth = await import('firebase/auth');
          const { getAuth } = auth;
          const authInstance = getAuth();
          const user = authInstance.currentUser;
          
          if (user) {
            const idToken = await user.getIdToken();
            const instrumentsResponse = await this.backendApi.getTradeLockerAllInstruments(
              account.accountID,
              account.accountNumber,
              idToken
            );
            
            if (instrumentsResponse.success && instrumentsResponse.data) {
              let instruments = instrumentsResponse.data.instruments 
                || instrumentsResponse.data.d?.instruments 
                || (Array.isArray(instrumentsResponse.data) ? instrumentsResponse.data : []);
              
              if (Array.isArray(instruments) && instruments.length > 0) {
                this.appContext.setInstrumentsForAccount(account.accountID, instruments);
              }
            }
          }
        } catch (error) {
          console.error(`❌ AuthService: Error cargando instrumentos para nueva cuenta ${account.accountID}:`, error);
          // No lanzar error, solo loguear - la cuenta se creó exitosamente
        }
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
  async checkAccountExists(broker: string, server: string, accountID: string, currentUserId: string, excludeAccountId?: string): Promise<boolean> { 
    return this.accountsOperationsService.checkAccountExists(broker, server, accountID, currentUserId, excludeAccountId); 
  }
  async updateAccount(accountId: string, accountData: AccountData): Promise<void> { return this.accountsOperationsService.updateAccount(accountId, accountData); }
  async deleteAccount(accountId: string): Promise<void> {
    const userId = await this.accountsOperationsService.deleteAccount(accountId);
    
    // Actualizar conteos del usuario después de eliminar la cuenta
    // Nota: updateUserCounts() ya invalida el caché automáticamente a través de updateUser()
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
   * Este método ya invalida el caché porque llama a updateUser()
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
      // Nota: updateUser() ya invalida el caché automáticamente
    } catch (error) {
      console.error('Error updating user counts:', error);
    }
  }
}


