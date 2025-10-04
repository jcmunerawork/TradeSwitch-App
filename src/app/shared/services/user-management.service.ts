import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { isPlatformBrowser } from '@angular/common';
import { User, UserStatus } from '../../features/overview/models/overview';

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
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
   * Get all users from Firebase
   */
  async getAllUsers(): Promise<User[]> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return [];
    }

    try {
      const snapshot = await getDocs(collection(this.db, 'users'));
      const users: User[] = [];
      
      snapshot.forEach((doc) => {
        const userData = doc.data() as User;
        (userData as any).id = doc.id;
        users.push(userData);
      });
      
      return users;
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }

    try {
      const userDoc = await getDoc(doc(this.db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        (userData as any).id = userDoc.id;
        return userData;
      }
      return null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  /**
   * Update user data
   */
  async updateUser(userId: string, userData: Partial<User>): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    try {
      await updateDoc(doc(this.db, 'users', userId), userData);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    try {
      await deleteDoc(doc(this.db, 'users', userId));
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Get users by status
   */
  async getUsersByStatus(status: UserStatus): Promise<User[]> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return [];
    }

    try {
      const q = query(
        collection(this.db, 'users'),
        where('status', '==', status)
      );
      
      const snapshot = await getDocs(q);
      const users: User[] = [];
      
      snapshot.forEach((doc) => {
        const userData = doc.data() as User;
        (userData as any).id = doc.id;
        users.push(userData);
      });
      
      return users;
    } catch (error) {
      console.error('Error getting users by status:', error);
      return [];
    }
  }

  /**
   * Get top users (ordered by some criteria)
   */
  async getTopUsers(limitCount: number = 10): Promise<User[]> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return [];
    }

    try {
      const q = query(
        collection(this.db, 'users'),
        orderBy('number_trades', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      const users: User[] = [];
      
      snapshot.forEach((doc) => {
        const userData = doc.data() as User;
        (userData as any).id = doc.id;
        users.push(userData);
      });
      
      return users;
    } catch (error) {
      console.error('Error getting top users:', error);
      return [];
    }
  }
}
