import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { getFirestore, collection, query, getDocs, updateDoc, doc, Timestamp, where } from 'firebase/firestore';
import { firebaseApp } from '../../firebase/firebase.init';

@Injectable({
  providedIn: 'root'
})
export class StrategyDaysUpdaterService {
  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.db = getFirestore(firebaseApp);
    }
  }

  /**
   * Updates active days for all user strategies
   * @param userId - User ID
   */
  async updateAllStrategiesDaysActive(userId: string): Promise<void> {
    if (!this.isBrowser || !this.db) {
      console.warn('StrategyDaysUpdaterService: Cannot execute on server');
      return;
    }

    try {
      // Get all user strategies
      const strategiesRef = collection(this.db, 'configuration-overview');
      const q = query(strategiesRef);
      const querySnapshot = await getDocs(q);
      
      const strategiesToUpdate: { id: string; daysActive: number }[] = [];

      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        
        // Verify that the strategy belongs to the user
        if (data['userId'] === userId && data['created_at']) {
          const daysActive = this.calculateDaysActive(data['created_at']);
          
          // Always update to keep synchronized
          strategiesToUpdate.push({
            id: docSnapshot.id,
            daysActive: daysActive
          });
        }
      });

      // Update all strategies
      const updatePromises = strategiesToUpdate.map(strategy => 
        updateDoc(doc(this.db!, 'configuration-overview', strategy.id), {
          days_active: strategy.daysActive,
          updated_at: Timestamp.now()
        })
      );

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

    } catch (error) {
      console.error('StrategyDaysUpdaterService: Error updating active days:', error);
      throw error;
    }
  }

  /**
   * Updates active days for the user's active strategy
   * @param userId - User ID
   */
  async updateActiveStrategyDaysActive(userId: string): Promise<void> {
    if (!this.isBrowser || !this.db) {
      console.warn('StrategyDaysUpdaterService: Cannot execute on server');
      return;
    }

    try {
      // Find the user's active strategy
      const strategiesRef = collection(this.db, 'configuration-overview');
      const q = query(
        strategiesRef,
        where('userId', '==', userId),
        where('status', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('StrategyDaysUpdaterService: No active strategy found for user:', userId);
        return;
      }

      // There should only be one active strategy
      const activeStrategyDoc = querySnapshot.docs[0];
      const data = activeStrategyDoc.data();
      
      if (!data['created_at']) {
        console.warn('StrategyDaysUpdaterService: Active strategy without creation date');
        return;
      }

      const daysActive = this.calculateDaysActive(data['created_at']);
      
      // Only update if days have changed
      if (data['days_active'] !== daysActive) {
        await updateDoc(activeStrategyDoc.ref, {
          days_active: daysActive,
          updated_at: Timestamp.now()
        });
        console.log(`StrategyDaysUpdaterService: Updated active strategy ${activeStrategyDoc.id} with ${daysActive} active days`);
      }

    } catch (error) {
      console.error('StrategyDaysUpdaterService: Error updating active strategy days:', error);
      throw error;
    }
  }

  /**
   * Updates active days for a specific strategy
   * @param strategyId - Strategy ID
   * @param userId - User ID (for security verification)
   */
  async updateStrategyDaysActive(strategyId: string, userId: string): Promise<void> {
    if (!this.isBrowser || !this.db) {
      console.warn('StrategyDaysUpdaterService: Cannot execute on server');
      return;
    }

    try {
      const strategyRef = doc(this.db, 'configuration-overview', strategyId);
      const strategyDoc = await getDocs(query(collection(this.db, 'configuration-overview')));
      
      let strategyData: any = null;
      strategyDoc.forEach(docSnapshot => {
        if (docSnapshot.id === strategyId && docSnapshot.data()['userId'] === userId) {
          strategyData = docSnapshot.data();
        }
      });

      if (!strategyData || !strategyData['created_at']) {
        console.warn('StrategyDaysUpdaterService: Strategy not found or without creation date');
        return;
      }

      const daysActive = this.calculateDaysActive(strategyData['created_at']);
      
      // Only update if days have changed
      if (strategyData['days_active'] !== daysActive) {
        await updateDoc(strategyRef, {
          days_active: daysActive,
          updated_at: Timestamp.now()
        });
      }

    } catch (error) {
      console.error('StrategyDaysUpdaterService: Error updating strategy active days:', error);
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
    } else {
      console.warn('StrategyDaysUpdaterService: Unrecognized date format:', createdAt);
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
   * Gets active days of a strategy without updating in Firebase
   * @param createdAt - Firebase timestamp or creation date
   * @returns Number of active days
   */
  getDaysActive(createdAt: any): number {
    return this.calculateDaysActive(createdAt);
  }
}
