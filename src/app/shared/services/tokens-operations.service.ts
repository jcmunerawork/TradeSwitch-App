import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { isPlatformBrowser } from '@angular/common';

export interface LinkToken {
  id: string;
  [key: string]: any;
}

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
}
