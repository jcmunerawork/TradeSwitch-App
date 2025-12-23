import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { isPlatformBrowser } from '@angular/common';

/**
 * Interface for link token data.
 *
 * @interface LinkToken
 */
export interface LinkToken {
  id: string;
  [key: string]: any;
}

/**
 * Service for managing link tokens in Firebase.
 *
 * This service provides operations for creating and deleting link tokens
 * that are used for user authentication and account linking. Tokens are
 * stored in the `tokens` collection.
 *
 * Features:
 * - Create link token
 * - Delete link token
 *
 * Token Structure:
 * - Stored in: `tokens/{tokenId}`
 * - Used for: User authentication, account linking
 *
 * Relations:
 * - Used by AuthService for token management
 * - Used for logout everywhere functionality (token revocation)
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class TokensOperationsService {
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
   * Crear token de enlace
   */
  async createLinkToken(token: LinkToken): Promise<void> {
    if (this.db) {
      await setDoc(doc(this.db, 'tokens', token.id), token);
    } else {
      console.warn('Firestore not available in SSR');
      return;
    }
  }

  /**
   * Eliminar token de enlace
   */
  async deleteLinkToken(tokenId: string): Promise<void> {
    if (this.db) {
      await deleteDoc(doc(this.db, 'tokens', tokenId));
    } else {
      console.warn('Firestore not available in SSR');
      return;
    }
  }
}
