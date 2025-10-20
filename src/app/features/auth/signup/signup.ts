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
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private planService: PlanService,
    private subscriptionService: SubscriptionService,
    private store: Store,
    private appContext: AppContextService
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
    console.log('Form changed:', this.signupForm.value);
  }
  async onSubmit(): Promise<void> {
    if (this.signupForm.valid) {
      try {
        // Establecer estado de carga
        this.appContext.setLoading('user', true);
        this.appContext.setError('user', null);

        // Crear credenciales del usuario
        const userCredentials = this.createUserCredentialsObject();
        
        // Verificar que el email no esté ya registrado
        const existingUser = await this.authService.getUserByEmail(userCredentials.email);
        
        if (existingUser) {
          alert('This email is already registered. Please use a different email or try logging in.');
          this.appContext.setLoading('user', false);
          return;
        }
        
        // Crear el usuario en Firebase Auth
        const userResponse = await this.authService.register(userCredentials);
        const userId = userResponse.user.uid;
        
        // Crear el token y objeto usuario
        const token = this.createTokenObject(userId);
        const user: User = await this.createUserObject(userId, token.id);
        
        // Configurar como admin si corresponde
        if (this.isAdminSignup) {
          user.isAdmin = true;
          user.status = UserStatus.ADMIN;
        } else {
          user.status = UserStatus.ACTIVE;
        }
        
        // Crear usuario y token en Firestore
        await this.authService.createUser(user as User);
        await this.authService.createLinkToken(token);

        // Crear suscripción gratuita activa por defecto
        const freeSubscriptionData: Omit<Subscription, 'id' | 'created_at' | 'updated_at'> = {
          planId: "Cb1B0tpxdE6AP6eMZDo0",
          status: UserStatus.ACTIVE,
          userId: userId,
        };

        await this.subscriptionService.createSubscription(userId, freeSubscriptionData);
        
        console.log('✅ User created successfully with free plan');

        // Iniciar sesión automáticamente
        const loginResponse = await this.authService.login(userCredentials);
        const userData = await this.authService.getUserData(loginResponse.user.uid);
        
        // Actualizar contexto con datos completos del usuario
        this.appContext.setCurrentUser(userData);
        
        // Mantener compatibilidad con NgRx
        this.store.dispatch(setUserData({ user: userData }));
        
        // Guardar userId para usar en la selección de plan
        this.currentUserId = userId;
        
        // Limpiar estado de carga
        this.appContext.setLoading('user', false);
        
        // Guardar datos del usuario para mostrar en la selección de planes
        this.userData = this.signupForm.value;
        
        // Si es admin, ir directo al dashboard
        if (userData.isAdmin) {
          alert('Registration completed successfully! Welcome Admin.');
          this.router.navigate(['/overview']);
        } else {
          // Usuario normal: mostrar selección de planes
          this.showPlanSelection = true;
        }
        
      } catch (error: any) {
        console.error('❌ Error in registration:', error);
        this.appContext.setLoading('user', false);
        this.appContext.setError('user', 'Error during registration');
        
        const errorMessage = error.message || 'An error occurred during registration. Please try again.';
        alert(errorMessage);
        
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
    console.log('Sign in with Google');
  }

  signInWithApple(): void {
    console.log('Sign in with Apple');
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
      alert('Validation errors:\n\n' + errors.join('\n'));
    }

    this.markFormGroupTouched();
  }

  async onPlanSelected(plan: PlanCard): Promise<void> {
    try {
      this.selectedPlan = plan;
      
      // Si selecciona el plan Free, redirigir al dashboard
      if (plan.name.toLowerCase() === 'free') {
        console.log('✅ Free plan selected, redirecting to dashboard');
        this.router.navigate(['/strategy']);
        return;
      }
      
      // Si selecciona otro plan, crear checkout session
      console.log(`💳 ${plan.name} plan selected, creating checkout session`);
      await this.createCheckoutSession(plan.name);
      
    } catch (error: any) {
      console.error('❌ Error in plan selection:', error);
      alert('Error processing your plan selection. Please try again.');
      this.showPlanSelection = true;
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

      // Obtener el token de Firebase
      const bearerTokenFirebase = await this.authService.getBearerTokenFirebase(this.currentUserId);

      // Crear checkout session
      const response = await fetch('https://trade-manager-backend-836816769157.us-central1.run.app/payments/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerTokenFirebase}`
        },
        body: JSON.stringify({
          priceId: selectedPlan.planPriceId,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error creating checkout session: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseData = await response.json();
      const checkoutUrl = responseData.body?.url || responseData.url;
      
      if (!checkoutUrl) {
        throw new Error('Checkout URL not found in response');
      }

      console.log('✅ Checkout session created, redirecting to Stripe');
      
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

  private handleRegistrationError(error: any): void {
    console.log('Registration error:', error);
    // Los errores comunes serán manejados por Firebase
  }
}
