import { Injectable } from '@angular/core';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { MaxDailyTradesConfig } from '../models/strategy.model';
import { firebaseApp } from '../../../firebase/firebase.init';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private db = getFirestore(firebaseApp);

  async saveMaxDailyTradesConfig(config: MaxDailyTradesConfig) {
    await setDoc(doc(this.db, 'configurations', 'maxDailyTrades'), config);
  }
}
