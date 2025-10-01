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

@Component({
  selector: 'app-profile-details',
  imports: [CommonModule, ReactiveFormsModule],
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

  constructor(private store: Store) {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      birthday: ['', [Validators.required]],
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.getUserData();
  }

  private getUserData(): void {
    this.store.select(selectUser).subscribe({
      next: (userData) => {
        this.user = userData.user;
        if (this.user) {
          this.populateForm();
        }
      },
      error: (err) => {
        console.error('Error fetching user data', err);
      },
    });
  }

  private populateForm(): void {
    if (this.user) {
      this.profileForm.patchValue({
        firstName: this.user.firstName || '',
        lastName: this.user.lastName || '',
        email: this.user.email || '',
        birthday: this.user.birthday || '',
      });
    }
  }

  private passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    
    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  async onUpdateProfile(): Promise<void> {
    if (this.profileForm.valid && this.user) {
      this.isLoading = true;
      try {
        await this.authService.updateUser(this.user.id, {
          firstName: this.profileForm.value.firstName,
          lastName: this.profileForm.value.lastName,
          birthday: this.profileForm.value.birthday,
        });
        
        // Actualizar el usuario en el store
        this.store.dispatch({
          type: '[User] Update User',
          user: {
            ...this.user,
            firstName: this.profileForm.value.firstName,
            lastName: this.profileForm.value.lastName,
            birthday: this.profileForm.value.birthday,
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

  togglePasswordForm(): void {
    this.showPasswordForm = !this.showPasswordForm;
    this.passwordChangeMessage = '';
    this.passwordChangeError = '';
    this.passwordForm.reset();
  }

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
   * Muestra el modal de confirmación para eliminar la cuenta
   */
  showDeleteAccountModal(): void {
    this.showDeleteModal = true;
    this.deleteAccountError = '';
  }

  /**
   * Cancela la eliminación de cuenta
   */
  cancelDeleteAccount(): void {
    this.showDeleteModal = false;
    this.deleteAccountError = '';
  }

  /**
   * Elimina la cuenta del usuario y todos sus datos asociados
   */
  async confirmDeleteAccount(): Promise<void> {
    if (!this.user) {
      this.deleteAccountError = 'User not found';
      return;
    }

    this.isDeletingAccount = true;
    this.deleteAccountError = '';

    try {
      console.log('🗑️ Starting account deletion for user:', this.user.id);

      // 1. Delete all Firebase data
      const firebaseDataDeleted: boolean = await this.accountDeletionService.deleteUserData(this.user.id);
      
      if (!firebaseDataDeleted) {
        throw new Error('Error deleting Firebase data');
      }

      // 2. Delete user from Firebase Auth
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        await deleteUser(currentUser);
        console.log('✅ User deleted from Firebase Auth');
      }

      // 3. Clear local store
      this.store.dispatch({
        type: '[User] Clear User'
      });

      // 4. Redirect to login
      this.router.navigate(['/login']);
      
      console.log('✅ Account deleted successfully');

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
