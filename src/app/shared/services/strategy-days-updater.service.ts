import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

/**
 * Service for updating strategy active days in Firebase.
 *
 * This service calculates and updates the number of days a strategy has
 * been active based on its creation date. It supports updating all user
 * strategies or a specific strategy.
 *
 * Features:
 * - Update active days for all user strategies
 * - Update active days for active strategy only
 * - Update active days for specific strategy
 * - Calculate days active from creation date
 *
 * Days Active Calculation:
 * - Calculates days from `created_at` timestamp to current date
 * - Updates `days_active` field in configuration-overview
 * - Automatically updates `updated_at` timestamp
 *
 * Relations:
 * - Used by GlobalStrategyUpdaterService for batch updates
 * - Used by StrategyCardComponent for displaying days active
 * - Updates `configuration-overview` collection
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class StrategyDaysUpdaterService {
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

  /**
   * Updates active days for the user's active strategy
   * @param userId - User ID
   */
  async updateActiveStrategyDaysActive(userId: string): Promise<void> {
    if (!this.isBrowser) {// 
      return;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.updateActiveStrategyDaysActive(userId, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update active strategy days active');
      }
    } catch (error) {// 
      throw error;
    }
  }

  /**
   * Updates active days for a specific strategy
   * @param strategyId - Strategy ID
   * @param userId - User ID (for security verification)
   */
  async updateStrategyDaysActive(strategyId: string, userId: string): Promise<void> {
    if (!this.isBrowser) {// 
      return;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.updateStrategyDaysActive(strategyId, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update strategy days active');
      }
    } catch (error) {// 
      throw error;
    }
  }

  /**
   * Calculates active days since creation date
   * @param createdAt - Firebase timestamp or creation date
   * @returns Number of active days
   */
  private calculateDaysActive(createdAt: any): number {
    let createdDate: Date;

    // Handle different Firebase timestamp types
    if (createdAt && typeof createdAt.toDate === 'function') {
      // It's a Firebase Timestamp
      createdDate = createdAt.toDate();
    } else if (createdAt && createdAt.seconds) {
      // It's an object with seconds
      createdDate = new Date(createdAt.seconds * 1000);
    } else if (createdAt instanceof Date) {
      // Already a date
      createdDate = createdAt;
    } else if (typeof createdAt === 'string') {
      // It's a date string
      createdDate = new Date(createdAt);
    } else {// 
      return 0;
    }

    // Get current date and creation date in YYYY-MM-DD format (without hours)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const createdDay = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
    
    // Calculate difference in complete days
    const diffTime = today.getTime() - createdDay.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // If it's the same day, return 0
    // If complete days have passed, return the difference
    return Math.max(0, diffDays);
  }

  /**
   * Calculates active days since creation date or last active timeline interval
   * @param createdAt - Firebase timestamp or creation date
   * @returns Number of active days
   */
  getDaysActive(createdAt: any): number {
    return this.calculateDaysActive(createdAt);
  }

  /**
   * Gets active days based on the timeline. 
   * Uses the start_date of the last interval that doesn't have an end_date.
   * @param timeline - Activity intervals
   * @param createdAtFallback - Fallback date if timeline is not available
   */
  getDaysActiveFromTimeline(timeline: any[] | undefined | null, createdAtFallback: any): number {
    if (timeline && Array.isArray(timeline) && timeline.length > 0) {
      // Look for the last object in timeline that has no end_date
      const lastActiveInterval = [...timeline].reverse().find(interval => !interval.end_date);
      
      if (lastActiveInterval && lastActiveInterval.start_date) {
        return this.calculateDaysActive(lastActiveInterval.start_date);
      }
    }
    
    // Fallback to original created_at logic
    return this.calculateDaysActive(createdAtFallback);
  }
}
