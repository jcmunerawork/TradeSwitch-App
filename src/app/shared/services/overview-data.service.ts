import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, collection, getDocs, query, where, orderBy, limit, startAfter, doc, getDoc } from 'firebase/firestore';
import { isPlatformBrowser } from '@angular/common';

/**
 * Service for fetching overview dashboard data.
 *
 * This service provides methods to fetch data for the admin overview dashboard,
 * including users, subscriptions, monthly reports, strategies, and accounts.
 * It supports pagination for large datasets.
 *
 * Features:
 * - Get overview subscription data
 * - Get users data (with pagination)
 * - Get user accounts (with pagination)
 * - Get monthly reports data
 * - Get configuration overview data
 * - Get accounts data
 *
 * Pagination:
 * - Supports cursor-based pagination
 * - Orders users by subscription_date (descending)
 * - Orders accounts by accountID (descending)
 *
 * Relations:
 * - Used by OverviewService for data aggregation
 * - Used by OverviewComponent for dashboard display
 *
 * @service
 * @injectable
 * @providedIn root
 */
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
   * Paginación de usuarios para la tabla de Overview
   * Ordena por subscription_date desc (fallback: lastUpdated desc)
   */
  async getUsersPage(pageSize: number, startAfterDocId?: string) {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return { docs: [], lastDocId: undefined };
    }

    try {
      const usersCol = collection(this.db, 'users');
      let qRef: any = query(usersCol, orderBy('subscription_date', 'desc'), limit(pageSize));
      if (startAfterDocId) {
        const cursor = await getDoc(doc(this.db, 'users', startAfterDocId));
        if (cursor.exists()) {
          qRef = query(usersCol, orderBy('subscription_date', 'desc'), startAfter(cursor), limit(pageSize));
        }
      }
      const snapshot = await getDocs(qRef);
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      return { docs: snapshot.docs, lastDocId: lastDoc?.id };
    } catch (error) {
      console.error('Error getting users page:', error);
      return { docs: [], lastDocId: undefined };
    }
  }

  /**
   * Paginación de cuentas por usuario para la tabla (si se requiere desplegar cuentas)
   */
  async getUserAccountsPage(userId: string, pageSize: number, startAfterAccountId?: string) {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return { docs: [], lastDocId: undefined };
    }

    try {
      const accountsCol = collection(this.db, 'accounts');
      let qRef: any = query(
        accountsCol,
        where('userId', '==', userId),
        orderBy('accountID', 'desc'),
        limit(pageSize)
      );
      if (startAfterAccountId) {
        const cursor = await getDoc(doc(this.db, 'accounts', startAfterAccountId));
        if (cursor.exists()) {
          qRef = query(
            accountsCol,
            where('userId', '==', userId),
            orderBy('accountID', 'desc'),
            startAfter(cursor),
            limit(pageSize)
          );
        }
      }
      const snapshot = await getDocs(qRef);
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      return { docs: snapshot.docs, lastDocId: lastDoc?.id };
    } catch (error) {
      console.error('Error getting user accounts page:', error);
      return { docs: [], lastDocId: undefined };
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
