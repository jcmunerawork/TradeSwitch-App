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
  UserCredential,
} from 'firebase/auth';
import { BehaviorSubject, filter, first, Observable } from 'rxjs';
import { User } from '../../overview/models/overview';
import { auth } from '../../../firebase/firebase.init';
import { AccountData, UserCredentials } from '../models/userModel';
import { UsersOperationsService } from '../../../shared/services/users-operations.service';
import { AccountsOperationsService } from '../../../shared/services/accounts-operations.service';
import { TokensOperationsService, LinkToken } from '../../../shared/services/tokens-operations.service';
import { AppContextService } from '../../../shared/context';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private isBrowser: boolean;
  private authStateSubject = new BehaviorSubject<boolean | null>(null);
  authStateChanged = this.authStateSubject.asObservable();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private usersOperationsService: UsersOperationsService,
    private accountsOperationsService: AccountsOperationsService,
    private tokensOperationsService: TokensOperationsService,
    private appContext: AppContextService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (this.isBrowser) {
      onAuthStateChanged(getAuth(), (user) => {
        this.authStateSubject.next(user !== null);
      });
    } else {
      this.authStateSubject.next(false);
    }
  }

  getAuth() {
    return getAuth();
  }

  register(user: UserCredentials) {
    return createUserWithEmailAndPassword(getAuth(), user.email, user.password);
  }

  async getUserData(uid: String): Promise<User> {
    this.appContext.setLoading('user', true);
    this.appContext.setError('user', null);
    
    try {
      const userData = await this.usersOperationsService.getUserData(uid as string);
      this.appContext.setCurrentUser(userData);
      this.appContext.setLoading('user', false);
      return userData;
    } catch (error) {
      this.appContext.setLoading('user', false);
      this.appContext.setError('user', 'Error al obtener datos del usuario');
      throw error;
    }
  }

  async createLinkToken(token: LinkToken) {
    return this.tokensOperationsService.createLinkToken(token);
  }

  async createUser(user: User) {
    return this.usersOperationsService.createUser(user);
  }

  async createAccount(account: AccountData) {
    this.appContext.setLoading('accounts', true);
    this.appContext.setError('accounts', null);
    
    try {
      await this.accountsOperationsService.createAccount(account);
      // Actualizar contexto con la nueva cuenta
      this.appContext.addAccount(account);
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

  async getAllAccounts(): Promise<AccountData[] | null> {
    return this.accountsOperationsService.getAllAccounts();
  }

  async checkEmailExists(emailTradingAccount: string, currentUserId: string): Promise<boolean> {
    return this.accountsOperationsService.checkEmailExists(emailTradingAccount, currentUserId);
  }

  async checkAccountIdExists(accountID: string, currentUserId: string): Promise<boolean> {
    return this.accountsOperationsService.checkAccountIdExists(accountID, currentUserId);
  }

  async updateAccount(accountId: string, accountData: AccountData): Promise<void> {
    return this.accountsOperationsService.updateAccount(accountId, accountData);
  }

  async deleteAccount(accountId: string): Promise<void> {
    return this.accountsOperationsService.deleteAccount(accountId);
  }

  login(user: UserCredentials) {
    return signInWithEmailAndPassword(getAuth(), user.email, user.password);
  }

  loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(getAuth(), provider);
  }

  loginWithApple() {
    const provider = new OAuthProvider('apple.com');
    return signInWithPopup(getAuth(), provider);
  }

  logout() {
    return getAuth().signOut();
  }

  isAuthenticated(): Observable<boolean> {
    return this.authStateSubject
      .asObservable()
      .pipe(filter((state): state is boolean => state !== null));
  }

  /**
   * Obtiene el usuario autenticado actual
   * @returns Usuario autenticado o null si no está autenticado
   */
  getCurrentUser(): any {
    try {
      if (!this.isBrowser) {
        return null;
      }
      return getAuth().currentUser;
    } catch (error) {
      console.error('Error obteniendo usuario actual:', error);
      return null;
    }
  }

  /**
   * Obtiene un usuario por su ID
   * @param userId ID del usuario
   * @returns Promise con el usuario o null si no existe
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.usersOperationsService.getUserById(userId);
  }

  /**
   * Actualiza un usuario existente
   * @param userId ID del usuario
   * @param userData Datos actualizados del usuario
   * @returns Promise void
   */
  async updateUser(userId: string, userData: Partial<User>): Promise<void> {
    return this.usersOperationsService.updateUser(userId, userData);
  }

  async getBearerTokenFirebase(userId: string): Promise<string> {
    const token = await getAuth().currentUser?.getIdToken().then((token) => {
      return token;
    });
    if (!token) {
      throw new Error('Token not found');
    }
    return token;
  }
}
