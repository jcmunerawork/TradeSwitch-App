import { Injectable } from '@angular/core';
import { OverviewDataService } from '../../../shared/services/overview-data.service';
import { AppContextService } from '../../../shared/context';

/**
 * Service for fetching and managing overview data.
 * 
 * This service acts as a bridge between the OverviewComponent and
 * the data layer, handling loading states and error management
 * through the AppContextService.
 * 
 * Related to:
 * - OverviewDataService: Fetches raw data from Firebase
 * - AppContextService: Manages global loading states and data updates
 * 
 * @injectable
 * @providedIn root
 */
@Injectable({ providedIn: 'root' })
export class OverviewService {
  /**
   * Constructor for OverviewService.
   * 
   * @param overviewDataService - Service for fetching overview data from Firebase
   * @param appContext - Application context service for state management
   */
  constructor(
    private overviewDataService: OverviewDataService,
    private appContext: AppContextService
  ) {}

  /**
   * Fetches overview subscription data from Firebase.
   * 
   * Manages loading state and error handling through AppContextService.
   * Updates the global overview subscriptions data when successful.
   * 
   * Related to:
   * - OverviewDataService.getOverviewSubscriptionData(): Fetches data from Firebase
   * - AppContextService.setLoading(): Manages loading state
   * - AppContextService.updateOverviewSubscriptions(): Updates global state
   * - AppContextService.setError(): Manages error state
   * 
   * @async
   * @returns Promise resolving to subscription data document snapshot
   * @throws Error if data fetch fails
   */
  async getOverviewSubscriptionData() {
    this.appContext.setLoading('overview', true);
    this.appContext.setError('overview', null);
    
    try {
      const subscriptions = await this.overviewDataService.getOverviewSubscriptionData();
      this.appContext.updateOverviewSubscriptions(subscriptions?.docs?.map(doc => doc.data()) || []);
      this.appContext.setLoading('overview', false);
      return subscriptions;
    } catch (error) {
      this.appContext.setLoading('overview', false);
      this.appContext.setError('overview', 'Error al obtener datos de suscripciones');
      throw error;
    }
  }

  /**
   * Fetches user data from Firebase.
   * 
   * Manages loading state and error handling through AppContextService.
   * Updates the global overview users data when successful.
   * 
   * Related to:
   * - OverviewDataService.getUsersData(): Fetches data from Firebase
   * - AppContextService.setLoading(): Manages loading state
   * - AppContextService.updateOverviewUsers(): Updates global state
   * - AppContextService.setError(): Manages error state
   * 
   * @async
   * @returns Promise resolving to users data document snapshot
   * @throws Error if data fetch fails
   */
  async getUsersData() {
    this.appContext.setLoading('overview', true);
    this.appContext.setError('overview', null);
    
    try {
      const users = await this.overviewDataService.getUsersData();
      const usersData = users?.docs?.map(doc => doc.data() as any) || [];
      this.appContext.updateOverviewUsers(usersData);
      this.appContext.setLoading('overview', false);
      return users;
    } catch (error) {
      this.appContext.setLoading('overview', false);
      this.appContext.setError('overview', 'Error al obtener datos de usuarios');
      throw error;
    }
  }
}
