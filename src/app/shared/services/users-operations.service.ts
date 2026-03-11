import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { User } from '../../features/overview/models/overview';
import { BackendApiService } from '../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

/**
 * Service for user data operations via backend API.
 *
 * This service provides CRUD operations for user documents through the backend API.
 * All operations are handled by the backend, which manages Firestore directly.
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

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private backendApi: BackendApiService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
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
    } catch (error) {// 
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
    } catch (error) {// 
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
    } catch (error) {// 
      return null;
    }
  }

  /**
   * Buscar un usuario por su email
   * Usa el endpoint GET /api/v1/users/email del backend
   * 
   * El backend retorna:
   * - Si existe: { success: true, data: { user: {...} } }
   * - Si no existe: { success: true, data: { user: null } }
   */
  async getUserByEmail(email: string): Promise<User | null> {
    if (!this.isBrowser) {// 
      return null;
    }

    try {
      const idToken = await this.getIdToken();
      
      const response = await this.backendApi.getUserByEmail(email, idToken);
      
      if (!response.success) {// 
        return null;
      }
      
      // El backend retorna { user: null } si no existe, o { user: {...} } si existe
      if (!response.data || response.data.user === null || response.data.user === undefined) {
        return null;
      }
      
      const user = response.data.user as User;
      return user;
    } catch (error: any) {// // 
      
      // Si es un 404, el usuario no existe (esto es válido)
      if (error?.status === 404) {
        return null;
      }
      
      // Para otros errores, retornar null pero loguear el error
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
    } catch (error) {// 
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
    } catch (error) {// 
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
    } catch (error) {// 
      throw error;
    }
  }
}
