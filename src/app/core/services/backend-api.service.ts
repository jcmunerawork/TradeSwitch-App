/**
 * Backend API service.
 * 
 * This service handles all HTTP requests to the backend API.
 * Extends BaseApiService for common HTTP operations.
 */

import { Injectable } from '@angular/core';
import { Observable, firstValueFrom, throwError, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { BaseApiService } from './api.service';
import { getAuth } from 'firebase/auth';

/**
 * API Response interface
 */
export interface BackendApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: any;
  };
  message?: string;
}

/**
 * Signup request
 */
export interface SignupRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  birthday?: string | Date | null;
  isAdmin?: boolean;
  autoLogin?: boolean; // Si es false, no se hace login automático (útil cuando admin crea usuarios)
}

/**
 * Signup response
 * El backend devuelve el usuario creado y opcionalmente un customToken
 */
export interface SignupResponse {
  user: {
    uid: string;
    email: string;
  };
  customToken?: string; // Token personalizado de Firebase para hacer sign in
  idToken?: string; // Token de Firebase Auth (si el backend lo devuelve)
}

/**
 * Login request
 */
export interface LoginRequest {
  email?: string;
  password?: string;
  idToken?: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  user: any;
  uid: string;
}

@Injectable({
  providedIn: 'root'
})
export class BackendApiService extends BaseApiService {
  protected apiUrl = '/v1';

  /**
   * Sign up a new user
   * El backend maneja TODO: Firebase Auth creation, user document, link token, subscription
   * 
   * Si autoLogin es false, NO se hace login automático (útil cuando admin crea usuarios)
   * Por defecto autoLogin es true para mantener compatibilidad con registro normal
   */
  async signup(data: SignupRequest): Promise<BackendApiResponse<SignupResponse>> {
    // El backend crea TODO: Firebase Auth, user document, link token, subscription
    const response = await firstValueFrom(
      this.post<BackendApiResponse<SignupResponse>>('/auth/signup', data)
    );
    
    // Solo hacer login automático si autoLogin no es false
    // Por defecto es true (compatibilidad con registro normal)
    const shouldAutoLogin = data.autoLogin !== false;
    
    if (shouldAutoLogin && response.success && response.data) {
      try {
        const { signInWithEmailAndPassword, signInWithCustomToken } = await import('firebase/auth');
        const auth = getAuth();
        
        // Opción 1: Si el backend devuelve customToken, usarlo
        if (response.data.customToken) {
          await signInWithCustomToken(auth, response.data.customToken);
        }
        // Opción 2: Hacer sign in con email/password (más común)
        else {
          await signInWithEmailAndPassword(auth, data.email, data.password);
        }
      } catch (authError: any) {
        console.error('❌ BackendApiService: Error haciendo sign in después del registro:', authError);
        // Si falla el sign in, lanzar error para que el componente lo maneje
        throw new Error(`User created but could not sign in: ${authError.message}`);
      }
    }
    
    return response;
  }

  /**
   * Login user
   * Now uses backend API for authentication (backend verifies credentials and returns user data)
   */
  async login(data: LoginRequest): Promise<BackendApiResponse<LoginResponse>> {
    // If idToken is provided, use it directly (for token refresh scenarios)
    if (data.idToken) {
      return firstValueFrom(
        this.post<BackendApiResponse<LoginResponse>>('/auth/login', {
          idToken: data.idToken
        }, {
          headers: {
            'Authorization': `Bearer ${data.idToken}`
          }
        })
      );
    }
    
    // Backend handles credential verification
    const response = await firstValueFrom(
      this.post<BackendApiResponse<LoginResponse>>('/auth/login', {
        email: data.email,
        password: data.password
      })
    );
    
    // After backend verifies, sign in to Firebase Auth to get session
    // Only sign in if we have email and password (not for idToken-only login)
    if (response.success && response.data && data.email && data.password) {
      try {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        const auth = getAuth();
        await signInWithEmailAndPassword(auth, data.email, data.password);
      } catch (authError) {
        console.warn('Could not sign in to Firebase Auth after login:', authError);
        // Continue anyway, backend has verified the user
      }
    }
    
    return response;
  }

  /**
   * Get current user
   */
  async getCurrentUser(idToken: string): Promise<BackendApiResponse<{ user: any }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ user: any }>>('/auth/me', undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Check authentication status
   * Verifies if the current token is valid and returns authentication info
   * Returns null if token is invalid or expired
   */
  async checkAuth(idToken: string): Promise<{
    authenticated: boolean;
    tokenInfo?: {
      expiresIn: number;
      expiresAt: string;
      isExpiringSoon: boolean;
    };
    user?: any;
    uid?: string;
  } | null> {
    try {
      const response = await this.getCurrentUser(idToken);
      
      if (response.success && response.data) {
        // El backend devuelve la estructura completa con tokenInfo
        const data = response.data as any;
        return {
          authenticated: true,
          tokenInfo: data.tokenInfo,
          user: data.user,
          uid: data.uid
        };
      }
      
      return null;
    } catch (error: any) {
      // Si es un error 401, el token es inválido o expirado
      if (error.status === 401 || error.response?.status === 401) {
        return null;
      }
      // Otros errores se propagan
      throw error;
    }
  }

  /**
   * Refresh token (verify current token)
   */
  async refreshToken(idToken: string): Promise<BackendApiResponse<{ user: any; uid: string }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ user: any; uid: string }>>('/auth/refresh', {}, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Forgot password
   */
  async forgotPassword(email: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.post<BackendApiResponse<void>>('/auth/forgot-password', { email })
    );
  }

  /**
   * Send password reset email to user (admin only)
   * 
   * Endpoint: POST /api/v1/users/:userId/send-password-reset
   * 
   * The backend generates and sends the password reset email using Firebase Admin SDK.
   * 
   * @param userId - The user ID to send password reset email to
   * @param email - Optional email. If not provided, uses user's current email
   * @param idToken - Firebase ID token for authentication
   */
  async sendPasswordResetToUser(
    userId: string,
    idToken: string,
    email?: string
  ): Promise<BackendApiResponse<{ message: string }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ message: string }>>(
        `/users/${userId}/send-password-reset`,
        email ? { email } : {},
        {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        }
      ).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error sending password reset:', error);
          console.error('❌ BackendApiService: error.error:', error.error);
          console.error('❌ BackendApiService: error.error?.error:', (error.error as any)?.error);
          console.error('📝 BackendApiService: Backend message:', (error.error as any)?.error?.message || error.message);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Change user password with current password verification
   * 
   * Endpoint: POST /api/v1/users/:userId/change-password
   * 
   * The backend verifies the current password and updates it in Firebase Auth.
   * 
   * @param userId - The user ID to change password for
   * @param currentPassword - Current password for verification
   * @param newPassword - New password (min 6 characters)
   * @param confirmPassword - Confirmation of new password
   * @param idToken - Firebase ID token for authentication
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
    idToken: string
  ): Promise<BackendApiResponse<{ message: string }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ message: string }>>(
        `/users/${userId}/change-password`,
        {
          currentPassword,
          newPassword,
          confirmPassword
        },
        {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        }
      ).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error changing password:', error);
          console.error('❌ BackendApiService: error.error:', error.error);
          console.error('❌ BackendApiService: error.error?.error:', (error.error as any)?.error);
          console.error('📝 BackendApiService: Backend message:', (error.error as any)?.error?.message || error.message);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Create Stripe checkout session
   */
  async createCheckoutSession(priceId: string, idToken: string): Promise<BackendApiResponse<{ url: string; sessionId: string }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ url: string; sessionId: string }>>('/v1/payments/create-checkout-session', {
        priceId
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Create Stripe portal session
   * 
   * Endpoint: POST /api/v1/payments/create-portal-session
   * 
   * El backend obtiene el uid del usuario autenticado desde el token.
   * No requiere parámetros en el body.
   * 
   * Retorna una URL del Customer Portal de Stripe que permite al usuario:
   * - Ver su suscripción actual
   * - Cambiar de plan
   * - Cancelar suscripción
   * - Actualizar método de pago
   * - Ver historial de facturas
   * 
   * Respuesta del backend: { url: string }
   */
  async createPortalSession(idToken: string): Promise<BackendApiResponse<{ url: string }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ url: string }>>('/v1/payments/create-portal-session', {}, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error creando sesión del portal:', error);
          console.error('❌ BackendApiService: error.error:', error.error);
          console.error('❌ BackendApiService: error.error?.error:', (error.error as any)?.error);
          console.error('📝 BackendApiService: Mensaje del backend:', (error.error as any)?.error?.message || error.message);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Account operations
   */

  /**
   * Create trading account
   */
  async createAccount(account: any, idToken: string): Promise<BackendApiResponse<{ account: any }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ account: any }>>('/accounts', account, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get user plan based on active subscription
   * Endpoint: GET /api/v1/users/:userId/plan
   * 
   * Obtiene el plan del usuario basado en su suscripción activa.
   * El backend:
   * - Obtiene la última suscripción activa del usuario (o la más reciente si no hay activas)
   * - Extrae el planId de la suscripción
   * - Busca el plan en la colección plans usando ese planId
   * - Retorna el plan completo con límites (strategies, tradingAccounts)
   * - Retorna null si el usuario no tiene suscripción
   */
  async getUserPlan(userId: string, idToken: string): Promise<BackendApiResponse<{ plan: any | null }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ plan: any | null }>>(`/users/${userId}/plan`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get user accounts
   */
  async getUserAccounts(userId: string, idToken: string): Promise<BackendApiResponse<{ accounts: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ accounts: any[] }>>(`/accounts/user/${userId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get all accounts (admin only)
   */
  async getAllAccounts(idToken: string): Promise<BackendApiResponse<{ accounts: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ accounts: any[] }>>('/accounts', undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get account by ID
   */
  async getAccountById(accountId: string, idToken: string): Promise<BackendApiResponse<{ account: any }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ account: any }>>(`/accounts/${accountId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Update account
   */
  async updateAccount(accountId: string, accountData: any, idToken: string): Promise<BackendApiResponse<{ account: any }>> {
    
    try {
      const response = await firstValueFrom(
        this.put<BackendApiResponse<{ account: any }>>(`/accounts/${accountId}`, accountData, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        }).pipe(
          catchError((error: HttpErrorResponse) => {
            // 🔍 LOG DE DEPURACIÓN: Ver la estructura completa del error HTTP
            console.error('❌ BackendApiService: Error HTTP capturado en updateAccount:', error);
            console.error('❌ BackendApiService: error.error:', error.error);
            console.error('❌ BackendApiService: error.error?.error:', error.error?.error);
            console.error('❌ BackendApiService: error.status:', error.status);
            console.error('❌ BackendApiService: error.statusText:', error.statusText);
            console.error('❌ BackendApiService: error.url:', error.url);
            
            // Si el error tiene la estructura del backend, extraer el mensaje
            if (error.error?.error?.message) {
              console.error('📝 BackendApiService: Mensaje del backend:', error.error.error.message);
              console.error('📝 BackendApiService: Detalles del backend:', error.error.error.details);
              console.error('📝 BackendApiService: StatusCode del backend:', error.error.error.statusCode);
            }
            
            // Convertir HttpErrorResponse a formato que el código espera
            // El error ya tiene la estructura correcta, solo necesitamos re-lanzarlo
            return throwError(() => error);
          })
        )
      );
      
      return response;
    } catch (error: any) {
      // Si el error ya es HttpErrorResponse, ya fue logueado arriba
      if (error instanceof HttpErrorResponse) {
        throw error;
      }
      
      // Si es otro tipo de error, loguearlo también
      console.error('❌ BackendApiService: Error no HTTP en updateAccount:', error);
      throw error;
    }
  }

  /**
   * Delete account
   */
  async deleteAccount(accountId: string, idToken: string): Promise<BackendApiResponse<{ userId: string }>> {
    return firstValueFrom(
      this.delete<BackendApiResponse<{ userId: string }>>(`/accounts/${accountId}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Check if email exists
   */
  async checkEmailExists(emailTradingAccount: string, currentUserId: string, idToken: string): Promise<BackendApiResponse<{ exists: boolean }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ exists: boolean }>>('/accounts/check-email', {
        emailTradingAccount,
        currentUserId
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Check if accountID exists
   */
  async checkAccountIdExists(accountID: string, currentUserId: string, idToken: string): Promise<BackendApiResponse<{ exists: boolean }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ exists: boolean }>>('/accounts/check-account-id', {
        accountID,
        currentUserId
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Check if account exists (broker + server + accountID)
   */
  async checkAccountExists(broker: string, server: string, accountID: string, currentUserId: string, idToken: string, excludeAccountId?: string): Promise<BackendApiResponse<{ exists: boolean }>> {
    const params: any = {
      broker,
      server,
      accountID,
      currentUserId
    };
    if (excludeAccountId) {
      params.excludeAccountId = excludeAccountId;
    }
    
    return firstValueFrom(
      this.get<BackendApiResponse<{ exists: boolean }>>('/accounts/check-exists', params, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Validate account uniqueness
   */
  async validateAccountUniqueness(emailTradingAccount: string, accountID: string, currentUserId: string, idToken: string): Promise<BackendApiResponse<{ isValid: boolean; message: string }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ isValid: boolean; message: string }>>('/accounts/validate-uniqueness', {
        emailTradingAccount,
        accountID,
        currentUserId
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get account count for user
   */
  async getAccountCount(userId: string, idToken: string): Promise<BackendApiResponse<{ count: number }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ count: number }>>(`/accounts/count/${userId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get account metrics
   * Returns netPnl, profit factor, bestTrade and stats for an account
   */
  async getAccountMetrics(accountId: string, idToken: string): Promise<BackendApiResponse<{
    accountId: string;
    netPnl: number;
    profit: number;
    bestTrade: number;
    stats?: {
      netPnl: number;
      tradeWinPercent: number;
      profitFactor: number;
      avgWinLossTrades: number;
      totalTrades: number;
      activePositions: number;
    };
  }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{
        accountId: string;
        netPnl: number;
        profit: number;
        bestTrade: number;
        stats?: {
          netPnl: number;
          tradeWinPercent: number;
          profitFactor: number;
          avgWinLossTrades: number;
          totalTrades: number;
          activePositions: number;
        };
      }>>(`/accounts/${accountId}/metrics`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * User operations
   */

  /**
   * Get user by ID
   */
  async getUserById(userId: string, idToken: string): Promise<BackendApiResponse<{ user: any }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ user: any }>>(`/users/${userId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get user by email
   * Endpoint: GET /api/v1/users/email?email=johndoe@gmail.com
   * 
   * Busca un usuario por email en Firestore.
   * El backend:
   * - Retorna el usuario completo si existe (con timestamps convertidos a milisegundos)
   * - Retorna null si el usuario no existe
   * - Requiere autenticación
   */
  async getUserByEmail(email: string, idToken: string): Promise<BackendApiResponse<{ user: any | null }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ user: any | null }>>('/users/email', { email }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting user by email:', error);
          console.error('❌ BackendApiService: error.error:', error.error);
          console.error('❌ BackendApiService: error.status:', error.status);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Create user
   */
  async createUser(user: any, idToken: string): Promise<BackendApiResponse<{ user: any }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ user: any }>>('/users', user, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Update user
   */
  async updateUser(userId: string, userData: any, idToken: string): Promise<BackendApiResponse<{ user: any }>> {
    return firstValueFrom(
      this.put<BackendApiResponse<{ user: any }>>(`/users/${userId}`, userData, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Delete user
   * 
   * Endpoint: DELETE /api/v1/users/:userId
   * 
   * Elimina todos los datos del usuario:
   * - Trading accounts (accounts collection)
   * - Strategies (configuration-overview y configurations)
   * - Monthly reports (monthly_reports)
   * - Plugin history (plugin_history)
   * - Link tokens (tokens)
   * - Subscriptions (users/{userId}/subscription)
   * - Trading history (users/{userId}/trading_history)
   * - User document (users/{userId})
   * - Firebase Auth user
   * 
   * Permisos: El usuario puede eliminar su propia cuenta o un admin puede eliminar cualquier cuenta
   */
  async deleteUser(userId: string, idToken: string): Promise<BackendApiResponse<{
    deleted: {
      accounts: number;
      strategies: number;
      reports: number;
      pluginHistory: number;
      tokens: number;
      subscriptions: number;
    };
  }>> {
    return firstValueFrom(
      this.delete<BackendApiResponse<{
        deleted: {
          accounts: number;
          strategies: number;
          reports: number;
          pluginHistory: number;
          tokens: number;
          subscriptions: number;
        };
      }>>(`/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get strategy_followed for a user
   * Returns the percentage of trades following the strategy
   */
  async getStrategyFollowed(userId: string, idToken: string): Promise<BackendApiResponse<{
    strategy_followed: number;
    strategyName?: string;
  }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{
        strategy_followed: number;
        strategyName?: string;
      }>>(`/users/${userId}/strategy-followed`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Calculate all metrics (optional, for manual recalculation)
   * Use only if you need to force a full recalculation
   */
  async calculateAllMetrics(accountIds: string[] | undefined, idToken: string, options?: {
    includeUserMetrics?: boolean;
    includeStrategyFollowed?: boolean;
  }): Promise<BackendApiResponse<any>> {
    return firstValueFrom(
      this.post<BackendApiResponse<any>>('/reports/calculate-metrics', {
        accountIds,
        includeUserMetrics: options?.includeUserMetrics ?? true,
        includeStrategyFollowed: options?.includeStrategyFollowed ?? true
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get all users (admin only)
   * Endpoint: GET /api/v1/users
   * 
   * Obtiene todos los usuarios del sistema.
   * El backend:
   * - Retorna todos los usuarios sin paginación
   * - Convierte timestamps de Firestore a milisegundos
   * - Incluye valores por defecto para todos los campos
   * - Requiere autenticación y permisos de administrador
   */
  async getAllUsers(idToken: string): Promise<BackendApiResponse<{ users: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ users: any[] }>>('/users', undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting all users:', error);
          console.error('❌ BackendApiService: error.error:', error.error);
          console.error('❌ BackendApiService: error.status:', error.status);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Strategy operations
   */

  /**
   * Create configuration overview
   */
  async createConfigurationOverview(
    userId: string, 
    name: string, 
    idToken: string,
    configurationId?: string,
    shouldBeActive?: boolean
  ): Promise<BackendApiResponse<{ overviewId: string }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ overviewId: string }>>('/strategies/overview', {
        name,
        ...(configurationId && { configurationId }),
        ...(shouldBeActive !== undefined && { shouldBeActive })
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get configuration overview
   */
  async getConfigurationOverview(overviewId: string, idToken: string): Promise<BackendApiResponse<{ overview: any }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ overview: any }>>(`/strategies/overview/${overviewId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Update configuration overview
   */
  async updateConfigurationOverview(overviewId: string, updates: any, idToken: string): Promise<BackendApiResponse<{ overview: any }>> {
    return firstValueFrom(
      this.put<BackendApiResponse<{ overview: any }>>(`/strategies/overview/${overviewId}`, updates, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Delete configuration overview
   */
  async deleteConfigurationOverview(overviewId: string, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.delete<BackendApiResponse<void>>(`/strategies/overview/${overviewId}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Create configuration only (without overview)
   * Creates only a configuration document and returns its ID
   */
  async createConfigurationOnly(configuration: any, idToken: string): Promise<BackendApiResponse<{ configurationId: string }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ configurationId: string }>>('/strategies/configuration', {
        configuration
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Create configuration
   */
  async createConfiguration(userId: string, configurationOverviewId: string, configuration: any, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.post<BackendApiResponse<void>>('/strategies/configuration', {
        userId,
        configurationOverviewId,
        configuration
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get configuration by userId
   */
  async getConfiguration(userId: string, idToken: string): Promise<BackendApiResponse<{ configuration: any }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ configuration: any }>>(`/strategies/configuration/user/${userId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get configuration by ID
   */
  async getConfigurationById(configurationId: string, idToken: string): Promise<BackendApiResponse<{ configuration: any }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ configuration: any }>>(`/strategies/configuration/${configurationId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Update configuration
   */
  async updateConfiguration(userId: string, configuration: any, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.put<BackendApiResponse<void>>(`/strategies/configuration/user/${userId}`, configuration, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Update configuration by ID
   */
  async updateConfigurationById(configurationId: string, configuration: any, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.put<BackendApiResponse<void>>(`/strategies/configuration/${configurationId}`, configuration, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get user strategy views
   */
  async getUserStrategyViews(userId: string, idToken: string): Promise<BackendApiResponse<{ strategies: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ strategies: any[] }>>(`/strategies/user/${userId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get active configuration
   */
  async getActiveConfiguration(userId: string, idToken: string): Promise<BackendApiResponse<{ overview: any }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ overview: any }>>(`/strategies/active/${userId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Activate strategy view
   */
  async activateStrategyView(userId: string, strategyId: string, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.post<BackendApiResponse<void>>(`/strategies/${strategyId}/activate`, {
        userId
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Update strategy dates
   */
  async updateStrategyDates(userId: string, strategyId: string, dateActive?: Date, dateInactive?: Date, idToken?: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.put<BackendApiResponse<void>>(`/strategies/${strategyId}/dates`, {
        userId,
        dateActive,
        dateInactive
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Mark strategy as deleted
   */
  async markStrategyAsDeleted(strategyId: string, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.put<BackendApiResponse<void>>(`/strategies/${strategyId}/delete`, {}, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get strategies count for user
   */
  async getStrategiesCount(userId: string, idToken: string): Promise<BackendApiResponse<{ count: number }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ count: number }>>(`/strategies/count/${userId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Token operations
   */

  /**
   * Create link token
   */
  async createLinkToken(token: any, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.post<BackendApiResponse<void>>('/tokens', token, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Delete link token
   */
  async deleteLinkToken(tokenId: string, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.delete<BackendApiResponse<void>>(`/tokens/${tokenId}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Revoke all user sessions (logout everywhere)
   * Endpoint: POST /api/v1/users/:userId/revoke-all-sessions
   * Revokes all refresh tokens and deletes all link tokens for a user
   */
  async revokeAllUserSessions(userId: string, idToken: string): Promise<BackendApiResponse<{ message: string; tokensDeleted?: number }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ message: string; tokensDeleted?: number }>>(`/users/${userId}/revoke-all-sessions`, {}, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error revoking all user sessions:', error);
          console.error('❌ BackendApiService: error.error:', error.error);
          console.error('❌ BackendApiService: error.status:', error.status);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Subscription operations
   */

  /**
   * Get user latest subscription
   * Endpoint: GET /api/v1/profile/subscriptions/latest
   * El userId se obtiene automáticamente del token de autenticación
   * 
   * Respuesta cuando no hay suscripción:
   * { "success": true, "data": { "subscription": null } }
   * 
   * Respuesta cuando hay suscripción:
   * { "success": true, "data": { "subscription": { ... } } }
   * 
   * El endpoint siempre retorna 200, nunca 404.
   */
  async getUserLatestSubscription(userId: string, idToken: string): Promise<BackendApiResponse<{ subscription: any }>> {
    // Nota: userId se mantiene en la firma por compatibilidad, pero el endpoint lo obtiene del token
    return firstValueFrom(
      this.get<BackendApiResponse<{ subscription: any }>>(`/profile/subscriptions/latest`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          // El endpoint nunca debería retornar 404, pero por si acaso lo manejamos
          if (error.status === 404) {
            console.warn('⚠️ BackendApiService: Endpoint retornó 404, pero debería retornar 200 con subscription: null');
            // Retornar respuesta exitosa con subscription null
            return of({
              success: true,
              data: { subscription: null }
            } as BackendApiResponse<{ subscription: any }>);
          }
          console.error('❌ BackendApiService: Error obteniendo suscripción:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Get subscription by ID
   */
  async getSubscriptionById(userId: string, subscriptionId: string, idToken: string): Promise<BackendApiResponse<{ subscription: any }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ subscription: any }>>(`/subscriptions/user/${userId}/${subscriptionId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Create subscription
   */
  async createSubscription(userId: string, subscriptionData: any, idToken: string): Promise<BackendApiResponse<{ subscriptionId: string }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ subscriptionId: string }>>(`/subscriptions/user/${userId}`, subscriptionData, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Update subscription
   */
  async updateSubscription(userId: string, subscriptionId: string, updateData: any, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.put<BackendApiResponse<void>>(`/subscriptions/user/${userId}/${subscriptionId}`, updateData, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Delete subscription
   */
  async deleteSubscription(userId: string, subscriptionId: string, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.delete<BackendApiResponse<void>>(`/subscriptions/user/${userId}/${subscriptionId}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get subscriptions by status
   */
  async getSubscriptionsByStatus(userId: string, status: string, idToken: string): Promise<BackendApiResponse<{ subscriptions: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ subscriptions: any[] }>>(`/subscriptions/user/${userId}/status/${status}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get total subscriptions count
   */
  async getTotalSubscriptionsCount(userId: string, idToken: string): Promise<BackendApiResponse<{ count: number }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ count: number }>>(`/subscriptions/user/${userId}/count`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * TradeLocker operations
   */

  /**
   * Get JWT token from TradeLocker (staging)
   */
  async getTradeLockerJWTToken(credentials: { email: string; password: string; server: string }, idToken: string): Promise<BackendApiResponse<{ data: any[] }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ data: any[] }>>('/tradelocker/auth/token', credentials, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Validate account in TradeLocker
   */
  async validateTradeLockerAccount(credentials: { email: string; password: string; server: string }, idToken: string): Promise<BackendApiResponse<{ isValid: boolean }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ isValid: boolean }>>('/tradelocker/validate', credentials, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * @deprecated Este método usa un endpoint que no existe en el backend.
   * Usar getTradeLockerBalance() en su lugar.
   * 
   * Get account balance from TradeLocker
   * El backend gestiona el accessToken automáticamente
   */
  async getTradeLockerAccountBalance(accountId: string, accountNumber: number, idToken: string): Promise<BackendApiResponse<any>> {
    console.warn('⚠️ getTradeLockerAccountBalance está deprecado. Usar getTradeLockerBalance() en su lugar.');
    // Redirigir al método correcto
    return this.getTradeLockerBalance(accountId, accountNumber, idToken);
  }

  /**
   * Get account balance from TradeLocker
   * Endpoint correcto: GET /api/v1/tradelocker/balance/{accountId}?accNum={accNum}
   * 
   * Parámetros:
   * - accountId: ID de la cuenta de TradeLocker (accountID, no el ID de Firebase)
   * - accNum: número de cuenta (query parameter, requerido)
   * 
   * El backend gestiona el accessToken automáticamente y guarda el balance en Firebase.
   * 
   * @param accountId - ID de la cuenta de TradeLocker (accountID)
   * @param accNum - Número de cuenta
   * @param idToken - Firebase ID token para autenticación
   * @returns Promise con la respuesta del backend que incluye el balance
   */
  async getTradeLockerBalance(accountId: string, accNum: number, idToken: string): Promise<BackendApiResponse<any>> {
    return firstValueFrom(
      this.get<BackendApiResponse<any>>(`/tradelocker/balance/${accountId}`, {
        accNum: accNum.toString()
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get balances for multiple accounts in a single batch request
   * Endpoint: POST /api/v1/tradelocker/balances/batch
   * 
   * This endpoint processes multiple account balances in parallel, reducing the number
   * of HTTP requests and improving performance during login.
   * 
   * The backend automatically:
   * - Validates account ownership
   * - Gets access tokens for each account
   * - Fetches balances from TradeLocker
   * - Saves balances to Firebase
   * 
   * @param accounts - Array of account objects with accountId and accNum
   * @param idToken - Firebase ID token for authentication
   * @returns Promise with batch response containing balances and summary
   */
  async getTradeLockerBalancesBatch(
    accounts: Array<{ accountId: string; accNum: number }>,
    idToken: string
  ): Promise<BackendApiResponse<{
    balances: Array<{
      accountId: string;
      accNum: number;
      balance?: number;
      success: boolean;
      error?: string;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{
        balances: Array<{
          accountId: string;
          accNum: number;
          balance?: number;
          success: boolean;
          error?: string;
        }>;
        summary: {
          total: number;
          successful: number;
          failed: number;
        };
      }>>(
        '/tradelocker/balances/batch',
        { accounts },
        {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        }
      ).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting balances batch:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Get trading history from TradeLocker
   * El backend gestiona el accessToken automáticamente
   * Backend route: @Get('accounts/:accountId/history') under /tradelocker controller
   * Query param: accNum (not path param)
   */
  async getTradeLockerTradingHistory(accountId: string, accNum: number, idToken: string): Promise<BackendApiResponse<any>> {
    const response = await firstValueFrom(
      this.get<BackendApiResponse<any>>(`/tradelocker/accounts/${accountId}/history`, {
        accNum: accNum.toString()
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
    
    return response;
  }

  /**
   * Get instrument details from TradeLocker
   * El backend gestiona el accessToken automáticamente, se pasa accountId en su lugar
   */
  async getTradeLockerInstrumentDetails(accountId: string, tradableInstrumentId: string, routeId: string, accNum: number, idToken: string): Promise<BackendApiResponse<any>> {
    return firstValueFrom(
      this.get<BackendApiResponse<any>>(`/tradelocker/instruments/${tradableInstrumentId}`, {
        accountId,
        routeId,
        accNum: accNum.toString()
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get all instruments for an account from TradeLocker
   * Endpoint: GET /api/v1/tradelocker/instruments/:accountId?accNum={accNum}
   * El backend gestiona el accessToken automáticamente
   */
  async getTradeLockerAllInstruments(accountId: string, accNum: number, idToken: string): Promise<BackendApiResponse<any>> {
    return firstValueFrom(
      this.get<BackendApiResponse<any>>(`/tradelocker/instruments/${accountId}`, {
        accNum: accNum.toString()
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get account tokens for Streams API
   */
  async getTradeLockerAccountTokens(credentials: { email: string; password: string; server: string }, idToken: string): Promise<BackendApiResponse<{ data: any[] }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ data: any[] }>>('/tradelocker/accounts/tokens', credentials, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Refresh TradeLocker token
   */
  async refreshTradeLockerToken(accessToken: string, idToken: string): Promise<BackendApiResponse<any>> {
    return firstValueFrom(
      this.post<BackendApiResponse<any>>('/tradelocker/auth/refresh', {}, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'X-Access-Token': accessToken
        }
      })
    );
  }

  /**
   * Trading History operations
   */

  /**
   * Get trading history from Firebase
   * Endpoint: GET /api/v1/reports/history/:accountId
   */
  async getTradingHistory(accountId: string, idToken: string): Promise<BackendApiResponse<any>> {
    return firstValueFrom(
      this.get<BackendApiResponse<any>>(`/reports/history/${accountId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting trading history:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Sync trading history from TradeLocker API to Firebase
   * Endpoint: POST /api/v1/reports/history/:accountId/sync
   */
  async syncTradingHistory(accountId: string, idToken: string, forceSync?: boolean): Promise<BackendApiResponse<any>> {
    return firstValueFrom(
      this.post<BackendApiResponse<any>>(`/reports/history/${accountId}/sync`, {
        forceSync: forceSync || false
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error syncing trading history:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Get trading history metrics
   * Endpoint: GET /api/v1/reports/history/:accountId/metrics
   */
  async getTradingHistoryMetrics(accountId: string, idToken: string): Promise<BackendApiResponse<any>> {
    return firstValueFrom(
      this.get<BackendApiResponse<any>>(`/reports/history/${accountId}/metrics`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting trading history metrics:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Monthly Reports operations
   */

  /**
   * Get all monthly reports for the current user
   * Endpoint: GET /api/v1/reports/monthly
   */
  async getMonthlyReports(idToken: string): Promise<BackendApiResponse<{ reports: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ reports: any[] }>>('/reports/monthly', undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting monthly reports:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Get monthly report by ID
   * Endpoint: GET /api/v1/reports/monthly/:reportId
   */
  async getMonthlyReport(reportId: string, idToken: string): Promise<BackendApiResponse<{ report: any }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ report: any }>>(`/reports/monthly/${reportId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting monthly report:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Get monthly report by user, month and year
   * Endpoint: GET /api/v1/reports/monthly/user/:userId/month/:month/year/:year
   */
  async getMonthlyReportByUserMonthYear(userId: string, month: number, year: number, idToken: string): Promise<BackendApiResponse<{ report: any }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ report: any }>>(`/reports/monthly/user/${userId}/month/${month}/year/${year}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting monthly report by period:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Create or update monthly report
   * Endpoint: POST /api/v1/reports/monthly
   */
  async createOrUpdateMonthlyReport(monthlyReport: any, idToken: string): Promise<BackendApiResponse<{ report: any }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ report: any }>>('/reports/monthly', monthlyReport, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error creating/updating monthly report:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Delete monthly report
   * Endpoint: DELETE /api/v1/reports/monthly/:reportId
   */
  async deleteMonthlyReport(reportId: string, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.delete<BackendApiResponse<void>>(`/reports/monthly/${reportId}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error deleting monthly report:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Plans operations
   */

  /**
   * Get all plans
   * Endpoint: GET /api/v1/plans
   */
  async getAllPlans(idToken: string): Promise<BackendApiResponse<{ plans: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ plans: any[] }>>('/plans', undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting all plans:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Get plan by ID
   * Endpoint: GET /api/v1/plans/:planId
   */
  async getPlanById(planId: string, idToken: string): Promise<BackendApiResponse<{ plan: any }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ plan: any }>>(`/plans/${planId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting plan by ID:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Search plans by name
   * Endpoint: GET /api/v1/plans/search?name=...
   */
  async searchPlansByName(name: string, idToken: string): Promise<BackendApiResponse<{ plans: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ plans: any[] }>>('/plans/search', { name }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error searching plans by name:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Create plan (admin only)
   * Endpoint: POST /api/v1/plans
   */
  async createPlan(plan: any, idToken: string): Promise<BackendApiResponse<{ plan: any }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ plan: any }>>('/plans', plan, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error creating plan:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Update plan (admin only)
   * Endpoint: PUT /api/v1/plans/:planId
   */
  async updatePlan(planId: string, plan: Partial<any>, idToken: string): Promise<BackendApiResponse<{ plan: any }>> {
    return firstValueFrom(
      this.put<BackendApiResponse<{ plan: any }>>(`/plans/${planId}`, plan, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error updating plan:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Delete plan (admin only)
   * Endpoint: DELETE /api/v1/plans/:planId
   */
  async deletePlan(planId: string, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.delete<BackendApiResponse<void>>(`/plans/${planId}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error deleting plan:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Ban Reasons operations
   */

  /**
   * Create ban reason (admin only)
   * Endpoint: POST /api/v1/users/:userId/ban-reasons
   */
  async createBanReason(userId: string, reason: string, idToken: string): Promise<BackendApiResponse<{ banReason: any }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ banReason: any }>>(`/users/${userId}/ban-reasons`, { reason }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error creating ban reason:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Update ban reason (admin only)
   * Endpoint: PUT /api/v1/users/:userId/ban-reasons/:reasonId
   */
  async updateBanReason(userId: string, reasonId: string, data: Partial<any>, idToken: string): Promise<BackendApiResponse<{ banReason: any }>> {
    return firstValueFrom(
      this.put<BackendApiResponse<{ banReason: any }>>(`/users/${userId}/ban-reasons/${reasonId}`, data, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error updating ban reason:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Get latest ban reason
   * Endpoint: GET /api/v1/users/:userId/ban-reasons/latest
   */
  async getLatestBanReason(userId: string, idToken: string): Promise<BackendApiResponse<{ banReason: any | null }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ banReason: any | null }>>(`/users/${userId}/ban-reasons/latest`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting latest ban reason:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Strategy Days Active operations
   */

  /**
   * Update strategy days active
   * Endpoint: PUT /api/v1/strategies/:strategyId/days-active
   */
  async updateStrategyDaysActive(strategyId: string, idToken: string): Promise<BackendApiResponse<{ strategyId: string; daysActive: number; updatedAt: string }>> {
    return firstValueFrom(
      this.put<BackendApiResponse<{ strategyId: string; daysActive: number; updatedAt: string }>>(`/strategies/${strategyId}/days-active`, {}, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error updating strategy days active:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Update all user strategies days active
   * Endpoint: PUT /api/v1/strategies/user/:userId/days-active
   */
  async updateAllUserStrategiesDaysActive(userId: string, idToken: string): Promise<BackendApiResponse<{ updated: number; strategies: Array<{ strategyId: string; daysActive: number }> }>> {
    return firstValueFrom(
      this.put<BackendApiResponse<{ updated: number; strategies: Array<{ strategyId: string; daysActive: number }> }>>(`/strategies/user/${userId}/days-active`, {}, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error updating all user strategies days active:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Update active strategy days active
   * Endpoint: PUT /api/v1/strategies/user/:userId/active/days-active
   */
  async updateActiveStrategyDaysActive(userId: string, idToken: string): Promise<BackendApiResponse<{ strategyId: string; daysActive: number; updatedAt: string }>> {
    return firstValueFrom(
      this.put<BackendApiResponse<{ strategyId: string; daysActive: number; updatedAt: string }>>(`/strategies/user/${userId}/active/days-active`, {}, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error updating active strategy days active:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Plugin History operations
   */

  /**
   * Get plugin history
   * Endpoint: GET /api/v1/plugin-history/:userId
   */
  async getPluginHistory(userId: string, idToken: string): Promise<BackendApiResponse<{ pluginHistory: any | null }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ pluginHistory: any | null }>>(`/plugin-history/${userId}`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting plugin history:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Get plugin status
   * Endpoint: GET /api/v1/plugin-history/:userId/status
   */
  async getPluginStatus(userId: string, idToken: string): Promise<BackendApiResponse<{ isActive: boolean; lastActiveDate?: string; lastInactiveDate?: string }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ isActive: boolean; lastActiveDate?: string; lastInactiveDate?: string }>>(`/plugin-history/${userId}/status`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting plugin status:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Activate plugin
   * Endpoint: POST /api/v1/plugin-history/:userId/activate
   */
  async activatePlugin(userId: string, idToken: string): Promise<BackendApiResponse<{ pluginHistory: any }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ pluginHistory: any }>>(`/plugin-history/${userId}/activate`, {}, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error activating plugin:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Deactivate plugin
   * Endpoint: POST /api/v1/plugin-history/:userId/deactivate
   */
  async deactivatePlugin(userId: string, idToken: string): Promise<BackendApiResponse<{ pluginHistory: any }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ pluginHistory: any }>>(`/plugin-history/${userId}/deactivate`, {}, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error deactivating plugin:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Admin Overview operations
   */

  /**
   * Get overview subscriptions
   * Endpoint: GET /api/v1/admin/overview/subscriptions
   * 
   * Obtiene todas las suscripciones de la colección users/{userId}/subscription para todos los usuarios.
   * El backend:
   * - Incluye el id del documento y el userId en cada suscripción
   * - Convierte timestamps de Firestore a números
   * - Requiere autenticación y permisos de administrador
   */
  async getOverviewSubscriptions(idToken: string): Promise<BackendApiResponse<{ subscriptions: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ subscriptions: any[] }>>('/admin/overview/subscriptions', undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting overview subscriptions:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Get overview users with pagination
   * Endpoint: GET /api/v1/admin/overview/users?page=...&limit=...&startAfter=...
   * 
   * Obtiene usuarios con paginación cursor-based.
   * El backend:
   * - Ordena por subscription_date descendente (fallback: lastUpdated descendente)
   * - Retorna todos los campos del usuario de Firebase
   * - Incluye información de paginación (page, limit, total, hasMore, lastDocId)
   * - Usa startAfter para paginación cursor-based
   * - Requiere autenticación y permisos de administrador
   */
  async getOverviewUsers(page: number, limit: number, startAfter: string | undefined, idToken: string): Promise<BackendApiResponse<{ users: any[]; pagination: { page: number; limit: number; total: number; hasMore: boolean; lastDocId?: string } }>> {
    const params: any = { page: page.toString(), limit: limit.toString() };
    if (startAfter) {
      params.startAfter = startAfter;
    }
    
    return firstValueFrom(
      this.get<BackendApiResponse<{ users: any[]; pagination: { page: number; limit: number; total: number; hasMore: boolean; lastDocId?: string } }>>('/admin/overview/users', params, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting overview users:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Get overview accounts
   * Endpoint: GET /api/v1/admin/overview/accounts
   */
  async getOverviewAccounts(idToken: string): Promise<BackendApiResponse<{ accounts: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ accounts: any[] }>>('/admin/overview/accounts', undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting overview accounts:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Get overview monthly reports
   * Endpoint: GET /api/v1/admin/overview/monthly-reports
   */
  async getOverviewMonthlyReports(idToken: string): Promise<BackendApiResponse<{ monthlyReports: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ monthlyReports: any[] }>>('/admin/overview/monthly-reports', undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting overview monthly reports:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Get overview strategies
   * Endpoint: GET /api/v1/admin/overview/strategies
   */
  async getOverviewStrategies(idToken: string): Promise<BackendApiResponse<{ strategies: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ strategies: any[] }>>('/admin/overview/strategies', undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting overview strategies:', error);
          return throwError(() => error);
        })
      )
    );
  }

  /**
   * Admin Dashboard Revenue operations
   */

  /**
   * Get revenue data for admin dashboard
   * Endpoint: GET /api/v1/admin-dashboard/revenue
   * 
   * Obtiene datos de revenue incluyendo métricas, órdenes, suscripciones y reembolsos.
   * Los datos provienen principalmente de Stripe API.
   */
  async getRevenueData(idToken: string): Promise<BackendApiResponse<{
    grossRevenue: number;
    refunds: number;
    netRevenue: number;
    activeSubscriptions: number;
    mrr: number;
    currency: string;
    orders: Array<{
      date: string; // Formato: "Jan 15, 2025"
      value: number;
      concepto: string;
      status: string;
      paid: boolean;
      method: string; // Ya capitalizado: "Card", "Stripe", "Paypal"
    }>;
    refundsTable: Array<{
      created: string; // Formato: "Jan 10, 2025"
      amount: number;
      destination: string; // Ya capitalizado: "Card", "Paypal"
      status: string; // Ya formateado: "Succeeded", "Pending", "Requires Action", etc.
    }>;
    subscriptions: Array<{
      status: string;
      canceladaAFinalDePeriodo: boolean;
      valor: number;
      item: string; // Ya capitalizado: "Starter", "Pro", "Enterprise"
      user: string | null;
      startDate: string; // Formato: "Jan 1, 2025"
      actualPeriodStart: string; // Formato: "Jan 15, 2025"
      actualPeriodEnd: string; // Formato: "Feb 15, 2025"
    }>;
  }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{
        grossRevenue: number;
        refunds: number;
        netRevenue: number;
        activeSubscriptions: number;
        mrr: number;
        currency: string;
        orders: Array<{
          date: string; // Formato: "Jan 15, 2025"
          value: number;
          concepto: string;
          status: string;
          paid: boolean;
          method: string; // Ya capitalizado: "Card", "Stripe", "Paypal"
        }>;
        refundsTable: Array<{
          created: string; // Formato: "Jan 10, 2025"
          amount: number;
          destination: string; // Ya capitalizado: "Card", "Paypal"
          status: string; // Ya formateado: "Succeeded", "Pending", "Requires Action", etc.
        }>;
        subscriptions: Array<{
          status: string;
          canceladaAFinalDePeriodo: boolean;
          valor: number;
          item: string; // Ya capitalizado: "Starter", "Pro", "Enterprise"
          user: string | null;
          startDate: string; // Formato: "Jan 1, 2025"
          actualPeriodStart: string; // Formato: "Jan 15, 2025"
          actualPeriodEnd: string; // Formato: "Feb 15, 2025"
        }>;
      }>>('/admin-dashboard/revenue', undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting revenue data:', error);
          console.error('❌ BackendApiService: error.error:', error.error);
          console.error('❌ BackendApiService: error.status:', error.status);
          return throwError(() => error);
        })
      )
    );
  }
}

