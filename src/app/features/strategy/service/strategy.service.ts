import { Injectable } from '@angular/core';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { MaxDailyTradesConfig, StrategyState } from '../models/strategy.model';
import { firebaseApp } from '../../../firebase/firebase.init';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private db = getFirestore(firebaseApp);

  async saveStrategyConfig(config: StrategyState) {
    await setDoc(doc(this.db, 'configurations', 'test-user'), config);
  }

  async getStrategyConfig() {
    return await getDoc(doc(this.db, 'configurations', 'test-user'));
  }
}
