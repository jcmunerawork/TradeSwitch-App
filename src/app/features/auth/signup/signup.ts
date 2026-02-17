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
  signupForm: FormGroup;
  accountForm: FormGroup;
  currentStep = 1;
  isAdminSignup: boolean = false;
  showPlanSelection = false;
  userData: any = null;
  selectedPlan: PlanCard | null = null;
  currentUserId: string = '';
  
  // Estados para loader y error de Stripe
  showStripeLoader = false;
  showStripeError = false;
  stripeErrorMessage = '';
  
  // Estados para carga y error del formulario
  isLoading = false;
  errorMessage = '';
  
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

  ngOnInit(): void {
    const currentUrl = this.router.url;
    if (currentUrl === '/admin-signup') {
      this.isAdminSignup = true;
    }
  }

  onChange(): void {
  }
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

  private markFormGroupTouched(): void {
    Object.keys(this.signupForm.controls).forEach((key) => {
      const control = this.signupForm.get(key);
      control?.markAsTouched();
    });
  }

  signInWithGoogle(): void {
  }

  signInWithApple(): void {
  }

  private createUserCredentialsObject(): UserCredentials {
    return {
      email: this.signupForm.value.email,
      password: this.signupForm.value.password,
    };
  }

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

  private createTokenObject(userId: string): LinkToken {
    return {
      id: this.signupForm.value.email.split('@')[0] + userId.substring(0, 4),
      userId: userId,
    };
  }

  // Validadores personalizados
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

  private showValidationErrors(): void {
    const errors: string[] = [];
    
    // Verificar errores específicos de cada campo
    const firstNameControl = this.signupForm.get('firstName');
    const lastNameControl = this.signupForm.get('lastName');
    const emailControl = this.signupForm.get('email');
    const phoneControl = this.signupForm.get('phoneNumber');
    const birthdayControl = this.signupForm.get('birthday');
    const passwordControl = this.signupForm.get('password');

    if (firstNameControl?.errors?.['required']) {
      errors.push('First name is required');
    } else if (firstNameControl?.errors?.['minlength']) {
      errors.push('First name must be at least 2 characters');
    }

    if (lastNameControl?.errors?.['required']) {
      errors.push('Last name is required');
    } else if (lastNameControl?.errors?.['minlength']) {
      errors.push('Last name must be at least 2 characters');
    }

    if (emailControl?.errors?.['required']) {
      errors.push('Email is required');
    } else if (emailControl?.errors?.['email']) {
      errors.push('Invalid email format');
    } else if (emailControl?.errors?.['invalidEmailFormat']) {
      errors.push('Invalid email format. Must contain @ and a valid domain');
    }

    if (phoneControl?.errors?.['required']) {
      errors.push('Phone number is required');
    } else if (phoneControl?.errors?.['invalidPhone']) {
      errors.push('Invalid phone number format');
    } else if (phoneControl?.errors?.['invalidPhoneLength']) {
      errors.push('Phone number must be between 10 and 15 digits');
    }

    if (birthdayControl?.errors?.['required']) {
      errors.push('Birthday is required');
    } else if (birthdayControl?.errors?.['underage']) {
      errors.push('You must be 18 years or older to register');
    }

    if (passwordControl?.errors?.['required']) {
      errors.push('Password is required');
    } else if (passwordControl?.errors?.['minlength']) {
      errors.push('Password must be at least 6 characters');
    }

    // Mostrar alerta con todos los errores
    if (errors.length > 0) {
      this.toastService.showError('Validation errors:\n\n' + errors.join('\n'));
    }

    this.markFormGroupTouched();
  }

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

  onGoBackToSignup(): void {
    this.showPlanSelection = false;
  }

  // Método para cerrar el pop-up de error de Stripe
  closeStripeError(): void {
    this.showStripeError = false;
    this.stripeErrorMessage = '';
    this.showPlanSelection = true; // Volver a mostrar la selección de planes
  }

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

  // Función helper para extraer el mensaje de error del formato del backend
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

  // Extraer detalles de validación (array de errores)
  private extractErrorDetails(error: any): string[] | null {
    if (error?.error?.error?.details && Array.isArray(error.error.error.details)) {
      return error.error.error.details;
    }
    return null;
  }
}
