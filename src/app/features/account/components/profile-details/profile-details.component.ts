import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { User } from '../../../overview/models/overview';
import { selectUser } from '../../../auth/store/user.selectios';
import { AuthService } from '../../../auth/service/authService';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth';
import { AccountDeletionService } from '../../../../shared/services/account-deletion.service';
import { Router } from '@angular/router';
import { AppContextService } from '../../../../shared/context';
import { PasswordInputComponent } from '../../../../shared/components/password-input/password-input.component';

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
  imports: [CommonModule, ReactiveFormsModule, PasswordInputComponent],
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
      this.profileForm.patchValue({
        firstName: this.user.firstName || '',
        lastName: this.user.lastName || '',
        email: this.user.email || '',
        phoneNumber: this.user.phoneNumber || '',
        birthday: this.user.birthday || '',
      });
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
   * Updates user profile with form data.
   * 
   * This method synchronizes changes in three places:
   * 1. Firebase: Updates data in database
   * 2. AppContextService: Updates user in context (source of truth)
   * 3. Store (NgRx): Updates user state in store
   * 
   * Only updates firstName, lastName and birthday (email cannot be changed here).
   * 
   * Related to:
   * - AuthService.updateUser(): Updates data in Firebase
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

        // 1. Actualizar en Firebase
        await this.authService.updateUser(this.user.id, updatedData);
        
        // 2. Actualizar el usuario en el contexto (fuente de verdad)
        this.appContext.updateUserData(updatedData);
        
        // 3. Actualizar el usuario en el store
        this.store.dispatch({
          type: '[User] Update User',
          user: {
            ...this.user,
            ...updatedData
          }
        });
        
        console.log('✅ Profile updated successfully');
      } catch (error) {
        console.error('❌ Error updating profile:', error);
      } finally {
        this.isLoading = false;
      }
    }
  }

  /**
   * Changes user password.
   * 
   * This method requires reauthentication for security before changing password.
   * Performs:
   * 1. Verifies user is authenticated
   * 2. Reauthenticates user with current password
   * 3. Updates password in Firebase Auth
   * 4. Resets form and hides password form
   * 
   * Handles specific errors:
   * - auth/wrong-password: Current password incorrect
   * - auth/weak-password: New password too weak
   * - auth/requires-recent-login: Requires signing in again
   * 
   * Related to:
   * - Firebase Auth: reauthenticateWithCredential, updatePassword
   * - AuthService.getCurrentUser(): Gets current user from Firebase
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
        const currentUser = this.authService.getCurrentUser();
        if (!currentUser) {
          throw new Error('User not authenticated');
        }

        const currentPassword = this.passwordForm.value.currentPassword;
        const newPassword = this.passwordForm.value.newPassword;

        // Reautenticar al usuario antes de cambiar la contraseña
        const credential = EmailAuthProvider.credential(
          this.user.email,
          currentPassword
        );

        await reauthenticateWithCredential(currentUser, credential);
        
        // Cambiar la contraseña
        await updatePassword(currentUser, newPassword);
        
        this.passwordChangeMessage = 'Password updated successfully';
        this.passwordForm.reset();
        this.showPasswordForm = false;
        
      } catch (error: any) {
        console.error('❌ Error changing password:', error);
        
        if (error.code === 'auth/wrong-password') {
          this.passwordChangeError = 'Current password is incorrect';
        } else if (error.code === 'auth/weak-password') {
          this.passwordChangeError = 'New password is too weak';
        } else if (error.code === 'auth/requires-recent-login') {
          this.passwordChangeError = 'For security, please sign in again';
        } else {
          this.passwordChangeError = 'Error changing password. Please try again';
        }
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
