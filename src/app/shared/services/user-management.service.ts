import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { User, UserStatus } from '../../features/overview/models/overview';
import { BackendApiService } from '../../core/services/backend-api.service';
import { AuthService } from './auth.service';

/**
 * Service for managing user data operations (administrative).
 *
 * This service provides administrative operations for user management,
 * including fetching all users, filtering by status, and getting top users.
 * It's designed for admin interfaces and user management dashboards.
 *
 * Features:
 * - Get all users from backend
 * - Get user by ID
 * - Update user data
 * - Delete user
 * - Get users by status (active, banned, etc.)
 * - Get top users (ordered by number of trades)
 *
 * Usage:
 * Primarily used by admin components like UsersDetailsComponent for
 * managing and viewing user data.
 *
 * Relations:
 * - Used by UsersDetailsComponent for user management
 * - Used by OverviewComponent for user statistics
 * - Uses BackendApiService for all operations (no direct Firebase access)
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private backendApi: BackendApiService,
    private authService: AuthService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  /**
   * Get Firebase ID token for backend API calls
   */
  private async getIdToken(): Promise<string> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return await this.authService.getBearerTokenFirebase(currentUser.id);
  }

  /**
   * Get all users from backend
   * Obtiene todos los usuarios desde el endpoint GET /api/v1/users
   * El backend retorna todos los usuarios con timestamps convertidos a milisegundos
   */
  async getAllUsers(): Promise<User[]> {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return [];
    }

    try {
      const idToken = await this.getIdToken();
      console.log('📡 UserManagementService: Fetching all users from backend...');
      
      const response = await this.backendApi.getAllUsers(idToken);
      
      console.log('✅ UserManagementService: Response received:', {
        success: response.success,
        usersCount: response.data?.users?.length || 0
      });
      
      if (response.success && response.data?.users) {
        const users = response.data.users as User[];
        console.log('✅ UserManagementService: Users formatted:', users.length, 'users');
        
        // Validar que los usuarios tengan los campos requeridos
        const validUsers = users.filter(user => {
          const isValid = user.id && user.email && user.firstName && user.lastName;
          if (!isValid) {
            console.warn('⚠️ UserManagementService: Invalid user found:', user);
          }
          return isValid;
        });
        
        console.log('✅ UserManagementService: Valid users:', validUsers.length);
        return validUsers;
      }
      
      console.warn('⚠️ UserManagementService: No users in response or response not successful');
      return [];
    } catch (error: any) {
      console.error('❌ UserManagementService: Error getting all users:', error);
      console.error('❌ UserManagementService: Error details:', {
        status: error?.status,
        message: error?.message,
        error: error?.error
      });
      throw error;
    }
  }

  /**
   * Get user by ID from backend
   */
  async getUserById(userId: string): Promise<User | null> {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return null;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getUserById(userId, idToken);
      
      if (response.success && response.data?.user) {
        return response.data.user as User;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Update user data via backend
   */
  async updateUser(userId: string, userData: Partial<User>): Promise<void> {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return;
    }

    try {
      const idToken = await this.getIdToken();
      
      // Remove fields that shouldn't be sent to backend
      const { id, ...safeUserData } = userData;
      
      const response = await this.backendApi.updateUser(userId, safeUserData, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Error updating user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete user via backend
   */
  async deleteUser(userId: string): Promise<void> {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.deleteUser(userId, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Error deleting user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Get users by status from backend
   */
  async getUsersByStatus(status: UserStatus): Promise<User[]> {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return [];
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getAllUsers(idToken);
      
      if (response.success && response.data?.users) {
        // Filter by status on frontend (backend should support query params in the future)
        return (response.data.users as User[]).filter(user => user.status === status);
      }
      
      return [];
    } catch (error) {
      console.error('Error getting users by status:', error);
      throw error;
    }
  }

  /**
   * Get top users (ordered by number of trades) from backend
   */
  async getTopUsers(limitCount: number = 10): Promise<User[]> {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return [];
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getAllUsers(idToken);
      
      if (response.success && response.data?.users) {
        // Sort by number_trades descending and limit
        const users = (response.data.users as User[])
          .sort((a, b) => (b.number_trades || 0) - (a.number_trades || 0))
          .slice(0, limitCount);
        
        return users;
      }
      
      return [];
    } catch (error) {
      console.error('Error getting top users:', error);
      throw error;
    }
  }

  /**
   * Send password reset email to user via backend (admin only)
   */
  async sendPasswordResetToUser(userId: string, email?: string): Promise<void> {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      return;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.sendPasswordResetToUser(userId, idToken, email);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Error sending password reset email');
      }
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }

  /**
   * Revoke all user sessions (logout everywhere) via backend (admin only)
   * Revokes all refresh tokens and deletes all link tokens for a user
   */
  async revokeAllUserSessions(userId: string): Promise<{ message: string; tokensDeleted?: number }> {
    if (!this.isBrowser) {
      console.warn('Not available in SSR');
      throw new Error('Not available in SSR');
    }

    try {
      const idToken = await this.getIdToken();
      console.log('📡 UserManagementService: Revoking all sessions for user:', userId);
      
      const response = await this.backendApi.revokeAllUserSessions(userId, idToken);
      
      console.log('✅ UserManagementService: Sessions revoked:', {
        success: response.success,
        message: response.data?.message,
        tokensDeleted: response.data?.tokensDeleted
      });
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.error?.message || 'Error revoking user sessions');
    } catch (error) {
      console.error('❌ UserManagementService: Error revoking all user sessions:', error);
      throw error;
    }
  }
}
