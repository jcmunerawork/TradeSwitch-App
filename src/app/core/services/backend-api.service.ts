/**
 * Backend API service.
 * 
 * This service handles all HTTP requests to the backend API.
 * Extends BaseApiService for common HTTP operations.
 */

import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
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
   */
  async signup(data: SignupRequest): Promise<BackendApiResponse<SignupResponse>> {
    // El backend crea TODO: Firebase Auth, user document, link token, subscription
    const response = await firstValueFrom(
      this.post<BackendApiResponse<SignupResponse>>('/auth/signup', data)
    );
    
    // Después de que el backend crea el usuario, hacer sign in en Firebase Auth para obtener la sesión
    if (response.success && response.data) {
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
   * Create Stripe checkout session
   */
  async createCheckoutSession(priceId: string, idToken: string): Promise<BackendApiResponse<{ url: string; sessionId: string }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ url: string; sessionId: string }>>('/payments/create-checkout-session', {
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
   */
  async createPortalSession(customerId: string, idToken: string): Promise<BackendApiResponse<{ url: string; sessionId: string }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ url: string; sessionId: string }>>('/payments/create-portal-session', {
        customerId
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
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
    return firstValueFrom(
      this.put<BackendApiResponse<{ account: any }>>(`/accounts/${accountId}`, accountData, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
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
   */
  async getUserByEmail(email: string, idToken: string): Promise<BackendApiResponse<{ user: any }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ user: any }>>('/users/email', { email }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
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
   */
  async deleteUser(userId: string, idToken: string): Promise<BackendApiResponse<void>> {
    return firstValueFrom(
      this.delete<BackendApiResponse<void>>(`/users/${userId}`, {
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
   */
  async getAllUsers(idToken: string): Promise<BackendApiResponse<{ users: any[] }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ users: any[] }>>('/users', undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Strategy operations
   */

  /**
   * Create configuration overview
   */
  async createConfigurationOverview(userId: string, name: string, idToken: string): Promise<BackendApiResponse<{ overviewId: string }>> {
    return firstValueFrom(
      this.post<BackendApiResponse<{ overviewId: string }>>('/strategies/overview', {
        userId,
        name
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
   * Subscription operations
   */

  /**
   * Get user latest subscription
   */
  async getUserLatestSubscription(userId: string, idToken: string): Promise<BackendApiResponse<{ subscription: any }>> {
    return firstValueFrom(
      this.get<BackendApiResponse<{ subscription: any }>>(`/subscriptions/user/${userId}/latest`, undefined, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
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
   * Get account balance from TradeLocker
   * El backend gestiona el accessToken automáticamente
   */
  async getTradeLockerAccountBalance(accountId: string, accountNumber: number, idToken: string): Promise<BackendApiResponse<any>> {
    return firstValueFrom(
      this.get<BackendApiResponse<any>>(`/tradelocker/accounts/${accountId}/balance`, {
        accNum: accountNumber.toString()
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
  }

  /**
   * Get account balance from TradeLocker (nuevo endpoint)
   * GET /api/v1/tradelocker/balance/{accountId}?accNum={accNum}
   * El backend gestiona el accessToken automáticamente
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
}

