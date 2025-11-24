import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { isPlatformBrowser } from '@angular/common';
import { AccountData } from '../../features/auth/models/userModel';

/**
 * Service for trading account operations in Firebase.
 *
 * This service provides CRUD operations for trading accounts, including
 * creation, retrieval, updates, and deletion. It also includes validation
 * methods to check for duplicate emails and account IDs.
 *
 * Features:
 * - Create trading account
 * - Get user accounts
 * - Get all accounts
 * - Check if email exists (for validation)
 * - Check if account ID exists (for validation)
 * - Update account
 * - Delete account (returns userId for cache invalidation)
 *
 * Account Validation:
 * - Checks for duplicate email addresses across users
 * - Checks for duplicate account IDs across users
 * - Excludes current user's accounts from duplicate checks
 *
 * Data Structure:
 * - Stored in: `accounts/{accountId}`
 * - Contains: Account credentials, broker info, balance, trading stats
 *
 * Relations:
 * - Used by AuthService for account management
 * - Used by TradingAccountsComponent for account operations
 * - Used by CreateAccountPopupComponent for account creation
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class AccountsOperationsService {
  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const { firebaseApp } = require('../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);
    }
  }

  /**
   * Crear cuenta de trading
   */
  async createAccount(account: AccountData): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }
    await setDoc(doc(this.db, 'accounts', account.id), account);
  }

  /**
   * Obtener cuentas de un usuario
   */
  async getUserAccounts(userId: string): Promise<AccountData[] | null> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }
    const accountsCollection = collection(this.db, 'accounts');
    const q = query(accountsCollection, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const accounts: AccountData[] = [];
    querySnapshot.forEach((doc) => {
      accounts.push(doc.data() as AccountData);
    });
    return accounts.length > 0 ? accounts : null;
  }

  /**
   * Obtener todas las cuentas
   */
  async getAllAccounts(): Promise<AccountData[] | null> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }
    const accountsCollection = collection(this.db, 'accounts');
    const querySnapshot = await getDocs(accountsCollection);
    const accounts: AccountData[] = [];
    querySnapshot.forEach((doc) => {
      accounts.push(doc.data() as AccountData);
    });
    return accounts.length > 0 ? accounts : null;
  }

  /**
   * Verificar si un email de trading ya existe
   */
  async checkEmailExists(emailTradingAccount: string, currentUserId: string): Promise<boolean> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return false;
    }
    const accountsCollection = collection(this.db, 'accounts');
    const q = query(
      accountsCollection, 
      where('emailTradingAccount', '==', emailTradingAccount),
      where('userId', '!=', currentUserId) // Exclude current user's accounts
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty; // Returns true if email exists for another user
  }

  /**
   * Verificar si un accountID ya existe
   */
  async checkAccountIdExists(accountID: string, currentUserId: string): Promise<boolean> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return false;
    }
    const accountsCollection = collection(this.db, 'accounts');
    const q = query(
      accountsCollection, 
      where('accountID', '==', accountID),
      where('userId', '!=', currentUserId) // Exclude current user's accounts
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty; // Returns true if accountID exists for another user
  }

  /**
   * Actualizar cuenta
   */
  async updateAccount(accountId: string, accountData: AccountData): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }
    const accountDoc = doc(this.db, 'accounts', accountId);
    await updateDoc(accountDoc, {
      accountName: accountData.accountName,
      broker: accountData.broker,
      server: accountData.server,
      emailTradingAccount: accountData.emailTradingAccount,
      brokerPassword: accountData.brokerPassword,
      accountID: accountData.accountID,
      accountNumber: accountData.accountNumber,
      balance: accountData.balance,
      initialBalance: accountData.initialBalance,
      netPnl: accountData.netPnl,
      profit: accountData.profit,
      bestTrade: accountData.bestTrade,
    });
  }

  /**
   * Eliminar cuenta
   */
  async deleteAccount(accountId: string): Promise<string | null> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }
    
    // Obtener el userId antes de eliminar la cuenta
    const accountDoc = doc(this.db, 'accounts', accountId);
    const accountSnap = await getDoc(accountDoc);
    
    if (!accountSnap.exists()) {
      throw new Error('Account not found');
    }
    
    const accountData = accountSnap.data() as AccountData;
    const userId = accountData.userId || null;
    
    // Eliminar la cuenta
    await deleteDoc(accountDoc);
    
    // Retornar el userId para poder actualizar los conteos
    return userId;
  }

  /**
   * Verificar unicidad de cuenta (email y accountID)
   */
  async validateAccountUniqueness(emailTradingAccount: string, accountID: string, currentUserId: string): Promise<{ isValid: boolean; message: string }> {
    try {
      const [emailExists, accountIdExists] = await Promise.all([
        this.checkEmailExists(emailTradingAccount, currentUserId),
        this.checkAccountIdExists(accountID, currentUserId)
      ]);

      if (emailExists || accountIdExists) {
        return {
          isValid: false,
          message: 'This account is already registered, try with another account or delete this trade account first'
        };
      }

      return {
        isValid: true,
        message: 'Account creation/update successful'
      };
    } catch (error) {
      console.error('Error validating account uniqueness:', error);
      return {
        isValid: false,
        message: 'Error validating account uniqueness'
      };
    }
  }

  /**
   * Obtener el número total de cuentas de trading de un usuario
   */
  async getAllLengthUserAccounts(userId: string): Promise<number> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return 0;
    }

    try {
      const accountsCollection = collection(this.db, 'accounts');
      const q = query(accountsCollection, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error('Error getting accounts count:', error);
      return 0;
    }
  }

  /**
   * Verificar si existe una cuenta con la combinación broker + server + accountID
   */
  async checkAccountExists(broker: string, server: string, accountID: string, currentUserId: string): Promise<boolean> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return false;
    }

    try {
      const accountsRef = collection(this.db, 'accounts');
      const q = query(
        accountsRef,
        where('broker', '==', broker),
        where('server', '==', server),
        where('accountID', '==', accountID),
        where('userId', '!=', currentUserId) // Excluir la cuenta actual si estamos editando
      );
      
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking account existence:', error);
      return false;
    }
  }
}
