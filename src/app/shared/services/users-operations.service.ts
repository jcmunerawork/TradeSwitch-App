import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { isPlatformBrowser } from '@angular/common';
import { User } from '../../features/overview/models/overview';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

/**
 * Service for user data operations in Firebase.
 *
 * This service provides CRUD operations for user documents in Firestore.
 * It handles user creation, retrieval, updates, and deletion. It's used
 * throughout the application for user data management.
 *
 * Features:
 * - Get user data by UID
 * - Create new user
 * - Get user by ID
 * - Get user by email
 * - Update user data
 * - Get all users
 * - Delete user
 *
 * User Data Structure:
 * - Stored in: `users/{userId}`
 * - Includes: profile data, trading statistics, subscription info
 *
 * Relations:
 * - Used by AuthService for user operations
 * - Used by ProfileDetailsComponent for profile updates
 * - Used by various components for user data access
 *
 * @service
 * @injectable
 * @providedIn root
 */
@Injectable({
  providedIn: 'root'
})
export class UsersOperationsService {
  private isBrowser: boolean;
  private db: ReturnType<typeof getFirestore> | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private backendApi: BackendApiService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const { firebaseApp } = require('../../firebase/firebase.init.ts');
      this.db = getFirestore(firebaseApp);
    }
  }

  /**
   * Get Firebase ID token for backend API calls
   */
  private async getIdToken(): Promise<string> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return await currentUser.getIdToken();
  }

  /**
   * Obtener datos de un usuario por UID
   * Now uses backend API but maintains same interface
   */
  async getUserData(uid: string): Promise<User> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getUserById(uid, idToken);
      
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'User not found');
      }
      
      return response.data.user as User;
    } catch (error) {
      console.error('Error getting user data:', error);
      throw error;
    }
  }

  /**
   * Crear usuario
   * Now uses backend API but maintains same interface
   */
  async createUser(user: User): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.createUser(user, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Obtener un usuario por su ID
   * Now uses backend API but maintains same interface
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getUserById(userId, idToken);
      
      if (!response.success || !response.data) {
        return null;
      }
      
      return response.data.user as User;
    } catch (error) {
      console.error('Error obteniendo usuario por ID:', error);
      return null;
    }
  }

  /**
   * Buscar un usuario por su email
   * Now uses backend API but maintains same interface
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getUserByEmail(email, idToken);
      
      if (!response.success || !response.data) {
        return null;
      }
      
      return response.data.user as User;
    } catch (error) {
      console.error('Error buscando usuario por email:', error);
      return null;
    }
  }

  /**
   * Actualizar un usuario existente
   * Now uses backend API but maintains same interface
   */
  async updateUser(userId: string, userData: Partial<User>): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const updateData = {
        ...userData,
        lastUpdated: new Date().getTime()
      };
      const response = await this.backendApi.updateUser(userId, updateData, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      throw error;
    }
  }

  /**
   * Obtener todos los usuarios
   * Now uses backend API but maintains same interface
   */
  async getAllUsers(): Promise<User[]> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getAllUsers(idToken);
      
      if (!response.success || !response.data) {
        return [];
      }
      
      return response.data.users || [];
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  /**
   * Eliminar un usuario
   * Now uses backend API but maintains same interface
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.deleteUser(userId, idToken);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      throw error;
    }
  }
}
