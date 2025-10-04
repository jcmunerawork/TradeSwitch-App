import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class OverviewDataService {
  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const { firebaseApp } = require('../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);
    }
  }

  /**
   * Get overview subscription data
   */
  async getOverviewSubscriptionData() {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }

    try {
      const snapshot = await getDocs(collection(this.db, 'overview-subscriptions'));
      return snapshot;
    } catch (error) {
      console.error('Error getting overview subscription data:', error);
      return null;
    }
  }

  /**
   * Get users data for overview
   */
  async getUsersData() {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }

    try {
      const snapshot = await getDocs(collection(this.db, 'users'));
      return snapshot;
    } catch (error) {
      console.error('Error getting users data:', error);
      return null;
    }
  }

  /**
   * Get monthly reports data
   */
  async getMonthlyReportsData() {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }

    try {
      const snapshot = await getDocs(collection(this.db, 'monthly_reports'));
      return snapshot;
    } catch (error) {
      console.error('Error getting monthly reports data:', error);
      return null;
    }
  }

  /**
   * Get configuration overview data
   */
  async getConfigurationOverviewData() {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }

    try {
      const snapshot = await getDocs(collection(this.db, 'configuration-overview'));
      return snapshot;
    } catch (error) {
      console.error('Error getting configuration overview data:', error);
      return null;
    }
  }

  /**
   * Get accounts data
   */
  async getAccountsData() {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }

    try {
      const snapshot = await getDocs(collection(this.db, 'accounts'));
      return snapshot;
    } catch (error) {
      console.error('Error getting accounts data:', error);
      return null;
    }
  }
}
