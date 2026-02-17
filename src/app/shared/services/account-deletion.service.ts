import { Injectable } from '@angular/core';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

/**
 * Service for comprehensive user account deletion.
 *
 * This service handles the complete deletion of all user data from the backend
 * when a user requests account deletion. The backend handles all deletion operations
 * atomically including accounts, strategies, reports, plugin history, tokens,
 * subscriptions, trading history, and the user document.
 *
 * Features:
 * - Delete all user data atomically via backend API
 * - Backend handles: accounts, strategies, reports, plugin history, tokens, subscriptions, trading history, user
 * - Returns deletion summary with counts
 *
 * Endpoint:
 * DELETE /api/v1/users/:userId
 *
 * Permisos:
 * - El usuario puede eliminar su propia cuenta
 * - Un admin puede eliminar cualquier cuenta
 *
 * Relations:
 * - Used by ProfileDetailsComponent for account deletion
 * - Ensures complete data removal for GDPR compliance
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class AccountDeletionService {
  constructor(private backendApi: BackendApiService) {}

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
   * Deletes all data associated with a user from the backend
   * 
   * The backend handles complete deletion of:
   * - Trading accounts (accounts collection)
   * - Strategies (configuration-overview and configurations)
   * - Monthly reports (monthly_reports)
   * - Plugin history (plugin_history)
   * - Link tokens (tokens)
   * - Subscriptions (users/{userId}/subscription)
   * - Trading history (users/{userId}/trading_history)
   * - User document (users/{userId})
   * - Firebase Auth user
   * 
   * @param userId - ID of the user to delete
   * @returns Promise<boolean> - true if deleted successfully, false if there was an error
   */
  async deleteUserData(userId: string): Promise<boolean> {
    try {
      const idToken = await this.getIdToken();
      
      const response = await this.backendApi.deleteUser(userId, idToken);
      
      if (!response.success) {
        console.error('❌ AccountDeletionService: Error deleting user data:', response.error);
        return false;
      }
      
      return true;
    } catch (error: any) {
      console.error('❌ AccountDeletionService: Error deleting user data:', error);
      console.error('❌ AccountDeletionService: Error details:', {
        status: error?.status,
        message: error?.message,
        error: error?.error
      });
      return false;
    }
  }
}
