import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc, 
  doc,
  writeBatch 
} from 'firebase/firestore';
import { firebaseApp } from '../../firebase/firebase.init';

/**
 * Service for comprehensive user account deletion.
 *
 * This service handles the complete deletion of all user data from Firebase
 * when a user requests account deletion. It uses batch operations for atomic
 * deletion of all related data across multiple collections.
 *
 * Features:
 * - Delete all user data atomically (batch operations)
 * - Delete user accounts
 * - Delete user strategies (configuration-overview and configurations)
 * - Delete monthly reports
 * - Delete plugin history
 * - Delete link tokens
 * - Delete user subscriptions
 * - Delete user document
 *
 * Deletion Process:
 * 1. Collects all user data to delete
 * 2. Uses Firestore batch for atomic operations
 * 3. Deletes in order: accounts → strategies → reports → plugin history → tokens → subscriptions → user
 * 4. Returns success/failure status
 *
 * Data Deleted:
 * - `accounts`: All user trading accounts
 * - `configuration-overview`: Strategy metadata
 * - `configurations`: Strategy rules
 * - `monthly_reports`: Monthly trading reports
 * - `plugin_history`: Plugin activation history
 * - `tokens`: Link tokens
 * - `users/{userId}/subscription`: Subscription subcollection
 * - `users/{userId}`: User document
 *
 * Relations:
 * - Used by ProfileDetailsComponent for account deletion
 * - Ensures complete data removal for GDPR compliance
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class AccountDeletionService {
  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.db = getFirestore(firebaseApp);
    }
  }

  /**
   * Deletes all data associated with a user from Firebase
   * @param userId - ID of the user to delete
   * @returns Promise<boolean> - true if deleted successfully, false if there was an error
   */
  async deleteUserData(userId: string): Promise<boolean> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return false;
    }

    try {
      
      // Use batch for atomic operations
      const batch = writeBatch(this.db);
      let operationsCount = 0;

      // 1. Delete accounts
      const accountsDeleted = await this.deleteUserAccounts(userId, batch);
      operationsCount += accountsDeleted;

      // 2. Delete configuration-overview and associated configurations
      const configsDeleted = await this.deleteUserConfigurations(userId, batch);
      operationsCount += configsDeleted;

      // 3. Delete monthly_reports
      const reportsDeleted = await this.deleteUserMonthlyReports(userId, batch);
      operationsCount += reportsDeleted;

      // 4. Delete plugin_history
      const pluginHistoryDeleted = await this.deleteUserPluginHistory(userId, batch);
      operationsCount += pluginHistoryDeleted;

      // 5. Delete tokens
      const tokensDeleted = await this.deleteUserTokens(userId, batch);
      operationsCount += tokensDeleted;

      // 6. Delete user subscription subcollection
      const subscriptionsDeleted = await this.deleteUserSubscriptions(userId, batch);
      operationsCount += subscriptionsDeleted;

      // 7. Delete user from users collection
      const userDeleted = await this.deleteUser(userId, batch);
      operationsCount += userDeleted;

      // Execute all operations in batch
      if (operationsCount > 0) {
        await batch.commit();
        return true;
      } else {
        console.log(`⚠️ No data found to delete for user ${userId}`);
        return true; // Not an error if no data exists
      }

    } catch (error) {
      console.error('❌ Error deleting user data:', error);
      return false;
    }
  }

  /**
   * Deletes all user accounts
   */
  private async deleteUserAccounts(userId: string, batch: any): Promise<number> {
    try {
      const accountsRef = collection(this.db!, 'accounts');
      const q = query(accountsRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      let count = 0;
      querySnapshot.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
        count++;
      });
      
      console.log(`📊 Deleting ${count} accounts for user ${userId}`);
      return count;
    } catch (error) {
      console.error('Error deleting accounts:', error);
      return 0;
    }
  }

  /**
   * Deletes configuration-overview and associated configurations
   */
  private async deleteUserConfigurations(userId: string, batch: any): Promise<number> {
    try {
      const configOverviewRef = collection(this.db!, 'configuration-overview');
      const q = query(configOverviewRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      let count = 0;
      const configIds: string[] = [];
      
      // First collect configurationId to delete configurations
      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        if (data['configurationId']) {
          configIds.push(data['configurationId']);
        }
        batch.delete(docSnapshot.ref);
        count++;
      });

      // Delete associated configurations
      for (const configId of configIds) {
        const configRef = doc(this.db!, 'configurations', configId);
        batch.delete(configRef);
        count++;
      }
      
      console.log(`⚙️ Deleting ${count} configurations for user ${userId}`);
      return count;
    } catch (error) {
      console.error('Error deleting configurations:', error);
      return 0;
    }
  }

  /**
   * Deletes user monthly_reports
   */
  private async deleteUserMonthlyReports(userId: string, batch: any): Promise<number> {
    try {
      const reportsRef = collection(this.db!, 'monthly_reports');
      const q = query(reportsRef, where('id', '==', userId));
      const querySnapshot = await getDocs(q);
      
      let count = 0;
      querySnapshot.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
        count++;
      });
      
      console.log(`📈 Deleting ${count} monthly reports for user ${userId}`);
      return count;
    } catch (error) {
      console.error('Error deleting monthly reports:', error);
      return 0;
    }
  }

  /**
   * Deletes user plugin_history
   */
  private async deleteUserPluginHistory(userId: string, batch: any): Promise<number> {
    try {
      const pluginHistoryRef = collection(this.db!, 'plugin_history');
      const q = query(pluginHistoryRef, where('id', '==', userId));
      const querySnapshot = await getDocs(q);
      
      let count = 0;
      querySnapshot.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
        count++;
      });
      
      console.log(`🔌 Deleting ${count} plugin histories for user ${userId}`);
      return count;
    } catch (error) {
      console.error('Error deleting plugin history:', error);
      return 0;
    }
  }

  /**
   * Deletes user tokens
   */
  private async deleteUserTokens(userId: string, batch: any): Promise<number> {
    try {
      const tokensRef = collection(this.db!, 'tokens');
      const q = query(tokensRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      let count = 0;
      querySnapshot.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
        count++;
      });
      
      console.log(`🔑 Deleting ${count} tokens for user ${userId}`);
      return count;
    } catch (error) {
      console.error('Error deleting tokens:', error);
      return 0;
    }
  }

  /**
   * Deletes user subscription subcollection
   */
  private async deleteUserSubscriptions(userId: string, batch: any): Promise<number> {
    try {
      const subscriptionsRef = collection(this.db!, 'users', userId, 'subscription');
      const querySnapshot = await getDocs(subscriptionsRef);
      
      let count = 0;
      querySnapshot.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
        count++;
      });
      
      console.log(`💳 Deleting ${count} subscriptions for user ${userId}`);
      return count;
    } catch (error) {
      console.error('Error deleting subscriptions:', error);
      return 0;
    }
  }

  /**
   * Deletes user from users collection
   */
  private async deleteUser(userId: string, batch: any): Promise<number> {
    try {
      const userRef = doc(this.db!, 'users', userId);
      batch.delete(userRef);
      console.log(`👤 Deleting user ${userId} from users collection`);
      return 1;
    } catch (error) {
      console.error('Error deleting user:', error);
      return 0;
    }
  }
}
