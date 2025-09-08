import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  UserCredential,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  setDoc,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { BehaviorSubject, filter, first, Observable } from 'rxjs';
import { User } from '../../overview/models/overview';
import { auth } from '../../../firebase/firebase.init';
import { AccountData, UserCredentials } from '../models/userModel';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;
  private authStateSubject = new BehaviorSubject<boolean | null>(null);
  authStateChanged = this.authStateSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (this.isBrowser) {
      const { firebaseApp } = require('../../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);

      onAuthStateChanged(getAuth(), (user) => {
        this.authStateSubject.next(user !== null);
      });
    } else {
      this.authStateSubject.next(false);
    }
  }

  getAuth() {
    return getAuth();
  }

  register(user: UserCredentials) {
    return createUserWithEmailAndPassword(getAuth(), user.email, user.password);
  }

  getUserData(uid: String): Promise<User> {
    if (this.db) {
      const userDoc = doc(this.db, 'users', uid as string);
      return getDoc(userDoc).then((doc) => {
        if (doc.exists()) {
          return doc.data() as User;
        } else {
          throw new Error('User not found');
        }
      });
    } else {
      console.warn('Firestore not available in SSR');
      return Promise.resolve({} as User);
    }
  }

  async createLinkToken(token: LinkToken) {
    if (this.db) {
      await setDoc(doc(this.db, 'tokens', token.id), token);
    } else {
      console.warn('Firestore not available in SSR');
      return;
    }
  }

  async createUser(user: User) {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }
    await setDoc(doc(this.db, 'users', user.id), user);
  }

  async createAccount(account: AccountData) {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }
    await setDoc(doc(this.db, 'accounts', account.id), account);
  }

  async getUserAccounts(userId: string): Promise<AccountData[] | null> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }
    const accountsCollection = collection(this.db, 'accounts');
    const q = query(accountsCollection, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const accounts: AccountData[] = [];
    querySnapshot.forEach((doc) => {
      accounts.push(doc.data() as AccountData);
    });
    return accounts.length > 0 ? accounts : null;
  }

  async deleteAccount(accountId: string): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }
    const accountDoc = doc(this.db, 'accounts', accountId);
    await deleteDoc(accountDoc);
  }

  login(user: UserCredentials) {
    return signInWithEmailAndPassword(getAuth(), user.email, user.password);
  }

  loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(getAuth(), provider);
  }

  loginWithApple() {
    const provider = new OAuthProvider('apple.com');
    return signInWithPopup(getAuth(), provider);
  }

  logout() {
    return getAuth().signOut();
  }

  isAuthenticated(): Observable<boolean> {
    return this.authStateSubject
      .asObservable()
      .pipe(filter((state): state is boolean => state !== null));
  }
}
