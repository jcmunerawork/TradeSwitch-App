import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, getDocs, collection } from 'firebase/firestore';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class OverviewService {
  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const { firebaseApp } = require('../../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);
    }
  }

  async getOverviewSubscriptionData() {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }
    const snapshot = await getDocs(
      collection(this.db, 'overview-subscriptions')
    );
    return snapshot;
  }

  async getUsersData() {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }
    const snapshot = await getDocs(collection(this.db, 'users'));
    return snapshot;
  }
}
