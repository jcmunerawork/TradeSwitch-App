import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { isPlatformBrowser } from '@angular/common';
import { User } from '../../features/overview/models/overview';

@Injectable({
  providedIn: 'root'
})
export class UsersOperationsService {
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
   * Obtener datos de un usuario por UID
   */
  async getUserData(uid: string): Promise<User> {
    if (this.db) {
      const userDoc = doc(this.db, 'users', uid);
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

  /**
   * Crear usuario
   */
  async createUser(user: User): Promise<void> {
    if (!this.db) {
      console.warn('Firestore not available in SSR');
      return;
    }
    await setDoc(doc(this.db, 'users', user.id), user);
  }

  /**
   * Obtener un usuario por su ID
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
   * Actualizar un usuario existente
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

  /**
   * Obtener todos los usuarios
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
        const data = doc.data() as User;
        (data as any).id = doc.id;
        users.push(data);
      });
      
      return users;
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  /**
   * Eliminar un usuario
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      if (!this.isBrowser || !this.db) {
        throw new Error('No se puede eliminar usuario en el servidor');
      }

      await deleteDoc(doc(this.db, 'users', userId));
      console.log('Usuario eliminado exitosamente:', userId);
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      throw error;
    }
  }
}
