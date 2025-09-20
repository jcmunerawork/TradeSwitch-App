import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { MaxDailyTradesConfig, StrategyState } from '../models/strategy.model';
import { firebaseApp } from '../../../firebase/firebase.init';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const { firebaseApp } = require('../../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);
    }
  }

  async saveStrategyConfig(userId: string, config: any) {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }
    await setDoc(doc(this.db, 'configurations', userId), config);
  }

  async getStrategyConfig(userId: string) {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }
    const snapshot = await getDoc(doc(this.db, 'configurations', userId));

    return snapshot;
  }
}
