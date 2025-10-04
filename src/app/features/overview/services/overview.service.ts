import { Injectable } from '@angular/core';
import { OverviewDataService } from '../../../shared/services/overview-data.service';
import { AppContextService } from '../../../shared/context';

@Injectable({ providedIn: 'root' })
export class OverviewService {
  constructor(
    private overviewDataService: OverviewDataService,
    private appContext: AppContextService
  ) {}

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
