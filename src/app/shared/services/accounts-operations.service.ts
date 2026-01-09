import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AccountData } from '../../features/auth/models/userModel';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';
import { AccountsCacheService } from './accounts-cache.service';

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
  // Peticiones pendientes para evitar múltiples peticiones simultáneas
  private pendingRequests = new Map<string, Promise<AccountData[] | null>>();

  constructor(
    private backendApi: BackendApiService,
    private accountsCache: AccountsCacheService
  ) {}

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
   * Invalidates cache and refetches accounts after creation
   * Returns the backend response to allow access to messages
   */
  async createAccount(account: AccountData): Promise<any> {
    try {
      const idToken = await this.getIdToken();
      
      // Preparar objeto para el backend: remover campos no serializables y asegurar tipos correctos
      const accountToSend = this.prepareAccountForBackend(account);

      accountToSend.userId = account.userId;
      
      const response = await this.backendApi.createAccount(accountToSend, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create account');
      }
      
      // Invalidar caché y recargar cuentas después de crear cuenta
      if (account.userId) {
        this.accountsCache.clearUserCache(account.userId);
        // Recargar cuentas del backend y guardar en caché
        await this.refreshUserAccounts(account.userId);
      }
      
      // Retornar la respuesta para que el componente pueda acceder al mensaje
      return response;
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }

  /**
   * Prepara el objeto AccountData para enviarlo al backend
   * - Solo incluye campos permitidos en UpdateAccountDto
   * - Remueve campos no permitidos: userId, brokerPassword, publicApiToken, publicApiTokenExpiresIn, updatedAt, createdAt, id
   * - Asegura que los campos numéricos sean números válidos
   * - Valida que los campos requeridos estén presentes
   * 
   * Campos permitidos según UpdateAccountDto:
   * - accountName, broker, server, emailTradingAccount, accountID
   * - accountNumber, initialBalance, netPnl, profit, bestTrade, balance
   */
  private prepareAccountForBackend(account: AccountData): any {
    // Validar campos requeridos (solo para validación interna, no se envían todos)
    if (!account.emailTradingAccount) {
      throw new Error('emailTradingAccount is required');
    }
    if (!account.accountID) {
      throw new Error('accountID is required');
    }
    
    // Validar que balance esté presente (no puede ser undefined o null)
    if (account.balance === undefined || account.balance === null) {
      throw new Error('balance is required and cannot be undefined or null');
    }

    // Campos permitidos en UpdateAccountDto (según el backend)
    const allowedFields = [
      'accountName',
      'broker',
      'server',
      'emailTradingAccount',
      'brokerPassword',
      'accountID',
      'accountNumber',
      'initialBalance',
      'netPnl',
      'profit',
      'bestTrade',
      'balance'
    ];

    // Filtrar y construir el objeto solo con campos permitidos
    const accountToSend: any = {};
    
    allowedFields.forEach(field => {
      if (account[field as keyof AccountData] !== undefined) {
        accountToSend[field] = account[field as keyof AccountData];
      }
    });

    // Asegurar que los campos numéricos sean números válidos
    if (accountToSend.initialBalance !== undefined) {
      accountToSend.initialBalance = typeof accountToSend.initialBalance === 'number' 
        ? accountToSend.initialBalance 
        : (accountToSend.initialBalance ? Number(accountToSend.initialBalance) : 0);
    }
    
    if (accountToSend.accountNumber !== undefined) {
      accountToSend.accountNumber = typeof accountToSend.accountNumber === 'number' 
        ? accountToSend.accountNumber 
        : Number(accountToSend.accountNumber);
    }
    
    if (accountToSend.netPnl !== undefined) {
      accountToSend.netPnl = typeof accountToSend.netPnl === 'number' 
        ? accountToSend.netPnl 
        : (accountToSend.netPnl || 0);
    }
    
    if (accountToSend.profit !== undefined) {
      accountToSend.profit = typeof accountToSend.profit === 'number' 
        ? accountToSend.profit 
        : (accountToSend.profit || 0);
    }
    
    if (accountToSend.bestTrade !== undefined) {
      accountToSend.bestTrade = typeof accountToSend.bestTrade === 'number' 
        ? accountToSend.bestTrade 
        : (accountToSend.bestTrade || 0);
    }
    
    // Asegurar que balance sea número (ya validamos que no sea undefined/null)
    accountToSend.balance = typeof accountToSend.balance === 'number' 
      ? accountToSend.balance 
      : Number(accountToSend.balance);

    return accountToSend;
  }

  /**
   * Obtener cuentas de un usuario
   * Now uses localStorage cache to avoid backend requests
   * Only fetches from backend if cache is empty
   */
  async getUserAccounts(userId: string): Promise<AccountData[] | null> {
    // Verificar si hay una petición pendiente para este usuario
    const pendingRequest = this.pendingRequests.get(userId);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Primero intentar obtener del caché (localStorage)
    const cachedAccounts = this.accountsCache.getAccounts(userId);
    if (cachedAccounts !== null) {
      // Retornar datos del caché (puede ser array vacío o con datos)
      return cachedAccounts;
    }

    // Si no hay datos en caché, hacer petición al backend
    const request = this.fetchUserAccountsFromBackend(userId);
    this.pendingRequests.set(userId, request);

    try {
      const result = await request;
      return result;
    } finally {
      // Limpiar petición pendiente
      this.pendingRequests.delete(userId);
    }
  }

  /**
   * Realizar la petición HTTP para obtener las cuentas desde el backend
   * Guarda los resultados en el caché de localStorage
   */
  private async fetchUserAccountsFromBackend(userId: string): Promise<AccountData[] | null> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getUserAccounts(userId, idToken);
      
      if (!response.success || !response.data) {
        // Guardar array vacío en caché para evitar peticiones repetidas
        this.accountsCache.setAccounts(userId, []);
        return null;
      }
      
      const accounts = response.data.accounts.length > 0 ? response.data.accounts : [];
      
      // Guardar en caché de localStorage (con cifrado de datos sensibles)
      this.accountsCache.setAccounts(userId, accounts);
      
      return accounts.length > 0 ? accounts : null;
    } catch (error: any) {
      console.error('Error getting user accounts:', error);
      
      // En caso de error 429 (Too Many Requests), intentar usar caché si existe
      if (error?.status === 429 || (error?.error && error.error.status === 429)) {
        const cached = this.accountsCache.getAccounts(userId);
        if (cached !== null) {
          console.warn('Rate limit exceeded (429), returning cached data');
          return cached.length > 0 ? cached : null;
        }
      }
      
      return null;
    }
  }

  /**
   * Refrescar cuentas del usuario desde el backend
   * Útil después de crear, actualizar o eliminar una cuenta
   */
  private async refreshUserAccounts(userId: string): Promise<void> {
    try {
      await this.fetchUserAccountsFromBackend(userId);
    } catch (error) {
      console.error('Error refreshing user accounts:', error);
    }
  }

  /**
   * Invalidar caché de cuentas para un usuario
   * Útil después de crear, actualizar o eliminar una cuenta
   */
  invalidateAccountsCache(userId: string): void {
    this.accountsCache.clearUserCache(userId);
    this.pendingRequests.delete(userId);
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
   * Invalidates cache and refetches accounts after update
   */
  async updateAccount(accountId: string, accountData: AccountData): Promise<any> {
    try {
      const idToken = await this.getIdToken();
      
      // Preparar objeto para el backend: remover campos no serializables y asegurar tipos correctos
      const accountToSend = this.prepareAccountForBackend(accountData);
      
      const response = await this.backendApi.updateAccount(accountId, accountToSend, idToken);
      
      if (!response.success) {
        // Extraer mensaje de error del formato del backend
        const errorMessage = this.extractErrorMessage(response.error);
        const errorDetails = this.extractErrorDetails(response.error);
        
        console.error('❌ AccountsOperationsService: Error del backend:', {
          message: errorMessage,
          details: errorDetails,
          fullError: response.error
        });
        
        throw new Error(errorMessage);
      }
      
      // Invalidar caché y recargar cuentas después de actualizar cuenta
      if (accountData.userId) {
        this.accountsCache.clearUserCache(accountData.userId);
        // Recargar cuentas del backend y guardar en caché
        await this.refreshUserAccounts(accountData.userId);
      }
      
      // Retornar la respuesta para que el componente pueda acceder al mensaje
      return response;
    } catch (error: any) {
      // 🔍 LOG DE DEPURACIÓN: Ver la estructura completa del error
      console.error('❌ AccountsOperationsService: Error completo:', error);
      
      // Si es HttpErrorResponse, tiene estructura diferente
      if (error instanceof HttpErrorResponse) {
        console.error('❌ AccountsOperationsService: Es HttpErrorResponse');
        console.error('❌ AccountsOperationsService: error.error:', error.error);
        console.error('❌ AccountsOperationsService: error.error?.error:', error.error?.error);
        console.error('❌ AccountsOperationsService: error.status:', error.status);
        console.error('❌ AccountsOperationsService: error.statusText:', error.statusText);
        console.error('❌ AccountsOperationsService: error.url:', error.url);
      } else {
        console.error('❌ AccountsOperationsService: error.error:', error?.error);
        console.error('❌ AccountsOperationsService: error.error?.error:', error?.error?.error);
        console.error('❌ AccountsOperationsService: error.status:', error?.status);
        console.error('❌ AccountsOperationsService: error.statusText:', error?.statusText);
      }
      
      // Extraer mensaje de error del formato del backend
      const errorMessage = this.extractErrorMessage(error);
      const errorDetails = this.extractErrorDetails(error);
      
      console.error('📝 AccountsOperationsService: Mensaje extraído:', errorMessage);
      console.error('📝 AccountsOperationsService: Detalles extraídos:', errorDetails);
      
      // Si hay detalles de validación, mostrarlos también
      if (errorDetails && errorDetails.length > 0) {
        console.error('📝 AccountsOperationsService: Errores de validación:', errorDetails.join(', '));
      }
      
      throw error;
    }
  }

  /**
   * Función helper para extraer el mensaje de error del formato del backend
   */
  private extractErrorMessage(error: any): string {
    // Si es HttpErrorResponse, el error está en error.error
    if (error instanceof HttpErrorResponse) {
      if (error.error?.error?.message) {
        // Formato del backend: error.error.error.message
        return error.error.error.message;
      } else if (error.error?.message) {
        // Formato alternativo
        return error.error.message;
      } else if (error.message) {
        // Mensaje genérico de HTTP
        return error.message;
      }
    } else {
      // El error puede estar en diferentes ubicaciones dependiendo de cómo Angular maneje la respuesta
      if (error?.error?.error?.message) {
        // Formato del backend: error.error.error.message
        return error.error.error.message;
      } else if (error?.error?.message) {
        // Formato alternativo
        return error.error.message;
      } else if (error?.message) {
        // Mensaje genérico de HTTP
        return error.message;
      }
    }
    return 'An error occurred while updating account';
  }

  /**
   * Extraer detalles de validación (array de errores)
   */
  private extractErrorDetails(error: any): string[] | null {
    // Si es HttpErrorResponse, el error está en error.error
    if (error instanceof HttpErrorResponse) {
      if (error.error?.error?.details && Array.isArray(error.error.error.details)) {
        return error.error.error.details;
      }
    } else {
      if (error?.error?.error?.details && Array.isArray(error.error.error.details)) {
        return error.error.error.details;
      }
    }
    return null;
  }

  /**
   * Eliminar cuenta
   * Now uses backend API but maintains same interface
   * Returns userId for cache invalidation (same as before)
   * Invalidates cache and refetches accounts after deletion
   */
  async deleteAccount(accountId: string): Promise<string | null> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.deleteAccount(accountId, idToken);
      
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to delete account');
      }
      
      // Invalidar caché y recargar cuentas después de eliminar cuenta
      const userId = response.data.userId || null;
      if (userId) {
        this.accountsCache.clearUserCache(userId);
        // Recargar cuentas del backend y guardar en caché
        await this.refreshUserAccounts(userId);
      }
      
      // Return userId (same as before for compatibility)
      return userId;
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
