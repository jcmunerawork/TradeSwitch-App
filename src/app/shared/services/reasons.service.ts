import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

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
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const { firebaseApp } = require('../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);
    }
  }

  private reasonsCollectionPath(userId: string) {
    if (!this.db) throw new Error('Firestore not available in SSR');
    return collection(this.db, 'users', userId, 'reasons');
  }

  async createReason(userId: string, reason: string): Promise<string> {
    const colRef = this.reasonsCollectionPath(userId);
    const docRef = await addDoc(colRef, {
      reason,
      dateBan: serverTimestamp(),
      dateUnban: null,
    } as BanReasonRecord);
    return docRef.id;
  }

  async updateReason(userId: string, reasonId: string, data: Partial<BanReasonRecord>): Promise<void> {
    if (!this.db) throw new Error('Firestore not available in SSR');
    await updateDoc(doc(this.db, 'users', userId, 'reasons', reasonId), data as any);
  }

  async getOpenLatestReason(userId: string): Promise<BanReasonRecord | null> {
    // Para evitar índices compuestos, ordenamos por dateBan y tomamos el más reciente
    const colRef = this.reasonsCollectionPath(userId);
    const qRef = query(colRef, orderBy('dateBan', 'desc'), limit(1));
    const snapshot = await getDocs(qRef);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    const data = docSnap.data() as BanReasonRecord;
    return { ...data, id: docSnap.id };
  }
}


