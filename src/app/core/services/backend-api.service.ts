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
 */
export interface SignupResponse {
  user: any;
  token: string;
}

/**
 * Login request
 */
export interface LoginRequest {
  email: string;
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
   */
  async signup(data: SignupRequest): Promise<BackendApiResponse<SignupResponse>> {
    try {
      // First, create user in Firebase Auth (client-side)
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      
      // Get ID token
      const idToken = await userCredential.user.getIdToken();
      
      // Then call backend to create user document and subscription
      const response = await firstValueFrom(
        this.post<BackendApiResponse<SignupResponse>>('/auth/signup', {
          ...data,
          idToken // Send token to backend for verification
        }, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        })
      );
      
      return response;
    } catch (error: any) {
      // If backend call fails, delete the Firebase Auth user
      if (error?.code !== 'auth/email-already-exists') {
        try {
          const auth = getAuth();
          if (auth.currentUser) {
            await auth.currentUser.delete();
          }
        } catch (deleteError) {
          console.error('Error deleting Firebase Auth user:', deleteError);
        }
      }
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(data: LoginRequest): Promise<BackendApiResponse<LoginResponse>> {
    // If idToken is provided, use it directly
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
    
    // Otherwise, verify password with Firebase Auth first
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const auth = getAuth();
    const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password!);
    const idToken = await userCredential.user.getIdToken();
    
    // Then call backend to get user data
    return firstValueFrom(
      this.post<BackendApiResponse<LoginResponse>>('/auth/login', {
        idToken
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })
    );
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
}

