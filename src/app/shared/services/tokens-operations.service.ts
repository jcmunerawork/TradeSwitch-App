import { Injectable } from '@angular/core';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

/**
 * Interface for link token data.
 *
 * @interface LinkToken
 */
export interface LinkToken {
  id: string;
  [key: string]: any;
}

/**
 * Service for managing link tokens in Firebase.
 *
 * This service provides operations for creating and deleting link tokens
 * that are used for user authentication and account linking. Tokens are
 * stored in the `tokens` collection.
 *
 * Features:
 * - Create link token
 * - Delete link token
 *
 * Token Structure:
 * - Stored in: `tokens/{tokenId}`
 * - Used for: User authentication, account linking
 *
 * Relations:
 * - Used by AuthService for token management
 * - Used for logout everywhere functionality (token revocation)
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class TokensOperationsService {
  constructor(
    private backendApi: BackendApiService
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
   * Crear token de enlace
   * Now uses backend API but maintains same interface
   */
  async createLinkToken(token: LinkToken): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.createLinkToken(token, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create link token');
      }
    } catch (error) {
      console.error('Error creating link token:', error);
      throw error;
    }
  }

  /**
   * Eliminar token de enlace
   * Now uses backend API but maintains same interface
   */
  async deleteLinkToken(tokenId: string): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.deleteLinkToken(tokenId, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete link token');
      }
    } catch (error) {
      console.error('Error deleting link token:', error);
      throw error;
    }
  }
}
