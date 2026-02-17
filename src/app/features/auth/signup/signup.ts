/**
 * Auth feature: signup flow.
 *
 * Multi-step registration: signup form (name, email, phone, birthday, password),
 * optional email check, backend signup (Firebase Auth + Firestore user + link token + Free subscription),
 * then plan selection (Free → strategy; paid → Stripe checkout). Admin signup skips plan selection.
 */
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { PhoneInputComponent } from '../../../shared/components/phone-input/phone-input.component';
import { BirthdayInputComponent } from '../../../shared/components/birthday-input/birthday-input.component';
import { TextInputComponent } from '../../../shared/components/text-input/text-input.component';
import { AuthService } from '../../../shared/services/auth.service';
import { PasswordInputComponent } from '../../../shared/components/password-input/password-input.component';
import { User, UserStatus } from '../../overview/models/overview';
import { UserCredentials } from '../models/userModel';
import { LinkToken } from '../models/linkModels';
import { Plan, PlanService } from '../../../shared/services/planService';
import { PlanSelectionComponent, PlanCard } from './components/plan-selection/plan-selection.component';
import { Subscription, SubscriptionService } from '../../../shared/services/subscription-service';
import { setUserData } from '../store/user.actions';
import { Store } from '@ngrx/store';
import { AppContextService } from '../../../shared/context';
import { StripeLoaderPopupComponent } from '../../../shared/pop-ups/stripe-loader-popup/stripe-loader-popup.component';
import { AlertService } from '../../../core/services';
import { BackendApiService } from '../../../core/services/backend-api.service';
import { ToastNotificationService } from '../../../shared/services/toast-notification.service';

/**
 * Signup page component: registration form and post-signup plan selection.
 *
 * Handles /signup and /admin-signup. On valid submit: optional email check, backend signup,
 * then sets user in AppContext and NgRx, and either shows plan selection (normal user) or
 * navigates to overview (admin). Plan selection can redirect to Stripe checkout for paid plans.
 */
@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PhoneInputComponent,
    BirthdayInputComponent,
    TextInputComponent,
    PasswordInputComponent,
    RouterLink,
    PlanSelectionComponent,
    StripeLoaderPopupComponent,
  ],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class SignupComponent implements OnInit {
  /** Main signup form: firstName, lastName, phoneNumber, birthday, email, password, confirmPassword. */
  signupForm: FormGroup;
  /** Secondary account form (trading account fields); built but not used in main flow. */
  accountForm: FormGroup;
  /** Current step in a multi-step flow (1-based); currently only step 1 is used. */
  currentStep = 1;
  /** True when URL is /admin-signup; admin users skip plan selection. */
  isAdminSignup: boolean = false;
  /** True after successful signup when the plan selection UI should be shown. */
  showPlanSelection = false;
  /** Snapshot of signup form values passed to plan selection. */
  userData: any = null;
  /** Plan chosen by the user in the plan selection step. */
  selectedPlan: PlanCard | null = null;
  /** User id from backend after signup; used for Stripe checkout token. */
  currentUserId: string = '';

  /** True while redirecting to Stripe checkout (loader visible). */
  showStripeLoader = false;
  /** True when Stripe redirect failed; error pop-up is shown. */
  showStripeError = false;
  /** Message shown in the Stripe error pop-up. */
  stripeErrorMessage = '';

  /** True while signup request is in progress. */
  isLoading = false;
  /** Error message shown when registration fails. */
  errorMessage = '';
  /** True when the user submitted with invalid fields and validation messages were shown. */
  showCorrectFieldsMessage = false;

  /**
   * Builds signup and account forms with validators (phone, age, email, password match).
   * @param fb - FormBuilder
   * @param authService - Auth service for getUserByEmail, getUserData, getBearerTokenFirebase
   * @param router - Router for navigation and URL check (admin-signup)
   * @param planService - Plan service for checkout (searchPlansByName)
   * @param subscriptionService - Subscription service (injected, not used in main flow)
   * @param store - NgRx store for setUserData
   * @param appContext - AppContext for setCurrentUser, setLoading, setError
   * @param alertService - Alert service (injected)
   * @param backendApi - Backend API for signup and createCheckoutSession
   * @param toastService - Toast for errors and validation messages
   */
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private planService: PlanService,
    private subscriptionService: SubscriptionService,
    private store: Store,
    private appContext: AppContextService,
    private alertService: AlertService,
    private backendApi: BackendApiService,
    private toastService: ToastNotificationService
  ) {
    this.signupForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      phoneNumber: ['', [Validators.required, this.phoneValidator]],
      birthday: ['', [Validators.required, this.ageValidator]],
      email: ['', [Validators.required, Validators.email, this.emailValidator]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.accountForm = this.fb.group({
      emailTradingAccount: ['', [Validators.required, Validators.email]],
      brokerPassword: ['', [Validators.required, Validators.minLength(6)]],
      server: ['', [Validators.required]],
      accountName: ['', [Validators.required]],
      accountID: ['', [Validators.required]],
      accountNumber: [
        '',
        [Validators.required, Validators.pattern('^[0-9]*$')],
      ],
    });
  }

  /**
   * Detects admin signup from URL (/admin-signup) and sets isAdminSignup.
   */
  ngOnInit(): void {
    const currentUrl = this.router.url;
    if (currentUrl === '/admin-signup') {
      this.isAdminSignup = true;
    }
  }

  /** Placeholder for change handlers; no-op. */
  onChange(): void {
  }

  /**
   * Handles signup form submit. If valid: checks email existence, calls backend signup,
   * sets user in context and store, then shows plan selection or navigates (admin).
   * If invalid: marks form touched and shows validation errors via toast.
   */
  async onSubmit(): Promise<void> {
    if (this.signupForm.valid) {
      try {
        // Establecer estado de carga y limpiar error previo
        this.isLoading = true;
        this.errorMessage = '';
        this.appContext.setLoading('user', true);
        this.appContext.setError('user', null);

        // Crear credenciales del usuario
        const userCredentials = this.createUserCredentialsObject();
        
        // Verificar que el email no esté ya registrado (opcional, el backend también lo valida)
        try {
          const existingUser = await this.authService.getUserByEmail(userCredentials.email);
          if (existingUser) {
            this.isLoading = false;
            this.errorMessage = 'This email is already registered. Please use a different email or try logging in.';
            this.toastService.showError(this.errorMessage);
            this.appContext.setLoading('user', false);
            return;
          }
        } catch (error) {
          // Si falla la verificación, continuar (el backend también validará)
          console.warn('Could not verify email existence, continuing with registration');
        }
        
        // Llamar al backend - EL BACKEND HACE TODO:
        // 1. Crea usuario en Firebase Auth
        // 2. Crea documento de usuario en Firestore
        // 3. Crea link token
        // 4. Crea suscripción inicial (Free)
        // 5. Hace sign in automático en Firebase Auth
        const signupResponse = await this.backendApi.signup({
          email: userCredentials.email,
          password: userCredentials.password,
          firstName: this.signupForm.value.firstName,
          lastName: this.signupForm.value.lastName,
          phoneNumber: this.signupForm.value.phoneNumber,
          birthday: this.signupForm.value.birthday,
          isAdmin: this.isAdminSignup
        });
        
        if (!signupResponse.success || !signupResponse.data) {
          throw signupResponse;
        }
        
        // El backend ya hizo sign in automáticamente, obtener el userId
        const userId = signupResponse.data.user.uid;
        
        // Obtener datos completos del usuario desde el backend
        const userData = await this.authService.getUserData(userId);
        
        // Actualizar contexto con datos completos del usuario
        this.appContext.setCurrentUser(userData);
        
        // Mantener compatibilidad con NgRx
        this.store.dispatch(setUserData({ user: userData }));
        
        // Guardar userId para usar en la selección de plan
        this.currentUserId = userId;
        
        // Limpiar estado de carga
        this.isLoading = false;
        this.appContext.setLoading('user', false);
        
        // Guardar datos del usuario para mostrar en la selección de planes
        this.userData = this.signupForm.value;
        
        // Si es admin, ir directo al dashboard
        if (userData.isAdmin) {
          this.router.navigate(['/overview']);
        } else {
          // Usuario normal: mostrar selección de planes
          this.showPlanSelection = true;
        }
        
      } catch (error: any) {
        this.isLoading = false;
        this.appContext.setLoading('user', false);
        this.appContext.setError('user', 'Error during registration');
        
        this.handleRegistrationError(error);
      }
    } else {
      this.showValidationErrors();
    }
  }

  /** Marks every control in signupForm as touched so validation errors appear. */
  private markFormGroupTouched(): void {
    Object.keys(this.signupForm.controls).forEach((key) => {
      const control = this.signupForm.get(key);
      control?.markAsTouched();
    });
  }

  /** Placeholder for Google sign-in; not implemented. */
  signInWithGoogle(): void {
  }

  /** Placeholder for Apple sign-in; not implemented. */
  signInWithApple(): void {
  }

  /** Builds UserCredentials from signup form (email, password). */
  private createUserCredentialsObject(): UserCredentials {
    return {
      email: this.signupForm.value.email,
      password: this.signupForm.value.password,
    };
  }

  /**
   * Builds a User object from signup form values and the given id/tokenId.
   * Used for initial user state (status CREATED, zeroed metrics).
   * @private
   */
  private async createUserObject(id: string, tokenId: string): Promise<User> {
    return {
      id: id,
      email: this.signupForm.value.email,
      tokenId: tokenId,
      firstName: this.signupForm.value.firstName,
      lastName: this.signupForm.value.lastName,
      phoneNumber: this.signupForm.value.phoneNumber,
      birthday: this.signupForm.value.birthday,
      best_trade: 0,
      netPnl: 0,
      number_trades: 0,
      profit: 0,
      status: UserStatus.CREATED,
      strategy_followed: 0,
      subscription_date: new Date().getTime(),
      lastUpdated: new Date().getTime(),
      total_spend: 0,
      isAdmin: false,
      trading_accounts: 0,
      strategies: 0,
    };
  }

  /**
   * Builds a LinkToken from the signup email and userId (id = email prefix + first 4 chars of userId).
   * @private
   */
  private createTokenObject(userId: string): LinkToken {
    return {
      id: this.signupForm.value.email.split('@')[0] + userId.substring(0, 4),
      userId: userId,
    };
  }

  /** Custom validator: phone must be 10–15 digits (optional leading +). */
  private phoneValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanPhone = control.value.replace(/[\s\-\(\)]/g, '');
    
    if (!phoneRegex.test(cleanPhone)) {
      return { invalidPhone: true };
    }
    
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return { invalidPhoneLength: true };
    }
    
    return null;
  }

  /** Custom validator: user must be at least 18 years old. */
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

  /** Custom validator: email must match standard email regex. */
  private emailValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(control.value)) {
      return { invalidEmailFormat: true };
    }
    
    return null;
  }

  /**
   * Returns the inline error message for a signup form control.
   * Only returns a message when the control is touched and has validation errors.
   * @param controlName - Name of the form control
   * @returns Error message or null
   */
  getControlError(controlName: string): string | null {
    const control = this.signupForm.get(controlName);
    if (!control?.errors || !control.touched) return null;

    const errors = control.errors;
    if (errors['required']) {
      const messages: Record<string, string> = {
        firstName: 'First name is required',
        lastName: 'Last name is required',
        email: 'Email is required',
        phoneNumber: 'Phone number is required',
        birthday: 'Birthday is required',
        password: 'Password is required',
      };
      return messages[controlName] ?? 'This field is required';
    }
    if (errors['minlength']) {
      const min = errors['minlength'].requiredLength;
      if (controlName === 'firstName') return 'First name must be at least 2 characters';
      if (controlName === 'lastName') return 'Last name must be at least 2 characters';
      if (controlName === 'password') return `Password must be at least ${min} characters`;
    }
    if (errors['email'] || errors['invalidEmailFormat']) {
      return 'Enter a valid email address (e.g. name@domain.com)';
    }
    if (errors['invalidPhone']) return 'Invalid phone number format (only digits and optional + at start)';
    if (errors['invalidPhoneLength']) return 'Phone number must be between 10 and 15 digits';
    if (errors['underage']) return 'You must be 18 years or older to register';
    if (errors['minLength']) return 'Password must be at least 8 characters';
    if (errors['containsNameOrEmail']) return 'Password cannot contain your name or email';
    if (errors['hasNumberOrSymbol']) return 'Password must include at least one number or symbol';
    if (errors['hasUppercase']) return 'Password must include at least one uppercase letter';
    if (errors['hasLowercase']) return 'Password must include at least one lowercase letter';
    if (errors['passwordMismatch']) return 'Passwords do not match';
    if (controlName === 'confirmPassword' && errors['required']) return 'Please confirm your password';

    return null;
  }

  /** Custom validator: confirmPassword must match password. */
  private passwordMatchValidator(): ValidationErrors | null {
    const pass = this.signupForm.get('password')?.value;
    const confirm = this.signupForm.get('confirmPassword')?.value;
    if (!confirm) return null;
    return pass === confirm ? null : { passwordMismatch: true };
  }

  /** Marks form touched, collects all control errors, and shows them in a single toast. */
  private showValidationErrors(): void {
    this.markFormGroupTouched();
    const errors: string[] = [];
    const fields = ['firstName', 'lastName', 'email', 'phoneNumber', 'birthday', 'password', 'confirmPassword'] as const;
    for (const name of fields) {
      const msg = this.getControlError(name);
      if (msg) errors.push(msg);
    }
    if (errors.length > 0) {
      this.toastService.showError('Validation errors:\n\n' + errors.join('\n'));
    }

    this.markFormGroupTouched();
  }

  /**
   * Handles plan selection after signup. Free plan → navigate to /strategy.
   * Paid plan → show Stripe loader, create checkout session, redirect to Stripe; on error show pop-up.
   * @param plan - Selected plan card
   */
  async onPlanSelected(plan: PlanCard): Promise<void> {
    this.selectedPlan = plan;
    
    // Si selecciona el plan Free, redirigir al dashboard (sin loader ni pop-ups de Stripe)
    if (plan.name.toLowerCase() === 'free') {
      this.router.navigate(['/strategy']);
      return;
    }
    
    // Solo para planes de pago: mostrar loader y manejar errores de Stripe
    try {
      this.showStripeLoader = true;
      
      // Variable para controlar si hay error
      let hasError = false;
      let errorMessage = '';
      
      try {
        await this.createCheckoutSession(plan.name);
      } catch (error) {
        // Marcar que hay error pero no mostrar pop-up aún
        hasError = true;
        errorMessage = 'Error redirecting to payment. Please try again.';
        console.error('Error during checkout session creation:', error);
      }
      
      // Esperar mínimo 2 segundos antes de mostrar error o ocultar loader
      setTimeout(() => {
        if (hasError) {
          // Si hay error, mostrar pop-up de error
          this.showStripeLoader = false;
          this.showStripeError = true;
          this.stripeErrorMessage = errorMessage;
        } else {
          // Si no hay error, el loader se ocultará automáticamente por la redirección
          this.showStripeLoader = false;
        }
      }, 2000);
      
    } catch (error: any) {
      console.error('❌ Error in plan selection:', error);
      this.showStripeLoader = false;
      this.showStripeError = true;
      this.stripeErrorMessage = 'Error processing your plan selection. Please try again.';
    }
  }

  /**
   * Creates a Stripe checkout session for the given plan and redirects to the checkout URL.
   * Uses PlanService.searchPlansByName, AuthService.getBearerTokenFirebase, BackendApiService.createCheckoutSession.
   * @private
   * @param planName - Name of the selected plan
   */
  private async createCheckoutSession(planName: string): Promise<void> {
    try {
      // Obtener el plan completo desde el servicio
      const plans = await this.planService.searchPlansByName(planName);
      const selectedPlan = plans && plans.length > 0 ? plans[0] : null;
      
      if (!selectedPlan || !selectedPlan.planPriceId) {
        throw new Error('Plan price ID not found');
      }

      console.log(selectedPlan);

      // Obtener el token de Firebase
      const bearerTokenFirebase = await this.authService.getBearerTokenFirebase(this.currentUserId);

      // Crear checkout session usando backend
      const response = await this.backendApi.createCheckoutSession(
        selectedPlan.planPriceId,
        bearerTokenFirebase
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Error creating checkout session');
      }

      const checkoutUrl = response.data.url;
      
      if (!checkoutUrl) {
        throw new Error('Checkout URL not found in response');
      }
      
      // Redirigir a la página de checkout de Stripe
      window.location.href = checkoutUrl;
      
    } catch (error) {
      console.error('❌ Error creating checkout session:', error);
      throw error;
    }
  }

  /** Hides plan selection and returns to the signup form view. */
  onGoBackToSignup(): void {
    this.showPlanSelection = false;
  }

  /** Closes the Stripe error pop-up and shows plan selection again. */
  closeStripeError(): void {
    this.showStripeError = false;
    this.stripeErrorMessage = '';
    this.showPlanSelection = true; // Volver a mostrar la selección de planes
  }

  /** Extracts message/details from backend error, sets errorMessage, and shows toast. */
  private handleRegistrationError(error: any): void {
    console.error('Registration error:', error);
    
    // Extraer mensaje de error del formato del backend
    const errorMessage = this.extractErrorMessage(error);
    const errorDetails = this.extractErrorDetails(error);
    
    // Si hay múltiples errores de validación, mostrarlos todos
    if (errorDetails && errorDetails.length > 0) {
      this.errorMessage = errorDetails.join(', ');
    } else {
      this.errorMessage = errorMessage;
    }
    
    // Mostrar toast notification
    this.toastService.showBackendError(error, 'Registration error');
  }

  /** Extracts a single error message from backend/HTTP error shape (error.error.error.message, etc.). */
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
    }
    
    // Mensaje por defecto
    return 'An error occurred during registration. Please try again.';
  }

  /** Extracts validation details array from backend error (error.error.error.details). */
  private extractErrorDetails(error: any): string[] | null {
    if (error?.error?.error?.details && Array.isArray(error.error.error.details)) {
      return error.error.error.details;
    }
    return null;
  }
}
