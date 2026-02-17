import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

/**
 * Interface for ban reason record data.
 *
 * @interface BanReasonRecord
 */
export interface BanReasonRecord {
  id?: string;
  reason: string;
  dateBan: any; // serverTimestamp
  dateUnban: any | null; // serverTimestamp or null
}

/**
 * Service for managing user ban reasons.
 *
 * This service handles the creation and tracking of ban reasons for users.
 * It stores ban records in a subcollection under each user's document,
 * allowing administrators to track why users were banned and when they
 * were unbanned.
 *
 * Features:
 * - Create ban reason record
 * - Update ban reason (e.g., add unban date)
 * - Get latest open ban reason
 *
 * Data Structure:
 * - Stored in: `users/{userId}/reasons/{reasonId}`
 * - Tracks: ban reason, ban date, unban date
 *
 * Relations:
 * - Used by UsersDetailsComponent for ban/unban operations
 * - Used by AuthGuard for checking ban status
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({ providedIn: 'root' })
export class ReasonsService {
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private backendApi: BackendApiService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
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

  async createReason(userId: string, reason: string): Promise<string> {
    if (!this.isBrowser) {
      throw new Error('Not available in SSR');
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.createBanReason(userId, reason, idToken);
      
      if (response.success && response.data?.banReason) {
        return response.data.banReason.id || '';
      }
      throw new Error(response.error?.message || 'Failed to create ban reason');
    } catch (error) {
      console.error('Error creating ban reason:', error);
      throw error;
    }
  }

  async updateReason(userId: string, reasonId: string, data: Partial<BanReasonRecord>): Promise<void> {
    if (!this.isBrowser) {
      throw new Error('Not available in SSR');
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.updateBanReason(userId, reasonId, data, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update ban reason');
      }
    } catch (error) {
      console.error('Error updating ban reason:', error);
      throw error;
    }
  }

  async getOpenLatestReason(userId: string): Promise<BanReasonRecord | null> {
    if (!this.isBrowser) {
      return null;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getLatestBanReason(userId, idToken);
      
      if (response.success && response.data?.banReason) {
        return response.data.banReason as BanReasonRecord;
      }
      return null;
    } catch (error) {
      console.error('Error getting latest ban reason:', error);
      return null;
    }
  }
}


