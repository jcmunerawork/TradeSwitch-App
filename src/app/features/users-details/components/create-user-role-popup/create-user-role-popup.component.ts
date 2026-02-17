import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { TextInputComponent } from '../../../../shared/components/text-input/text-input.component';
import { PasswordInputComponent } from '../../../../shared/components/password-input/password-input.component';
import { PhoneInputComponent } from '../../../../shared/components/phone-input/phone-input.component';
import { BirthdayInputComponent } from '../../../../shared/components/birthday-input/birthday-input.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { SubscriptionService, Subscription } from '../../../../shared/services/subscription-service';
import { User, UserStatus } from '../../../overview/models/overview';
import { LinkToken } from '../../../../shared/services/tokens-operations.service';
import { UserCredentials } from '../../../auth/models/userModel';
import { AlertService } from '../../../../core/services';
import { BackendApiService } from '../../../../core/services/backend-api.service';

/**
 * Component for creating new users with role selection (user or admin).
 *
 * This component provides a two-step process for creating new users:
 * 1. Role selection (user or admin)
 * 2. User registration form with validation
 *
 * It handles complete user creation including Firebase Authentication,
 * user document creation, link token generation, and free subscription assignment.
 *
 * Features:
 * - Two-step wizard (role selection → form)
 * - Role selection (user or admin)
 * - Form validation (email, password, phone, birthday, name)
 * - Email uniqueness check
 * - Age validation (minimum 18 years)
 * - Phone number validation
 * - Email format validation
 * - Confirmation dialogs before creation
 * - Success state with options to create another or go to list
 * - Automatic free subscription assignment
 *
 * Validation:
 * - Email: Must be unique and valid format
 * - Password: Minimum 8 characters
 * - Phone: Valid international format (10-15 digits)
 * - Birthday: User must be at least 18 years old
 * - Name: Minimum 2 characters for first and last name
 *
 * Relations:
 * - AuthService: Creates user in Firebase Auth and Firestore
 * - SubscriptionService: Creates free subscription for new users
 * - TextInputComponent: Form input component
 * - PasswordInputComponent: Password input with validation
 * - PhoneInputComponent: Phone number input with country code
 * - BirthdayInputComponent: Date picker for birthday
 * - AlertService: Shows error notifications
 *
 * @component
 * @selector app-create-user-role-popup
 * @standalone true
 */
@Component({
  selector: 'app-create-user-role-popup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TextInputComponent, PasswordInputComponent, PhoneInputComponent, BirthdayInputComponent],
  templateUrl: './create-user-role-popup.component.html',
  styleUrls: ['./create-user-role-popup.component.scss']
})
export class CreateUserRolePopupComponent implements OnChanges {
  @Input() visible = false;
  @Output() close = new EventEmitter<void>();
  @Output() selectRole = new EventEmitter<'user' | 'admin'>();
  @Output() created = new EventEmitter<void>();

  step: 'role' | 'form' = 'role';
  role: 'user' | 'admin' | null = null;
  form: FormGroup;
  showCancelConfirm = false;
  showSuccess = false;
  showCreateConfirm = false;

  constructor(
    private fb: FormBuilder, 
    private authService: AuthService, 
    private subscriptionService: SubscriptionService, 
    private alertService: AlertService,
    private backendApi: BackendApiService
  ) {
    this.form = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email, this.emailValidator]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      birthday: ['', [Validators.required, this.ageValidator]],
      phoneNumber: ['', [Validators.required, this.phoneValidator]],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && !this.visible) {
      // Al cerrarse, dejar todo listo para comenzar siempre desde 'role'
      this.step = 'role';
      this.role = null;
      this.form.reset({ firstName: '', lastName: '', email: '', password: '', phoneNumber: '' });
      this.showCancelConfirm = false;
      this.showSuccess = false;
    }
  }

  onSelect(role: 'user' | 'admin') {
    this.role = role;
    this.step = 'form';
    this.selectRole.emit(role);
  }

  onCancel() {
    this.showCancelConfirm = true;
  }

  // Cancel confirmation overlay actions
  confirmCancel() {
    this.showCancelConfirm = false;
    this.step = 'role';
    this.role = null;
    this.close.emit();
  }

  keepEditing() {
    this.showCancelConfirm = false;
  }

  // Pre-confirmation before creating the user
  submitCreateUser() {
    if (!this.form.valid || !this.role) return;
    this.showCreateConfirm = true;
  }

  

  async confirmCreate() {
    try {
      const email = this.form.value.email;
      const password = this.form.value.password;

      // Verificar que el email no esté ya registrado usando el endpoint del backend
      // El backend retorna { user: {...} } si existe, o { user: null } si no existe
      try {
        const existingUser = await this.authService.getUserByEmail(email);
        
        if (existingUser) {
          console.warn('⚠️ CreateUserRolePopup: Email already registered');
          this.alertService.showError(
            'This email is already registered. Please use a different email or try logging in.', 
            'Email Already Registered'
          );
          return;
        }
        
      } catch (error: any) {
        // Si falla la verificación (ej: error de red), continuar
        // El backend también validará el email duplicado en /auth/signup
        console.warn('⚠️ CreateUserRolePopup: Could not verify email existence, continuing with user creation:', error);
        console.warn('⚠️ CreateUserRolePopup: Backend will validate email uniqueness during signup');
      }

      // Llamar al backend - EL BACKEND HACE TODO:
      // 1. Crea usuario en Firebase Auth
      // 2. Crea documento de usuario en Firestore
      // 3. Crea link token
      // 4. Crea suscripción inicial (Free)
      // autoLogin: false para evitar que se haga login automático cuando admin crea usuarios
      // Esto mantiene la sesión del admin activa
      const signupResponse = await this.backendApi.signup({
        email: email,
        password: password,
        firstName: this.form.value.firstName,
        lastName: this.form.value.lastName,
        phoneNumber: this.form.value.phoneNumber,
        birthday: this.form.value.birthday,
        isAdmin: this.role === 'admin',
        autoLogin: false // Admin creando usuario: no hacer login automático
      });

      if (!signupResponse.success || !signupResponse.data) {
        throw new Error(signupResponse.error?.message || 'Error creating user');
      }

      const userId = signupResponse.data.user.uid;

      this.showSuccess = true;
      this.created.emit();
    } catch (e: any) {
      console.error('❌ CreateUserRolePopup: Error creating user:', e);
      this.alertService.showError(
        e.message || 'An error occurred while creating the user. Please try again.',
        'Error Creating User'
      );
    }
  }

  keepEditingCreate() {
    this.showCreateConfirm = false;
  }

  // ===== Validators (ported from signup.ts) =====
  private phoneValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanPhone = String(control.value).replace(/[\s\-\(\)]/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      return { invalidPhone: true };
    }
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return { invalidPhoneLength: true };
    }
    return null;
  }

  private ageValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const today = new Date();
    const birthDate = new Date(control.value);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 18) {
      return { underage: true };
    }
    return null;
  }

  private emailValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(control.value)) {
      return { invalidEmailFormat: true };
    }
    return null;
  }

  successCreateAnother() {
    this.showSuccess = false;
    this.form.reset({ firstName: '', lastName: '', email: '', password: '', phoneNumber: '' });
  }

  successGoToList() {
    this.showSuccess = false;
    this.step = 'role';
    this.role = null;
    this.close.emit();
  }
}