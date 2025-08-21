import { isPlatformBrowser } from "@angular/common";
import { Inject, Injectable, PLATFORM_ID } from "@angular/core";
import { createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, OAuthProvider, signInWithEmailAndPassword, signInWithPopup, UserCredential } from "firebase/auth";
import { getFirestore, Firestore, setDoc, doc, getDoc } from "firebase/firestore";
import { first, Observable } from "rxjs";



@Injectable({
  providedIn: "root",
})
export class AuthService {

  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;
  authStateChanged: Observable<boolean> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.authStateChanged = new Observable<boolean>((observer) => {
      const unsubscribe = getAuth().onAuthStateChanged((user) => {
        observer.next(user !== null);
      });
      return () => unsubscribe();
    });
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const { firebaseApp } = require('../../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);
    }
  }

  getAuth() {
    return getAuth();
  }


  /*   createUser(user: User){
      //Guardar datos en firestore
      const db: Firestore = getFirestore();
      // Aquí puedes guardar los datos del usuario en Firestore
      setDoc(db.collection('users').doc(user.id), {
        email: user.email,
        name: user.password,
        // Otros campos que desees guardar
      });
    } */

  register(user: UserCredentials) {
    return createUserWithEmailAndPassword(getAuth(), user.email, user.password);
  }

  getUserData(uid : String): Promise<User> {
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

    // Aquí puedes crear un token de enlace para el usuario

  }

  async createUser(user: User) {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }
    await setDoc(doc(this.db, 'users', user.id), user);
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

  isAuthenticated() {
    const user = getAuth().currentUser;
    return user !== null;
  }
}