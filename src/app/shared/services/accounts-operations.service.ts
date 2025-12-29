import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { isPlatformBrowser } from '@angular/common';
import { AccountData } from '../../features/auth/models/userModel';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

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

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private backendApi: BackendApiService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const { firebaseApp } = require('../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);
    }
  }

  /**
   * Get Firebase ID token for backend API calls
   */
  private async getIdToken(): Promise<string> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return await currentUser.getIdToken();
  }

  /**
   * Crear cuenta de trading
   * Now uses backend API but maintains same interface
   */
  async createAccount(account: AccountData): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.createAccount(account, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create account');
      }
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }

  /**
   * Obtener cuentas de un usuario
   * Now uses backend API but maintains same interface
   */
  async getUserAccounts(userId: string): Promise<AccountData[] | null> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getUserAccounts(userId, idToken);
      
      if (!response.success || !response.data) {
        return null;
      }
      
      return response.data.accounts.length > 0 ? response.data.accounts : null;
    } catch (error) {
      console.error('Error getting user accounts:', error);
      return null;
    }
  }

  /**
   * Obtener todas las cuentas (admin only)
   * Now uses backend API but maintains same interface
   */
  async getAllAccounts(): Promise<AccountData[] | null> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getAllAccounts(idToken);
      
      if (!response.success || !response.data) {
        return null;
      }
      
      return response.data.accounts.length > 0 ? response.data.accounts : null;
    } catch (error) {
      console.error('Error getting all accounts:', error);
      return null;
    }
  }

  /**
   * Verificar si un email de trading ya existe
   * Now uses backend API but maintains same interface
   */
  async checkEmailExists(emailTradingAccount: string, currentUserId: string): Promise<boolean> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.checkEmailExists(emailTradingAccount, currentUserId, idToken);
      
      if (!response.success || !response.data) {
        return false;
      }
      
      return response.data.exists;
    } catch (error) {
      console.error('Error checking email exists:', error);
      return false;
    }
  }

  /**
   * Verificar si un accountID ya existe
   * Now uses backend API but maintains same interface
   */
  async checkAccountIdExists(accountID: string, currentUserId: string): Promise<boolean> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.checkAccountIdExists(accountID, currentUserId, idToken);
      
      if (!response.success || !response.data) {
        return false;
      }
      
      return response.data.exists;
    } catch (error) {
      console.error('Error checking accountID exists:', error);
      return false;
    }
  }

  /**
   * Actualizar cuenta
   * Now uses backend API but maintains same interface
   */
  async updateAccount(accountId: string, accountData: AccountData): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.updateAccount(accountId, accountData, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update account');
      }
    } catch (error) {
      console.error('Error updating account:', error);
      throw error;
    }
  }

  /**
   * Eliminar cuenta
   * Now uses backend API but maintains same interface
   * Returns userId for cache invalidation (same as before)
   */
  async deleteAccount(accountId: string): Promise<string | null> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.deleteAccount(accountId, idToken);
      
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to delete account');
      }
      
      // Return userId (same as before for compatibility)
      return response.data.userId || null;
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  /**
   * Verificar unicidad de cuenta (email y accountID)
   * Now uses backend API but maintains same interface
   */
  async validateAccountUniqueness(emailTradingAccount: string, accountID: string, currentUserId: string): Promise<{ isValid: boolean; message: string }> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.validateAccountUniqueness(emailTradingAccount, accountID, currentUserId, idToken);
      
      if (!response.success || !response.data) {
        return {
          isValid: false,
          message: response.error?.message || 'Error validating account uniqueness'
        };
      }
      
      return {
        isValid: response.data.isValid,
        message: response.data.message
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
   * Now uses backend API but maintains same interface
   */
  async getAllLengthUserAccounts(userId: string): Promise<number> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getAccountCount(userId, idToken);
      
      if (!response.success || !response.data) {
        return 0;
      }
      
      return response.data.count;
    } catch (error) {
      console.error('Error getting accounts count:', error);
      return 0;
    }
  }

  /**
   * Verificar si existe una cuenta con la combinación broker + server + accountID
   * Now uses backend API but maintains same interface
   */
  async checkAccountExists(broker: string, server: string, accountID: string, currentUserId: string, excludeAccountId?: string): Promise<boolean> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.checkAccountExists(broker, server, accountID, currentUserId, idToken, excludeAccountId);
      
      if (!response.success || !response.data) {
        return false;
      }
      
      return response.data.exists;
    } catch (error) {
      console.error('Error checking account existence:', error);
      return false;
    }
  }
}
