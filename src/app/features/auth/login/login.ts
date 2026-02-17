/**
 * Auth feature: login page.
 *
 * Email/password login form. On success: fetches user data, sets AppContext and NgRx,
 * then navigates to /overview (admin) or /strategy (user). Includes forgot-password popup.
 */
import { Component } from '@angular/core';
import { NgIf } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { PasswordInputComponent } from '../../../shared/components/password-input/password-input.component';
import { TextInputComponent } from '../../../shared/components';
import { AuthService } from '../../../shared/services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { setUserData } from '../store/user.actions';
import { User } from '../../overview/models/overview';
import { UserCredentials } from '../models/userModel';
import { AppContextService } from '../../../shared/context';
import { AlertService } from '../../../core/services';
import { ToastNotificationService } from '../../../shared/services/toast-notification.service';
import { ForgotPasswordPopupComponent } from '../../../shared/pop-ups/forgot-password/forgot-password.component';

/**
 * Login page component: email/password form, optional remember me, forgot password.
 *
 * Submit: AuthService.login → getUserData → setCurrentUser + setUserData → navigate by role.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PasswordInputComponent,
    TextInputComponent,
    RouterLink,
    ForgotPasswordPopupComponent,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  /** Form with loginEmail, password, rememberMe. */
  loginForm: FormGroup;
  /** Toggles password visibility in the template. */
  showPassword = false;
  /** Whether the forgot-password popup is visible. */
  forgotVisible = false;
  /** True while login request is in progress. */
  isLoading = false;
  /** Error message shown when login fails. */
  errorMessage = '';

  /**
   * @param fb - FormBuilder for login form
   * @param authService - Auth service for login and getUserData
   * @param store - NgRx store for setUserData
   * @param router - Router for post-login navigation
   * @param appContext - AppContext for setCurrentUser, setLoading, setError
   * @param alertService - Alert service (injected)
   * @param toastService - Toast for validation and backend errors
   */
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private store: Store,
    private router: Router,
    private appContext: AppContextService,
    private alertService: AlertService,
    private toastService: ToastNotificationService
  ) {
    this.loginForm = this.fb.group({
      loginEmail: ['', [Validators.required, Validators.email, this.emailValidator]],
      password: ['', [Validators.required]],
      rememberMe: [false],
    });

  }

  /**
   * Validates form, then if valid: sets loading, calls AuthService.login, getUserData,
   * updates context and store, and navigates by role. On error calls handleLoginError.
   */
  onSubmit(): void {
    this.validateLoginFields();
    
    if (this.loginForm.valid) {
      const userCredentials = this.createUserCredentialsObject();
      
      // Establecer estado de carga y limpiar error previo
      this.isLoading = true;
      this.errorMessage = '';
      this.appContext.setLoading('user', true);
      this.appContext.setError('user', null);
      
      this.authService
        .login(userCredentials)
        .then((response: any) => {
          this.authService
            .getUserData(response.user.uid)
            .then((userData: User) => {
              // Actualizar contexto con datos del usuario
              this.appContext.setCurrentUser(userData);
              
              // Mantener compatibilidad con NgRx
              this.store.dispatch(setUserData({ user: userData }));
              
              // Limpiar estado de carga
              this.isLoading = false;
              this.appContext.setLoading('user', false);
              
              // Navegar según el tipo de usuario
              if (userData.isAdmin) {
                this.router.navigate(['/overview']);
              } else {
                this.router.navigate(['/strategy']);
              }
            })
            .catch((error: any) => {
              this.isLoading = false;
              this.appContext.setLoading('user', false);
              this.appContext.setError('user', 'Error al obtener datos del usuario');
              this.handleLoginError(error);
            });
        })
        .catch((error: any) => {
          this.isLoading = false;
          this.appContext.setLoading('user', false);
          this.appContext.setError('user', 'Error de autenticación');
          this.handleLoginError(error);
        });
    }
  }

  /** Opens the forgot-password popup. */
  openForgot(): void {
    this.forgotVisible = true;
  }

  /** Closes the forgot-password popup. */
  closeForgot(): void {
    this.forgotVisible = false;
  }

  /** Builds UserCredentials from login form (loginEmail → email, password). */
  private createUserCredentialsObject(): UserCredentials {
    return {
      email: this.loginForm.value.loginEmail,
      password: this.loginForm.value.password,
    };
  }

  /** Toggles showPassword for the password field. */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /** Placeholder for Google sign-in; not implemented. */
  signInWithGoogle(): void {
    // TODO: Implement Google sign-in
  }

  /** Placeholder for Apple sign-in; not implemented. */
  signInWithApple(): void {
    // TODO: Implement Apple sign-in
  }

  /** Custom validator: email must match standard email regex. */
  private emailValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(control.value)) {
      return { invalidEmailFormat: true };
    }
    
    return null;
  }

  /** Validates email and password controls and shows a toast if any validation fails. */
  private validateLoginFields(): void {
    const errors: string[] = [];
    
    const emailControl = this.loginForm.get('loginEmail');
    const passwordControl = this.loginForm.get('password');

    // Validar email
    if (emailControl?.errors?.['required']) {
      errors.push('Email is required');
    } else if (emailControl?.errors?.['email']) {
      errors.push('Invalid email format');
    } else if (emailControl?.errors?.['invalidEmailFormat']) {
      errors.push('Invalid email format. Must contain @ and a valid domain');
    }

    // Validar contraseña
    if (passwordControl?.errors?.['required']) {
      errors.push('Password is required');
    }

    // Mostrar alerta si hay errores
    if (errors.length > 0) {
      this.toastService.showError('Validation errors:\n\n' + errors.join('\n'));
    }
  }

  /** Sets errorMessage from error and shows backend error toast. */
  private handleLoginError(error: any): void {
    console.error('Login error:', error);
    
    // Extraer mensaje de error del formato del backend
    const errorMessage = this.extractErrorMessage(error);
    
    // Mostrar error en rojo en el componente
    this.errorMessage = errorMessage;
    
    // Mostrar toast notification
    this.toastService.showBackendError(error, 'Login error');
  }

  /** Extracts a single error message from backend/HTTP or Firebase Auth error shape. */
  private extractErrorMessage(error: any): string {
    // El error puede estar en diferentes ubicaciones dependiendo de cómo Angular maneje la respuesta
    if (error?.error?.error?.message) {
      // Formato del backend: error.error.error.message
      return error.error.error.message;
    } else if (error?.error?.message) {
      // Formato alternativo
      return error.error.message;
    } else if (error?.message) {
      // Mensaje genérico de HTTP
      return error.message;
    } else if (error?.code) {
      // Errores de Firebase Auth (compatibilidad)
      if (error.code === 'auth/user-not-found') {
        return 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        return 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        return 'Invalid email format.';
      } else if (error.code === 'auth/user-disabled') {
        return 'This account has been disabled.';
      } else if (error.code === 'auth/too-many-requests') {
        return 'Too many failed attempts. Please try again later.';
      }
    }
    
    // Mensaje por defecto
    return 'Email or password is incorrect. Please check your credentials and try again.';
  }
}
