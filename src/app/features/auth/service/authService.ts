import { isPlatformBrowser } from "@angular/common";
import { Inject, Injectable, PLATFORM_ID } from "@angular/core";
import { createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, OAuthProvider, signInWithEmailAndPassword, signInWithPopup, UserCredential } from "firebase/auth";
import { getFirestore, Firestore, setDoc, doc } from "firebase/firestore";
import { first } from "rxjs";



@Injectable({
  providedIn: "root",
})
export class AuthService {

  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
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

  isAuthenticated(): boolean {
    return getAuth().currentUser !== null;
  }
}