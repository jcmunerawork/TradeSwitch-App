/**
 * Backend API service.
 * 
 * This service handles all HTTP requests to the backend API.
 * Extends BaseApiService for common HTTP operations.
 */

import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, throwError, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { BaseApiService } from './api.service';
import { getAuth } from 'firebase/auth';

import { ApiDataSource, ApiWarning, ApiError, ApiRetryInfo } from '../models/api-response.model';
import { CryptoSessionService } from './crypto-session.service';
import { decryptResponseBody, isEncryptedEnvelope } from '../utils/encryption';

/**
 * API Response interface with fallback and retry support
 */
export interface BackendApiResponse<T> {
  success: boolean;
  data?: T;
  source?: ApiDataSource;
  message?: string;
  warning?: ApiWarning;
  error?: ApiError;
  timestamp?: string;
  retryInfo?: ApiRetryInfo;
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
  private cryptoSession = inject(CryptoSessionService);

  /**
   * Headers con Authorization y X-Session-Key-Id para que el backend cifre la respuesta.
   * Usar en todas las peticiones autenticadas excepto auth/login y auth/signup.
   */
  private async getAuthHeaders(idToken: string): Promise<Record<string, string>> {
    const { keyId } = await this.cryptoSession.getSessionKey(idToken);
    return {
      'Authorization': `Bearer ${idToken}`,
      'X-Session-Key-Id': keyId,
    };
  }

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
   * Get current user (GET /auth/me).
   * Si la respuesta llega con data cifrada (envelope), se descifra aquí como fallback.
   * El backend puede devolver el payload cifrado como { user, tokenInfo, uid } o anidado en .data; normalizamos a data = { user, tokenInfo?, uid? }.
   */
  async getCurrentUser(idToken: string): Promise<BackendApiResponse<{ user: any }>> {
    const response = await firstValueFrom(
      this.get<BackendApiResponse<{ user: any } | Record<string, unknown>>>('/auth/me', undefined, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
    const rawData = response?.data;
    if (rawData && typeof rawData === 'object' && isEncryptedEnvelope(rawData)) {
      const stored = this.cryptoSession.getStoredKey();
      if (stored) {
        const decrypted = await decryptResponseBody(rawData, stored.key) as Record<string, unknown>;
        const data = decrypted && typeof decrypted === 'object' && 'data' in decrypted && (decrypted as any).data != null
          ? (decrypted as any).data
          : decrypted;
        return { ...response, data } as BackendApiResponse<{ user: any }>;
      }
    }
    return response as BackendApiResponse<{ user: any }>;
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
        headers: await this.getAuthHeaders(idToken)
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
          headers: await this.getAuthHeaders(idToken)
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
          headers: await this.getAuthHeaders(idToken)
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
      this.post<BackendApiResponse<{ url: string; sessionId: string }>>('/payments/create-checkout-session', {
        priceId
      }, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Create Stripe portal session
   * 
   * Endpoint: POST /api/v1/payments/create-portal-session
   * 
   * Backend gets the authenticated user uid from the token.
   * No body parameters required.
   *
   * Returns a Stripe Customer Portal URL that allows the user to:
   * - View current subscription
   * - Change plan
   * - Cancel subscription
   * - Update payment method
   * - View invoice history
   *
   * Backend response: { url: string }
   */
  async createPortalSession(idToken: string): Promise<BackendApiResponse<{ url: string }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ url: string }>>('/payments/create-portal-session', {}, {
        headers: await this.getAuthHeaders(idToken)
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error creating portal session:', error);
          console.error('❌ BackendApiService: error.error:', error.error);
          console.error('❌ BackendApiService: error.error?.error:', (error.error as any)?.error);
          console.error('📝 BackendApiService: Backend message:', (error.error as any)?.error?.message || error.message);
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
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Get user plan based on active subscription
   * Endpoint: GET /api/v1/users/:userId/plan
   * 
   * Gets the user plan based on their active subscription.
   * Backend:
   * - Gets the user's latest active subscription (or most recent if none active)
   * - Extracts planId from the subscription
   * - Looks up the plan in the plans collection using that planId
   * - Returns the full plan with limits (strategies, tradingAccounts)
   * - Returns null if the user has no subscription
   */
  async getUserPlan(userId: string, idToken: string): Promise<BackendApiResponse<{ plan: any | null }>> {
    const headers = await this.getAuthHeaders(idToken);
    return firstValueFrom(
      this.get<BackendApiResponse<{ plan: any | null }>>(`/users/${userId}/plan`, undefined, { headers })
    );
  }

  /**
   * Get user accounts (GET /accounts/user/:userId).
   * Si la respuesta llega cifrada, se descifra y se normaliza data (data.data ?? data).
   */
  async getUserAccounts(userId: string, idToken: string): Promise<BackendApiResponse<{ accounts: any[] }>> {
    const response = await firstValueFrom(
      this.get<BackendApiResponse<{ accounts: any[] } | Record<string, unknown>>>(
        `/accounts/user/${userId}`,
        undefined,
        { headers: await this.getAuthHeaders(idToken) }
      )
    );
    const rawData = response?.data;
    if (rawData && typeof rawData === 'object' && isEncryptedEnvelope(rawData)) {
      const stored = this.cryptoSession.getStoredKey();
      if (stored) {
        const decrypted = await decryptResponseBody(rawData, stored.key) as Record<string, unknown>;
        const data = decrypted && typeof decrypted === 'object' && 'data' in decrypted && (decrypted as any).data != null
          ? (decrypted as any).data
          : decrypted;
        return { ...response, data } as BackendApiResponse<{ accounts: any[] }>;
      }
    }
    return response as BackendApiResponse<{ accounts: any[] }>;
  }

  /**
   * Get all accounts (admin only)
   */
  async getAllAccounts(idToken: string): Promise<BackendApiResponse<{ accounts: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ accounts: any[] }>>('/accounts', undefined, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Get account by ID
   */
  async getAccountById(accountId: string, idToken: string): Promise<BackendApiResponse<{ account: any }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ account: any }>>(`/accounts/${accountId}`, undefined, {
        headers: await this.getAuthHeaders(idToken)
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
          headers: await this.getAuthHeaders(idToken)
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
              console.error('📝 BackendApiService: Backend message:', error.error.error.message);
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Get account count for user
   */
  async getAccountCount(userId: string, idToken: string): Promise<BackendApiResponse<{ count: number }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ count: number }>>(`/accounts/count/${userId}`, undefined, {
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Get user by email
   * Endpoint: GET /api/v1/users/email?email=johndoe@gmail.com
   * 
   * Looks up a user by email in Firestore.
   * Backend:
   * - Returns the full user if they exist (with timestamps converted to milliseconds)
   * - Returns null if the user does not exist
   * - Requires authentication
   */
  async getUserByEmail(email: string, idToken: string): Promise<BackendApiResponse<{ user: any | null }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ user: any | null }>>('/users/email', { email }, {
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Normalizes the payload for PUT /users/:userId so the backend receives correct types.
   * - strategy_followed: number (backend rejects string)
   * - birthday: ISO date string YYYY-MM-DD or valid date
   * - status: string (enum value)
   * - lastUpdated: number (timestamp)
   */
  private normalizeUpdateUserPayload(userData: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const validStatuses = new Set(['admin', 'created', 'purchased', 'pending', 'active', 'processing', 'cancelled', 'expired', 'banned']);
    const numericKeys = new Set(['strategy_followed', 'lastUpdated', 'trading_accounts', 'strategies', 'subscription_date', 'number_trades', 'netPnl', 'profit', 'total_spend', 'best_trade']);

    for (const [key, value] of Object.entries(userData)) {
      if (value === undefined) continue;
      if (key === 'id') continue; // never send id in body

      if (numericKeys.has(key)) {
        const n = value === null || value === '' ? undefined : Number(value);
        if (n !== undefined && !Number.isNaN(n)) out[key] = n;
        continue;
      }
      if (key === 'birthday') {
        if (value === null || value === '') continue;
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            out[key] = trimmed;
            continue;
          }
          const date = new Date(value);
          if (!Number.isNaN(date.getTime())) out[key] = value.includes('T') ? value : date.toISOString().slice(0, 10);
          continue;
        }
        if (value instanceof Date) {
          out[key] = value.toISOString().slice(0, 10);
          continue;
        }
        if (typeof value === 'number') {
          const date = value < 10000000000 ? new Date(value * 1000) : new Date(value);
          if (!Number.isNaN(date.getTime())) out[key] = date.toISOString().slice(0, 10);
          continue;
        }
        continue;
      }
      if (key === 'status') {
        const s = typeof value === 'string' ? value : String(value);
        if (s && validStatuses.has(s.toLowerCase())) out[key] = s;
        continue;
      }
      if (key === 'email' && typeof value === 'string' && value.trim()) {
        out[key] = value.trim();
        continue;
      }
      // firstName, lastName, phoneNumber, etc.: pass through
      out[key] = value;
    }
    return out;
  }

  /**
   * Update user
   */
  async updateUser(userId: string, userData: any, idToken: string): Promise<BackendApiResponse<{ user: any }>> {
    const payload = this.normalizeUpdateUserPayload(userData && typeof userData === 'object' ? userData : {});
    return firstValueFrom(
      this.put<BackendApiResponse<{ user: any }>>(`/users/${userId}`, payload, {
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Get all users (admin only)
   * Endpoint: GET /api/v1/users
   * 
   * Gets all users in the system.
   * Backend:
   * - Returns all users without pagination
   * - Converts Firestore timestamps to milliseconds
   * - Includes default values for all fields
   * - Requires authentication and admin permissions
   */
  async getAllUsers(idToken: string): Promise<BackendApiResponse<{ users: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ users: any[] }>>('/users', undefined, {
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Get configuration overview (GET /strategies/overview/:overviewId).
   * Si la respuesta llega cifrada, se descifra y se normaliza data.
   */
  async getConfigurationOverview(overviewId: string, idToken: string): Promise<BackendApiResponse<{ overview: any }>> {
    const response = await firstValueFrom(
      this.get<BackendApiResponse<{ overview: any }> | Record<string, unknown>>(`/strategies/overview/${overviewId}`, undefined, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
    const rawData = response?.data;
    if (rawData && typeof rawData === 'object' && isEncryptedEnvelope(rawData)) {
      const stored = this.cryptoSession.getStoredKey();
      if (stored) {
        const decrypted = await decryptResponseBody(rawData, stored.key) as Record<string, unknown>;
        const data = decrypted && typeof decrypted === 'object' && 'data' in decrypted && (decrypted as any).data != null ? (decrypted as any).data : decrypted;
        return { ...response, data } as BackendApiResponse<{ overview: any }>;
      }
    }
    return response as BackendApiResponse<{ overview: any }>;
  }

  /**
   * Update configuration overview
   */
  async updateConfigurationOverview(overviewId: string, updates: any, idToken: string): Promise<BackendApiResponse<{ overview: any }>> {
    return firstValueFrom(
      this.put<BackendApiResponse<{ overview: any }>>(`/strategies/overview/${overviewId}`, updates, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Delete configuration overview
   */
  async deleteConfigurationOverview(overviewId: string, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.delete<BackendApiResponse<void>>(`/strategies/overview/${overviewId}`, {
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Get configuration by userId (GET /strategies/configuration/user/:userId).
   * Si la respuesta llega cifrada, se descifra y se normaliza data.
   */
  async getConfiguration(userId: string, idToken: string): Promise<BackendApiResponse<{ configuration: any }>> {
    const response = await firstValueFrom(
      this.get<BackendApiResponse<{ configuration: any }> | Record<string, unknown>>(`/strategies/configuration/user/${userId}`, undefined, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
    const rawData = response?.data;
    if (rawData && typeof rawData === 'object' && isEncryptedEnvelope(rawData)) {
      const stored = this.cryptoSession.getStoredKey();
      if (stored) {
        const decrypted = await decryptResponseBody(rawData, stored.key) as Record<string, unknown>;
        const data = decrypted && typeof decrypted === 'object' && 'data' in decrypted && (decrypted as any).data != null ? (decrypted as any).data : decrypted;
        return { ...response, data } as BackendApiResponse<{ configuration: any }>;
      }
    }
    return response as BackendApiResponse<{ configuration: any }>;
  }

  /**
   * Get configuration by ID (GET /strategies/configuration/:configurationId).
   * Si la respuesta llega cifrada, se descifra y se normaliza data.
   */
  async getConfigurationById(configurationId: string, idToken: string): Promise<BackendApiResponse<{ configuration: any }>> {
    const response = await firstValueFrom(
      this.get<BackendApiResponse<{ configuration: any }> | Record<string, unknown>>(`/strategies/configuration/${configurationId}`, undefined, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
    const rawData = response?.data;
    if (rawData && typeof rawData === 'object' && isEncryptedEnvelope(rawData)) {
      const stored = this.cryptoSession.getStoredKey();
      if (stored) {
        const decrypted = await decryptResponseBody(rawData, stored.key) as Record<string, unknown>;
        const data = decrypted && typeof decrypted === 'object' && 'data' in decrypted && (decrypted as any).data != null ? (decrypted as any).data : decrypted;
        return { ...response, data } as BackendApiResponse<{ configuration: any }>;
      }
    }
    return response as BackendApiResponse<{ configuration: any }>;
  }

  /**
   * Update configuration
   */
  async updateConfiguration(userId: string, configuration: any, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.put<BackendApiResponse<void>>(`/strategies/configuration/user/${userId}`, configuration, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Update configuration by ID
   */
  async updateConfigurationById(configurationId: string, configuration: any, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.put<BackendApiResponse<void>>(`/strategies/configuration/${configurationId}`, configuration, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Get user strategies (full) and button state for create strategy.
   * Response: { strategies: Array<{ overview?, configuration? }>, button_state: 'available' | 'plan_reached' | 'block' }
   * Si la respuesta llega cifrada, se descifra y se normaliza data.
   */
  async getUserStrategyViews(userId: string, idToken: string): Promise<BackendApiResponse<{
    strategies: any[];
    button_state: 'available' | 'plan_reached' | 'block';
  }>> {
    const response = await firstValueFrom(
      this.get<BackendApiResponse<{
        strategies: any[];
        button_state: 'available' | 'plan_reached' | 'block';
      } | Record<string, unknown>>>(`/strategies/user/${userId}`, undefined, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
    const rawData = response?.data;
    if (rawData && typeof rawData === 'object' && isEncryptedEnvelope(rawData)) {
      const stored = this.cryptoSession.getStoredKey();
      if (stored) {
        const decrypted = await decryptResponseBody(rawData, stored.key) as Record<string, unknown>;
        const data = decrypted && typeof decrypted === 'object' && 'data' in decrypted && (decrypted as any).data != null
          ? (decrypted as any).data
          : decrypted;
        return { ...response, data } as BackendApiResponse<{ strategies: any[]; button_state: 'available' | 'plan_reached' | 'block' }>;
      }
    }
    return response as BackendApiResponse<{ strategies: any[]; button_state: 'available' | 'plan_reached' | 'block' }>;
  }

  /**
   * Get active configuration (GET /strategies/active/:userId).
   * Si la respuesta llega cifrada, se descifra y se normaliza data.
   */
  async getActiveConfiguration(userId: string, idToken: string): Promise<BackendApiResponse<{ overview: any }>> {
    const response = await firstValueFrom(
      this.get<BackendApiResponse<{ overview: any }> | Record<string, unknown>>(`/strategies/active/${userId}`, undefined, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
    const rawData = response?.data;
    if (rawData && typeof rawData === 'object' && isEncryptedEnvelope(rawData)) {
      const stored = this.cryptoSession.getStoredKey();
      if (stored) {
        const decrypted = await decryptResponseBody(rawData, stored.key) as Record<string, unknown>;
        const data = decrypted && typeof decrypted === 'object' && 'data' in decrypted && (decrypted as any).data != null ? (decrypted as any).data : decrypted;
        return { ...response, data } as BackendApiResponse<{ overview: any }>;
      }
    }
    return response as BackendApiResponse<{ overview: any }>;
  }

  /**
   * Activate strategy (Transactional)
   * Deactivates any currently active strategy and activates the new one
   */
  async activateStrategy(userId: string, strategyId: string, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.post<BackendApiResponse<void>>('/strategies/activate-transactional', {
        userId,
        strategyId
      }, {
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Mark strategy as deleted
   */
  async markStrategyAsDeleted(strategyId: string, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.put<BackendApiResponse<void>>(`/strategies/${strategyId}/delete`, {}, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Get strategies count for user
   */
  async getStrategiesCount(userId: string, idToken: string): Promise<BackendApiResponse<{ count: number }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ count: number }>>(`/strategies/count/${userId}`, undefined, {
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Delete link token
   */
  async deleteLinkToken(tokenId: string, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.delete<BackendApiResponse<void>>(`/tokens/${tokenId}`, {
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
   * The endpoint always returns 200, never 404.
   */
  async getUserLatestSubscription(userId: string, idToken: string): Promise<BackendApiResponse<{ subscription: any }>> {
    const headers = await this.getAuthHeaders(idToken);
    return firstValueFrom(
      this.get<BackendApiResponse<{ subscription: any }>>(`/profile/subscription`, undefined, { headers }).pipe(
        catchError((error: HttpErrorResponse) => {
          // Endpoint should never return 404, but we handle it just in case
          if (error.status === 404) {
            console.warn('⚠️ BackendApiService: Endpoint returned 404, but should return 200 with subscription: null');
            // Return successful response with subscription null
            return of({
              success: true,
              data: { subscription: null }
            } as BackendApiResponse<{ subscription: any }>);
          }
          console.error('❌ BackendApiService: Error getting subscription:', error);
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
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Create subscription
   */
  async createSubscription(userId: string, subscriptionData: any, idToken: string): Promise<BackendApiResponse<{ subscriptionId: string }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ subscriptionId: string }>>(`/subscriptions/user/${userId}`, subscriptionData, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Update subscription
   */
  async updateSubscription(userId: string, subscriptionId: string, updateData: any, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.put<BackendApiResponse<void>>(`/subscriptions/user/${userId}/${subscriptionId}`, updateData, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Delete subscription
   */
  async deleteSubscription(userId: string, subscriptionId: string, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.delete<BackendApiResponse<void>>(`/subscriptions/user/${userId}/${subscriptionId}`, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Get subscriptions by status
   */
  async getSubscriptionsByStatus(userId: string, status: string, idToken: string): Promise<BackendApiResponse<{ subscriptions: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ subscriptions: any[] }>>(`/subscriptions/user/${userId}/status/${status}`, undefined, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Get total subscriptions count
   */
  async getTotalSubscriptionsCount(userId: string, idToken: string): Promise<BackendApiResponse<{ count: number }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ count: number }>>(`/subscriptions/user/${userId}/count`, undefined, {
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Validate account in TradeLocker
   */
  async validateTradeLockerAccount(credentials: { email: string; password: string; server: string }, idToken: string): Promise<BackendApiResponse<{ isValid: boolean }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ isValid: boolean }>>('/tradelocker/validate', credentials, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * @deprecated This method uses an endpoint that does not exist on the backend.
   * Use getTradeLockerBalance() instead.
   *
   * Get account balance from TradeLocker
   * Backend manages accessToken automatically
   */
  async getTradeLockerAccountBalance(accountId: string, accountNumber: number, idToken: string): Promise<BackendApiResponse<any>> {
    console.warn('⚠️ getTradeLockerAccountBalance is deprecated. Use getTradeLockerBalance() instead.');
    // Redirect to the correct method
    return this.getTradeLockerBalance(accountId, accountNumber, idToken);
  }

  /**
   * Get account balance from TradeLocker
   * Endpoint correcto: GET /api/v1/tradelocker/balance/{accountId}?accNum={accNum}
   * 
   * Parameters:
   * - accountId: TradeLocker account ID (accountID, not Firebase ID)
   * - accNum: account number (query parameter, required)
   *
   * Backend manages accessToken automatically and saves the balance to Firebase.
   *
   * @param accountId - TradeLocker account ID (accountID)
   * @param accNum - Account number
   * @param idToken - Firebase ID token for authentication
   * @returns Promise with backend response including the balance
   */
  async getTradeLockerBalance(accountId: string, accNum: number, idToken: string): Promise<BackendApiResponse<any>> {
    return firstValueFrom(
      this.get<BackendApiResponse<any>>(`/tradelocker/balance/${accountId}`, {
        accNum: accNum.toString()
      }, {
        headers: await this.getAuthHeaders(idToken)
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
    type BatchPayload = {
      balances: Array<{ accountId: string; accNum: number; balance?: number; success: boolean; error?: string }>;
      summary: { total: number; successful: number; failed: number };
    };
    const response = await firstValueFrom(
      this.post<BackendApiResponse<BatchPayload> | Record<string, unknown>>(
        '/tradelocker/balances/batch',
        { accounts },
        {
          headers: await this.getAuthHeaders(idToken)
        }
      ).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting balances batch:', error);
          return throwError(() => error);
        })
      )
    );

    const rawData = response?.data;
    if (rawData && typeof rawData === 'object' && isEncryptedEnvelope(rawData)) {
      const stored = this.cryptoSession.getStoredKey();
      if (stored) {
        const decrypted = await decryptResponseBody(rawData, stored.key) as Record<string, unknown>;
        const data = decrypted && typeof decrypted === 'object' && 'data' in decrypted && decrypted['data'] != null
          ? decrypted['data']
          : decrypted;
        return { ...response, data } as BackendApiResponse<BatchPayload>;
      }
    }
    return response as BackendApiResponse<BatchPayload>;
  }

  /**
   * Get trading history from TradeLocker
   * Backend manages accessToken automatically
   * Backend route: @Get('accounts/:accountId/history') under /tradelocker controller
   * Query param: accNum (not path param)
   * 
   * @deprecated Use getTradingHistory(accountId, idToken, accNum) instead.
   * This endpoint only returns closed trades for calendar view.
   * The unified endpoint GET /api/v1/reports/history/:accountId?accNum=... handles everything.
   */
  async getTradeLockerTradingHistory(accountId: string, accNum: number, idToken: string): Promise<BackendApiResponse<any>> {
    console.warn('⚠️ Deprecated: getTradeLockerTradingHistory is deprecated. Use getTradingHistory(accountId, idToken, accNum) instead.');
    const response = await firstValueFrom(
      this.get<BackendApiResponse<any>>(`/tradelocker/accounts/${accountId}/history`, {
        accNum: accNum.toString()
      }, {
        headers: await this.getAuthHeaders(idToken)
      })
    );

    return response;
  }

  /**
   * Get instrument details from TradeLocker
   * Backend manages accessToken automatically; accountId is passed instead
   */
  async getTradeLockerInstrumentDetails(accountId: string, tradableInstrumentId: string, routeId: string, accNum: number, idToken: string): Promise<BackendApiResponse<any>> {
    return firstValueFrom(
      this.get<BackendApiResponse<any>>(`/tradelocker/instruments/${tradableInstrumentId}`, {
        accountId,
        routeId,
        accNum: accNum.toString()
      }, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Get all instruments for an account from TradeLocker
   * Endpoint: GET /api/v1/tradelocker/instruments/:accountId?accNum={accNum}
   * Backend manages accessToken automatically
   */
  async getTradeLockerAllInstruments(accountId: string, accNum: number, idToken: string): Promise<BackendApiResponse<any>> {
    return firstValueFrom(
      this.get<BackendApiResponse<any>>(`/tradelocker/instruments/${accountId}`, {
        accNum: accNum.toString()
      }, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Refresh TradeLocker token
   */
  async refreshTradeLockerToken(accessToken: string, idToken: string): Promise<BackendApiResponse<any>> {
    const headers = await this.getAuthHeaders(idToken);
    headers['X-Access-Token'] = accessToken;
    return firstValueFrom(
      this.post<BackendApiResponse<any>>('/tradelocker/auth/refresh', {}, { headers })
    );
  }

  /**
   * Trading History operations
   */

  /**
   * Get trading history with full processing
   * Endpoint: GET /api/v1/reports/history/:accountId?accNum=...
   * 
   * When accNum is provided, this endpoint:
   * - Fetches from TradeLocker API
   * - Processes and groups trades
   * - Calculates metrics
   * - Returns positions and metrics
   * - Syncs to Firebase in background
   * 
   * When accNum is not provided, returns data from Firebase only.
   * Si la respuesta llega cifrada, se descifra y se normaliza data (data.data ?? data).
   */
  async getTradingHistory(accountId: string, idToken: string, accNum?: number): Promise<BackendApiResponse<any>> {
    const params = accNum !== undefined ? { accNum: accNum.toString() } : undefined;

    const response = await firstValueFrom(
      this.get<BackendApiResponse<any> | Record<string, unknown>>(`/reports/history/${accountId}`, params, {
        headers: await this.getAuthHeaders(idToken)
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting trading history:', error);
          return throwError(() => error);
        })
      )
    );

    const rawData = response?.data;
    if (rawData && typeof rawData === 'object' && isEncryptedEnvelope(rawData)) {
      const stored = this.cryptoSession.getStoredKey();
      if (stored) {
        const decrypted = await decryptResponseBody(rawData, stored.key) as Record<string, unknown>;
        const data = decrypted && typeof decrypted === 'object' && 'data' in decrypted && (decrypted as any).data != null
          ? (decrypted as any).data
          : decrypted;
        return { ...response, data } as BackendApiResponse<any>;
      }
    }
    return response as BackendApiResponse<any>;
  }

  /**
   * Sync trading history from TradeLocker API to Firebase
   * Endpoint: POST /api/v1/reports/history/:accountId/sync
   * 
   * DEPRECATED: This endpoint has been removed as it consumes too much resources
   * and the frontend doesn't benefit from it. Data is now loaded directly from Firebase.
   * 
   * @deprecated This method is no longer used
   */
  async syncTradingHistory(accountId: string, idToken: string, forceSync?: boolean): Promise<BackendApiResponse<any>> {
    const body: Record<string, any> = {};
    if (forceSync !== undefined) {
      body['forceSync'] = forceSync;
    }
    
    return firstValueFrom(
      this.post<BackendApiResponse<any>>(`/reports/history/${accountId}/sync`, body, {
        headers: await this.getAuthHeaders(idToken)
      })
    );
  }

  /**
   * Get trading history metrics
   * Endpoint: GET /api/v1/reports/history/:accountId/metrics
   * 
   * @deprecated Use getTradingHistory(accountId, idToken, accNum) instead.
   * The unified endpoint returns both positions and metrics, making this endpoint redundant.
   */
  async getTradingHistoryMetrics(accountId: string, idToken: string): Promise<BackendApiResponse<any>> {
    console.warn('⚠️ Deprecated: getTradingHistoryMetrics is deprecated. Use getTradingHistory(accountId, idToken, accNum) instead.');
    const response = await firstValueFrom(
      this.get<BackendApiResponse<any> | Record<string, unknown>>(`/reports/history/${accountId}/metrics`, undefined, {
        headers: await this.getAuthHeaders(idToken)
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting trading history metrics:', error);
          return throwError(() => error);
        })
      )
    );
    const rawData = response?.data;
    if (rawData && typeof rawData === 'object' && isEncryptedEnvelope(rawData)) {
      const stored = this.cryptoSession.getStoredKey();
      if (stored) {
        const decrypted = await decryptResponseBody(rawData, stored.key) as Record<string, unknown>;
        const data = decrypted && typeof decrypted === 'object' && 'data' in decrypted && (decrypted as any).data != null ? (decrypted as any).data : decrypted;
        return { ...response, data } as BackendApiResponse<any>;
      }
    }
    return response as BackendApiResponse<any>;
  }

  /**
   * Monthly Reports operations
   */

  /**
   * Get all monthly reports for the current user
   * Endpoint: GET /api/v1/reports/monthly
   * Si la respuesta llega cifrada, se descifra y se normaliza data.
   */
  async getMonthlyReports(idToken: string): Promise<BackendApiResponse<{ reports: any[] }>> {
    const response = await firstValueFrom(
      this.get<BackendApiResponse<{ reports: any[] }> | Record<string, unknown>>('/reports/monthly', undefined, {
        headers: await this.getAuthHeaders(idToken)
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting monthly reports:', error);
          return throwError(() => error);
        })
      )
    );
    const rawData = response?.data;
    if (rawData && typeof rawData === 'object' && isEncryptedEnvelope(rawData)) {
      const stored = this.cryptoSession.getStoredKey();
      if (stored) {
        const decrypted = await decryptResponseBody(rawData, stored.key) as Record<string, unknown>;
        const data = decrypted && typeof decrypted === 'object' && 'data' in decrypted && (decrypted as any).data != null ? (decrypted as any).data : decrypted;
        return { ...response, data } as BackendApiResponse<{ reports: any[] }>;
      }
    }
    return response as BackendApiResponse<{ reports: any[] }>;
  }

  /**
   * Get monthly report by ID
   * Endpoint: GET /api/v1/reports/monthly/:reportId
   * Si la respuesta llega cifrada, se descifra y se normaliza data.
   */
  async getMonthlyReport(reportId: string, idToken: string): Promise<BackendApiResponse<{ report: any }>> {
    const response = await firstValueFrom(
      this.get<BackendApiResponse<{ report: any }> | Record<string, unknown>>(`/reports/monthly/${reportId}`, undefined, {
        headers: await this.getAuthHeaders(idToken)
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting monthly report:', error);
          return throwError(() => error);
        })
      )
    );
    const rawData = response?.data;
    if (rawData && typeof rawData === 'object' && isEncryptedEnvelope(rawData)) {
      const stored = this.cryptoSession.getStoredKey();
      if (stored) {
        const decrypted = await decryptResponseBody(rawData, stored.key) as Record<string, unknown>;
        const data = decrypted && typeof decrypted === 'object' && 'data' in decrypted && (decrypted as any).data != null ? (decrypted as any).data : decrypted;
        return { ...response, data } as BackendApiResponse<{ report: any }>;
      }
    }
    return response as BackendApiResponse<{ report: any }>;
  }

  /**
   * Get monthly report by user, month and year
   * Endpoint: GET /api/v1/reports/monthly/user/:userId/month/:month/year/:year
   * Si la respuesta llega cifrada, se descifra y se normaliza data.
   */
  async getMonthlyReportByUserMonthYear(userId: string, month: number, year: number, idToken: string): Promise<BackendApiResponse<{ report: any }>> {
    const response = await firstValueFrom(
      this.get<BackendApiResponse<{ report: any }> | Record<string, unknown>>(`/reports/monthly/user/${userId}/month/${month}/year/${year}`, undefined, {
        headers: await this.getAuthHeaders(idToken)
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting monthly report by period:', error);
          return throwError(() => error);
        })
      )
    );
    const rawData = response?.data;
    if (rawData && typeof rawData === 'object' && isEncryptedEnvelope(rawData)) {
      const stored = this.cryptoSession.getStoredKey();
      if (stored) {
        const decrypted = await decryptResponseBody(rawData, stored.key) as Record<string, unknown>;
        const data = decrypted && typeof decrypted === 'object' && 'data' in decrypted && (decrypted as any).data != null ? (decrypted as any).data : decrypted;
        return { ...response, data } as BackendApiResponse<{ report: any }>;
      }
    }
    return response as BackendApiResponse<{ report: any }>;
  }

  /**
   * Create or update monthly report
   * Endpoint: POST /api/v1/reports/monthly
   */
  async createOrUpdateMonthlyReport(monthlyReport: any, idToken: string): Promise<BackendApiResponse<{ report: any }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ report: any }>>('/reports/monthly', monthlyReport, {
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
    const headers = await this.getAuthHeaders(idToken);
    const response = await firstValueFrom(
      this.get<BackendApiResponse<{ plans: any[] } | Record<string, unknown>>>('/plans', undefined, { headers }).pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ BackendApiService: Error getting all plans:', error);
          return throwError(() => error);
        })
      )
    );
    // Fallback: si la respuesta llegó cifrada (el interceptor no la descifró), descifrar aquí
    const rawData = response?.data;
    if (rawData && typeof rawData === 'object' && isEncryptedEnvelope(rawData)) {
      const stored = this.cryptoSession.getStoredKey();
      if (stored) {
        const decrypted = await decryptResponseBody(rawData, stored.key) as BackendApiResponse<{ plans: any[] }>;
        // El backend cifra la respuesta completa { success, data: { plans }, source, message }; usar ese objeto como respuesta, no meterlo dentro de .data
        return decrypted;
      }
    }
    return response as BackendApiResponse<{ plans: any[] }>;
  }

  /**
   * Get plan by ID
   * Endpoint: GET /api/v1/plans/:planId
   */
  async getPlanById(planId: string, idToken: string): Promise<BackendApiResponse<{ plan: any }>> {
    const headers = await this.getAuthHeaders(idToken);
    return firstValueFrom(
      this.get<BackendApiResponse<{ plan: any }>>(`/plans/${planId}`, undefined, { headers }).pipe(
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
    const headers = await this.getAuthHeaders(idToken);
    return firstValueFrom(
      this.get<BackendApiResponse<{ plans: any[] }>>('/plans/search', { name }, { headers }).pipe(
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
   * Gets users with cursor-based pagination.
   * Backend:
   * - Sorts by subscription_date descending (fallback: lastUpdated descending)
   * - Returns all Firebase user fields
   * - Includes pagination info (page, limit, total, hasMore, lastDocId)
   * - Uses startAfter for cursor-based pagination
   * - Requires authentication and admin permissions
   */
  async getOverviewUsers(page: number, limit: number, startAfter: string | undefined, idToken: string): Promise<BackendApiResponse<{ users: any[]; pagination: { page: number; limit: number; total: number; hasMore: boolean; lastDocId?: string } }>> {
    const params: any = { page: page.toString(), limit: limit.toString() };
    if (startAfter) {
      params.startAfter = startAfter;
    }

    return firstValueFrom(
      this.get<BackendApiResponse<{ users: any[]; pagination: { page: number; limit: number; total: number; hasMore: boolean; lastDocId?: string } }>>('/admin/overview/users', params, {
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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
        headers: await this.getAuthHeaders(idToken)
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

