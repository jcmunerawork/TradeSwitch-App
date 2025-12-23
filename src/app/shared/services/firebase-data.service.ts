import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';

/**
 * Generic service for Firebase Firestore operations.
 *
 * This service provides generic CRUD operations for any Firestore collection,
 * making it a utility service for common database operations. It abstracts
 * away the Firebase API details and provides a simple interface.
 *
 * Features:
 * - Get all documents from a collection
 * - Get document by ID
 * - Create document (with or without custom ID)
 * - Update document
 * - Delete document
 * - Query documents by field
 * - Check if document exists
 *
 * Usage:
 * Useful for simple operations that don't require specialized services.
 * For complex operations, use specific services (e.g., StrategyOperationsService).
 *
 * Relations:
 * - Used as a utility service throughout the application
 * - Provides generic database access patterns
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class FirebaseDataService {
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
   * Generic method to get all documents from a collection
   */
  async getCollection(collectionName: string): Promise<any[]> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return [];
    }

    try {
      const snapshot = await getDocs(collection(this.db, collectionName));
      const documents: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        (data as any).id = doc.id;
        documents.push(data);
      });
      
      return documents;
    } catch (error) {
      console.error(`Error getting collection ${collectionName}:`, error);
      return [];
    }
  }

  /**
   * Generic method to get a document by ID
   */
  async getDocument(collectionName: string, docId: string): Promise<any | null> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }

    try {
      const docRef = doc(this.db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        (data as any).id = docSnap.id;
        return data;
      }
      return null;
    } catch (error) {
      console.error(`Error getting document ${docId} from ${collectionName}:`, error);
      return null;
    }
  }

  /**
   * Generic method to create a document
   */
  async createDocument(collectionName: string, data: any, docId?: string): Promise<string> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      throw new Error('Firestore not available');
    }

    try {
      if (docId) {
        await setDoc(doc(this.db, collectionName, docId), data);
        return docId;
      } else {
        const docRef = await addDoc(collection(this.db, collectionName), data);
        return docRef.id;
      }
    } catch (error) {
      console.error(`Error creating document in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Generic method to update a document
   */
  async updateDocument(collectionName: string, docId: string, data: any): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    try {
      await updateDoc(doc(this.db, collectionName, docId), data);
    } catch (error) {
      console.error(`Error updating document ${docId} in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Generic method to delete a document
   */
  async deleteDocument(collectionName: string, docId: string): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }

    try {
      await deleteDoc(doc(this.db, collectionName, docId));
    } catch (error) {
      console.error(`Error deleting document ${docId} from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Generic method to query documents
   */
  async queryDocuments(collectionName: string, field: string, operator: any, value: any): Promise<any[]> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return [];
    }

    try {
      const q = query(
        collection(this.db, collectionName),
        where(field, operator, value)
      );
      
      const snapshot = await getDocs(q);
      const documents: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        (data as any).id = doc.id;
        documents.push(data);
      });
      
      return documents;
    } catch (error) {
      console.error(`Error querying documents from ${collectionName}:`, error);
      return [];
    }
  }

  /**
   * Check if a document exists
   */
  async documentExists(collectionName: string, docId: string): Promise<boolean> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return false;
    }

    try {
      const docRef = doc(this.db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error(`Error checking if document ${docId} exists in ${collectionName}:`, error);
      return false;
    }
  }
}
