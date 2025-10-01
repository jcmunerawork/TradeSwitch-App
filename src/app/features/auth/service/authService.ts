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

  async getAllAccounts(): Promise<AccountData[] | null> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return null;
    }
    const accountsCollection = collection(this.db, 'accounts');
    const querySnapshot = await getDocs(accountsCollection);
    const accounts: AccountData[] = [];
    querySnapshot.forEach((doc) => {
      accounts.push(doc.data() as AccountData);
    });
    return accounts.length > 0 ? accounts : null;
  }

  async checkEmailExists(emailTradingAccount: string, currentUserId: string): Promise<boolean> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return false;
    }
    const accountsCollection = collection(this.db, 'accounts');
    const q = query(
      accountsCollection, 
      where('emailTradingAccount', '==', emailTradingAccount),
      where('userId', '!=', currentUserId) // Exclude current user's accounts
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty; // Returns true if email exists for another user
  }

  async checkAccountIdExists(accountID: string, currentUserId: string): Promise<boolean> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return false;
    }
    const accountsCollection = collection(this.db, 'accounts');
    const q = query(
      accountsCollection, 
      where('accountID', '==', accountID),
      where('userId', '!=', currentUserId) // Exclude current user's accounts
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty; // Returns true if accountID exists for another user
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

  /**
   * Obtiene el usuario autenticado actual
   * @returns Usuario autenticado o null si no está autenticado
   */
  getCurrentUser(): any {
    try {
      if (!this.isBrowser) {
        return null;
      }
      return getAuth().currentUser;
    } catch (error) {
      console.error('Error obteniendo usuario actual:', error);
      return null;
    }
  }

  /**
   * Obtiene un usuario por su ID
   * @param userId ID del usuario
   * @returns Promise con el usuario o null si no existe
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      if (!this.isBrowser || !this.db) {
        return null;
      }

      const userDoc = await getDoc(doc(this.db, 'users', userId));
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as User;
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo usuario por ID:', error);
      return null;
    }
  }

  /**
   * Actualiza un usuario existente
   * @param userId ID del usuario
   * @param userData Datos actualizados del usuario
   * @returns Promise void
   */
  async updateUser(userId: string, userData: Partial<User>): Promise<void> {
    try {
      if (!this.isBrowser || !this.db) {
        throw new Error('No se puede actualizar usuario en el servidor');
      }

      await setDoc(doc(this.db, 'users', userId), {
        ...userData,
        lastUpdated: new Date().getTime()
      }, { merge: true });
      
      console.log('Usuario actualizado exitosamente:', userId);
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      throw error;
    }
  }

  async getBearerTokenFirebase(userId: string): Promise<string> {
    const token = await getAuth().currentUser?.getIdToken().then((token) => {
      return token;
    });
    if (!token) {
      throw new Error('Token not found');
    }
    return token;
  }
}
