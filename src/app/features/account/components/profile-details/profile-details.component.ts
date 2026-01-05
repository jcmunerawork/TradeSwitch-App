import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { User } from '../../../overview/models/overview';
import { selectUser } from '../../../auth/store/user.selectios';
import { AuthService } from '../../../auth/service/authService';
import { deleteUser } from 'firebase/auth';
import { AccountDeletionService } from '../../../../shared/services/account-deletion.service';
import { Router } from '@angular/router';
import { AppContextService } from '../../../../shared/context';
import { PasswordInputComponent } from '../../../../shared/components/password-input/password-input.component';
import { BackendApiService } from '../../../../core/services/backend-api.service';
import { ToastNotificationService } from '../../../../shared/services/toast-notification.service';
import { ToastContainerComponent } from '../../../../shared/components/toast-container/toast-container.component';

/**
 * Component for managing user profile details.
 * 
 * This component allows the user to:
 * - View and edit personal information (name, last name, email, phone, birthday)
 * - Change password with validation and reauthentication
 * - Delete account completely (Firebase data and authentication)
 * 
 * Related to:
 * - AccountComponent: Displayed in "Profile Details" tab
 * - AuthService: Updates user data and gets current user
 * - AppContextService: Gets and updates user data in context
 * - AccountDeletionService: Deletes all user data from Firebase
 * - Store (NgRx): Updates user state in store
 * - Firebase Auth: Reauthentication and password change
 * 
 * Main flow:
 * 1. On initialization, subscribes to user data from context
 * 2. Populates form with user data
 * 3. Allows updating profile (synchronizes with Firebase, context and store)
 * 4. Allows changing password (requires reauthentication)
 * 5. Allows deleting account (deletes Firebase data and authentication)
 * 
 * @component
 * @selector app-profile-details
 * @standalone true
 */
@Component({
  selector: 'app-profile-details',
  imports: [CommonModule, ReactiveFormsModule, PasswordInputComponent, ToastContainerComponent],
  templateUrl: './profile-details.component.html',
  styleUrl: './profile-details.component.scss',
  standalone: true,
})
export class ProfileDetailsComponent implements OnInit {
  user: User | null = null;
  profileForm: FormGroup;
  passwordForm: FormGroup;
  isLoading = false;
  showPasswordForm = false;
  passwordChangeMessage = '';
  passwordChangeError = '';
  showDeleteModal = false;
  isDeletingAccount = false;
  deleteAccountError = '';

  // Inyectar servicios
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private accountDeletionService = inject(AccountDeletionService);
  private router = inject(Router);
  private appContext = inject(AppContextService);
  private backendApi = inject(BackendApiService);
  private toastService = inject(ToastNotificationService);

  constructor(private store: Store) {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: [''],
      birthday: ['', [Validators.required]],
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required]], // Las validaciones específicas las maneja el componente
      confirmPassword: ['', [Validators.required]],
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.subscribeToContextData();
  }

  /**
   * Subscribes to user data from application context.
   * 
   * When user data is received, populates the form
   * with current information.
   * 
   * Related to:
   * - AppContextService.currentUser$: Observable of current user
   * - populateForm(): Populates form with user data
   * 
   * @private
   * @memberof ProfileDetailsComponent
   */
  private subscribeToContextData(): void {
    // Suscribirse a los datos del usuario desde el contexto
    this.appContext.currentUser$.subscribe({
      next: (user) => {
        this.user = user;
        if (this.user) {
          this.populateForm();
        }
      },
      error: (err) => {
        console.error('Error fetching user data from context', err);
      },
    });
  }

  /**
   * Populates profile form with current user data.
   * 
   * Updates all form fields with user values
   * (firstName, lastName, email, phoneNumber, birthday).
   * 
   * @private
   * @memberof ProfileDetailsComponent
   */
  private populateForm(): void {
    if (this.user) {
      const formattedBirthday = this.formatBirthdayForInput(this.user.birthday);
      
      // Usar patchValue para todos los campos
      this.profileForm.patchValue({
        firstName: this.user.firstName || '',
        lastName: this.user.lastName || '',
        email: this.user.email || '',
        phoneNumber: this.user.phoneNumber || '',
      });
      
      // Establecer birthday directamente en el formControl para asegurar que se asigne
      const birthdayControl = this.profileForm.get('birthday');
      if (birthdayControl && formattedBirthday) {
        birthdayControl.setValue(formattedBirthday, { emitEvent: false });
      } else if (birthdayControl && !formattedBirthday) {
        // Si no hay birthday, establecer como vacío pero no marcar como inválido si no es requerido
        birthdayControl.setValue('', { emitEvent: false });
      }
    }
  }

  /**
   * Formats birthday date for date input (YYYY-MM-DD format).
   * 
   * Handles different date formats:
   * - Firestore Timestamp (with toDate method)
   * - Date object
   * - String (ISO format or other)
   * - Number (timestamp)
   * 
   * @private
   * @param birthday - Birthday value from user object
   * @returns Formatted date string (YYYY-MM-DD) or empty string
   * @memberof ProfileDetailsComponent
   */
  private formatBirthdayForInput(birthday: any): string {
    if (!birthday) {
      return '';
    }

    try {
      let date: Date;

      // Handle Firestore Timestamp with toDate method
      if (birthday && typeof birthday === 'object' && 'toDate' in birthday && typeof birthday.toDate === 'function') {
        date = birthday.toDate();
      }
      // Handle Firestore Timestamp as plain object with _seconds and _nanoseconds
      else if (birthday && typeof birthday === 'object' && '_seconds' in birthday) {
        // Convert Firestore Timestamp object to Date
        const seconds = birthday._seconds || 0;
        const nanoseconds = birthday._nanoseconds || 0;
        date = new Date(seconds * 1000 + nanoseconds / 1000000);
      }
      // Handle Date object
      else if (birthday instanceof Date) {
        date = birthday;
      }
      // Handle string (could be ISO string or formatted string)
      else if (typeof birthday === 'string') {
        // Try parsing as ISO string first
        date = new Date(birthday);
        // If invalid, try parsing as formatted date string
        if (isNaN(date.getTime()) && birthday.includes('/')) {
          const parts = birthday.split('/');
          if (parts.length === 3) {
            // Assume format: DD/MM/YYYY or MM/DD/YYYY
            // Try DD/MM/YYYY first (common format)
            date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            if (isNaN(date.getTime())) {
              // Try MM/DD/YYYY
              date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
            }
          }
        }
      }
      // Handle number (timestamp in milliseconds or seconds)
      else if (typeof birthday === 'number') {
        // If number is less than a certain threshold, assume it's in seconds, otherwise milliseconds
        date = birthday < 10000000000 ? new Date(birthday * 1000) : new Date(birthday);
      }
      else {
        console.warn('⚠️ ProfileDetails - Unknown birthday format:', typeof birthday, birthday);
        console.warn('⚠️ ProfileDetails - Birthday structure:', JSON.stringify(birthday));
        return '';
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error('❌ ProfileDetails - Invalid date after conversion:', date);
        return '';
      }

      // Format as YYYY-MM-DD for date input
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('❌ ProfileDetails - Error formatting birthday for input:', error, birthday);
      return '';
    }
  }

  /**
   * Custom validator to verify that passwords match.
   * 
   * Compares newPassword and confirmPassword fields of the form.
   * If they don't match, sets an error on confirmPassword field.
   * 
   * @private
   * @param form - FormGroup of password form
   * @returns null if passwords match, error object if they don't match
   * @memberof ProfileDetailsComponent
   */
  private passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    
    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  /**
   * Updates user profile with form data via backend.
   * 
   * This method synchronizes changes in three places:
   * 1. Backend: Updates data via PUT /api/v1/users/:userId
   * 2. AppContextService: Updates user in context (source of truth)
   * 3. Store (NgRx): Updates user state in store
   * 
   * Only updates firstName, lastName and birthday (email cannot be changed here).
   * 
   * Related to:
   * - BackendApiService.updateUser(): Updates data via backend
   * - AppContextService.updateUserData(): Updates context
   * - Store.dispatch(): Updates NgRx store
   * 
   * @async
   * @memberof ProfileDetailsComponent
   */
  async onUpdateProfile(): Promise<void> {
    if (this.profileForm.valid && this.user) {
      this.isLoading = true;
      try {
        const updatedData = {
          firstName: this.profileForm.value.firstName,
          lastName: this.profileForm.value.lastName,
          birthday: this.profileForm.value.birthday,
        };

        // Get Firebase ID token
        const idToken = await this.authService.getBearerTokenFirebase(this.user.id);

        // 1. Update via backend
        const response = await this.backendApi.updateUser(this.user.id, updatedData, idToken);
        
        if (!response.success) {
          throw new Error(response.error?.message || 'Error updating profile');
        }

        // 2. Update user in context (source of truth)
        this.appContext.updateUserData(updatedData);
        
        // 3. Update user in store
        this.store.dispatch({
          type: '[User] Update User',
          user: {
            ...this.user,
            ...updatedData
          }
        });

        // Show success message
        this.toastService.showSuccess('Profile updated successfully');
      } catch (error: any) {
        console.error('❌ Error updating profile:', error);
        this.toastService.showBackendError(error, 'Error updating profile');
      } finally {
        this.isLoading = false;
      }
    }
  }

  /**
   * Changes user password via backend.
   * 
   * This method uses the backend endpoint POST /api/v1/users/:userId/change-password
   * which verifies the current password and updates it in Firebase Auth.
   * 
   * Performs:
   * 1. Verifies user is authenticated
   * 2. Calls backend to verify current password and update password
   * 3. Resets form and hides password form
   * 
   * Handles specific errors:
   * - Current password incorrect
   * - New password too weak
   * - Passwords do not match
   * 
   * Related to:
   * - BackendApiService.changePassword(): Changes password via backend
   * - AuthService.getBearerTokenFirebase(): Gets Firebase ID token
   * 
   * @async
   * @memberof ProfileDetailsComponent
   */
  async onChangePassword(): Promise<void> {
    if (this.passwordForm.valid && this.user) {
      this.isLoading = true;
      this.passwordChangeMessage = '';
      this.passwordChangeError = '';

      try {
        const currentPassword = this.passwordForm.value.currentPassword;
        const newPassword = this.passwordForm.value.newPassword;
        const confirmPassword = this.passwordForm.value.confirmPassword;

        // Get Firebase ID token
        const idToken = await this.authService.getBearerTokenFirebase(this.user.id);

        // Change password via backend
        const response = await this.backendApi.changePassword(
          this.user.id,
          currentPassword,
          newPassword,
          confirmPassword,
          idToken
        );

        if (!response.success) {
          throw new Error(response.error?.message || 'Error changing password');
        }
        
        // Password changed successfully - show message and logout
        this.passwordChangeMessage = 'Password updated successfully. Please sign in again.';
        this.toastService.showSuccess('Password updated successfully. Please sign in again.');
        
        // Wait a moment to show the success message
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Logout and clear all data
        await this.logoutAndClearAll();
        
        // Redirect to login
        this.router.navigate(['/login'], {
          queryParams: { 
            reason: 'password_changed',
            message: 'Your password has been changed. Please sign in with your new password.'
          }
        });
        
      } catch (error: any) {
        console.error('❌ Error changing password:', error);
        
        // Extract error message from backend
        const errorMessage = error?.error?.error?.message || error?.message || 'Error changing password. Please try again';
        
        // Handle specific error cases
        if (errorMessage.toLowerCase().includes('current password') || 
            errorMessage.toLowerCase().includes('incorrect password')) {
          this.passwordChangeError = 'Current password is incorrect';
        } else if (errorMessage.toLowerCase().includes('weak') || 
                   errorMessage.toLowerCase().includes('too short')) {
          this.passwordChangeError = 'New password is too weak. Please use at least 6 characters';
        } else if (errorMessage.toLowerCase().includes('match') || 
                   errorMessage.toLowerCase().includes('mismatch')) {
          this.passwordChangeError = 'Passwords do not match';
        } else {
          this.passwordChangeError = errorMessage;
        }

        this.toastService.showBackendError(error, 'Error changing password');
      } finally {
        this.isLoading = false;
      }
    }
  }

  /**
   * Shows or hides password change form.
   * 
   * When hidden, resets form and clears success and error messages.
   * 
   * @memberof ProfileDetailsComponent
   */
  togglePasswordForm(): void {
    this.showPasswordForm = !this.showPasswordForm;
    this.passwordChangeMessage = '';
    this.passwordChangeError = '';
    this.passwordForm.reset();
  }

  /**
   * Logout and clear all stored data.
   * 
   * This method performs a complete logout:
   * - AuthService.logout() now handles:
   *   1. Clearing session cookie
   *   2. Clearing all localStorage items
   *   3. Clearing all sessionStorage items
   *   4. Clearing all cookies
   *   5. Clearing app context
   *   6. Signing out from Firebase Auth
   * - This method only needs to clear NgRx store
   * 
   * Used after password change to force re-authentication.
   * 
   * @private
   * @async
   * @memberof ProfileDetailsComponent
   */
  private async logoutAndClearAll(): Promise<void> {
    try {
      // AuthService.logout() ya limpia todo: localStorage, sessionStorage, cookies, AppContext y Firebase Auth
      await this.authService.logout();
      
      // Solo necesitamos limpiar el store de NgRx
      this.store.dispatch({
        type: '[User] Clear User'
      });
      
    } catch (error) {
      console.error('❌ ProfileDetailsComponent: Error during logout:', error);
      // Continuar con el logout incluso si hay un error
      // Asegurarse de limpiar el store
      this.store.dispatch({
        type: '[User] Clear User'
      });
    }
  }

  /**
   * Gets error message for a profile form field.
   * 
   * Returns specific error messages based on error type:
   * - required: Field required
   * - email: Invalid email
   * - minlength: Minimum length not reached
   * 
   * Only shows errors if field has been touched.
   * 
   * @param fieldName - Form field name
   * @returns Error message or empty string if no error
   * @memberof ProfileDetailsComponent
   */
  getFieldError(fieldName: string): string {
    const field = this.profileForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${fieldName} is required`;
      }
      if (field.errors['email']) {
        return 'Invalid email';
      }
      if (field.errors['minlength']) {
        return `${fieldName} must have at least ${field.errors['minlength'].requiredLength} characters`;
      }
    }
    return '';
  }

  /**
   * Gets error message for a password form field.
   * 
   * Returns specific error messages based on error type:
   * - required: Field required
   * - minlength: Password must have at least 6 characters
   * - passwordMismatch: Passwords do not match
   * 
   * Only shows errors if field has been touched.
   * 
   * @param fieldName - Form field name
   * @returns Error message or empty string if no error
   * @memberof ProfileDetailsComponent
   */
  getPasswordFieldError(fieldName: string): string {
    const field = this.passwordForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${fieldName} is required`;
      }
      if (field.errors['minlength']) {
        return 'Password must have at least 6 characters';
      }
      if (field.errors['passwordMismatch']) {
        return 'Passwords do not match';
      }
    }
    return '';
  }

  /**
   * Shows confirmation modal to delete account.
   * 
   * This method opens the modal that requests confirmation before
   * proceeding with account deletion.
   * 
   * @memberof ProfileDetailsComponent
   */
  showDeleteAccountModal(): void {
    this.showDeleteModal = true;
    this.deleteAccountError = '';
  }

  /**
   * Cancels account deletion process.
   * 
   * Hides confirmation modal without performing any action.
   * 
   * @memberof ProfileDetailsComponent
   */
  cancelDeleteAccount(): void {
    this.showDeleteModal = false;
    this.deleteAccountError = '';
  }

  /**
   * Deletes user account and all associated data.
   * 
   * This method performs complete deletion in the following order:
   * 1. Deletes all user data from Firebase (AccountDeletionService)
   * 2. Deletes user from Firebase Authentication
   * 3. Clears local NgRx store
   * 4. Redirects user to login page
   * 
   * Handles specific errors:
   * - auth/requires-recent-login: Requires signing in again for security
   * - auth/too-many-requests: Too many attempts, try again later
   * 
   * Related to:
   * - AccountDeletionService.deleteUserData(): Deletes Firebase data
   * - Firebase Auth deleteUser(): Deletes user from authentication
   * - Store.dispatch(): Clears user state
   * - Router.navigate(): Redirects to login
   * 
   * @async
   * @memberof ProfileDetailsComponent
   */
  async confirmDeleteAccount(): Promise<void> {
    if (!this.user) {
      this.deleteAccountError = 'User not found';
      return;
    }

    this.isDeletingAccount = true;
    this.deleteAccountError = '';

    try {

      // 1. Delete all Firebase data
      const firebaseDataDeleted: boolean = await this.accountDeletionService.deleteUserData(this.user.id);
      
      if (!firebaseDataDeleted) {
        throw new Error('Error deleting Firebase data');
      }

      // 2. Delete user from Firebase Auth
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        await deleteUser(currentUser);
      }

      // 3. Clear local store
      this.store.dispatch({
        type: '[User] Clear User'
      });

      // 4. Redirect to login
      this.router.navigate(['/login']);

    } catch (error: any) {
      console.error('❌ Error deleting account:', error);
      
      if (error.code === 'auth/requires-recent-login') {
        this.deleteAccountError = 'For security, you need to sign in again before deleting your account';
      } else if (error.code === 'auth/too-many-requests') {
        this.deleteAccountError = 'Too many attempts. Please try again later';
      } else {
        this.deleteAccountError = 'Error deleting account. Please try again';
      }
    } finally {
      this.isDeletingAccount = false;
    }
  }
}
