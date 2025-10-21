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
import { AlertService } from '../../../shared/services/alert.service';
import { ForgotPasswordPopupComponent } from '../../../shared/pop-ups/forgot-password/forgot-password.component';

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
  loginForm: FormGroup;
  showPassword = false;
  forgotVisible = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private store: Store,
    private router: Router,
    private appContext: AppContextService,
    private alertService: AlertService
  ) {
    this.loginForm = this.fb.group({
      loginEmail: ['', [Validators.required, Validators.email, this.emailValidator]],
      password: ['', [Validators.required]],
      rememberMe: [false],
    });

  }

  onSubmit(): void {
    // Validar campos antes de proceder
    this.validateLoginFields();
    
    if (this.loginForm.valid) {
      const userCredentials = this.createUserCredentialsObject();
      
      // Establecer estado de carga
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
              this.appContext.setLoading('user', false);
              
              // Navegar según el tipo de usuario
              if (userData.isAdmin) {
                this.router.navigate(['/overview']);
              } else {
                this.router.navigate(['/strategy']);
              }
            })
            .catch((error: any) => {
              this.appContext.setLoading('user', false);
              this.appContext.setError('user', 'Error al obtener datos del usuario');
              this.handleLoginError(error);
            });
        })
        .catch((error: any) => {
          this.appContext.setLoading('user', false);
          this.appContext.setError('user', 'Error de autenticación');
          this.handleLoginError(error);
        });
    }
  }

  openForgot(): void {
    this.forgotVisible = true;
  }

  closeForgot(): void {
    this.forgotVisible = false;
  }

  private createUserCredentialsObject(): UserCredentials {
    return {
      email: this.loginForm.value.loginEmail,
      password: this.loginForm.value.password,
    };
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  signInWithGoogle(): void {
    // TODO: Implement Google sign-in
    console.log('Google sign-in');
  }

  signInWithApple(): void {
    // TODO: Implement Apple sign-in
    console.log('Apple sign-in');
  }

  // Validador personalizado para email
  private emailValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(control.value)) {
      return { invalidEmailFormat: true };
    }
    
    return null;
  }

  // Validar campos del formulario
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
      this.alertService.showError('Validation errors:\n\n' + errors.join('\n'), 'Validation Error');
    }
  }

  // Manejar errores de login
  private handleLoginError(error: any): void {
    console.error('Login error:', error);
    
    let errorMessage = 'Login failed. ';
    
    // Verificar tipo de error específico
    if (error.code === 'auth/user-not-found') {
      errorMessage += 'No account found with this email.';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage += 'Incorrect password.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage += 'Invalid email format.';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage += 'This account has been disabled.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage += 'Too many failed attempts. Please try again later.';
    } else {
      // Error genérico - verificar si es problema de credenciales
      errorMessage += 'Email or password is incorrect. Please check your credentials and try again.';
    }
    
    this.alertService.showError(errorMessage, 'Login Error');
  }
}
