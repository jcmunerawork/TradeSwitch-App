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
import { Timestamp } from 'firebase/firestore';
import { AccountData, UserCredentials } from '../models/userModel';
import { Plan, PlanService } from '../../../shared/services/planService';
import { PlanSelectionComponent, PlanCard } from './components/plan-selection/plan-selection.component';
import { SubscriptionProcessingComponent } from '../../../shared/components/subscription-processing/subscription-processing.component';
import { OrderSummaryComponent } from '../../../shared/components/order-summary/order-summary.component';
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
    SubscriptionProcessingComponent,
    OrderSummaryComponent,
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
  showPaymentProcessing = false;
  showOrderSummary = false;
  userData: any = null;
  selectedPlan: PlanCard | null = null;
  selectedPlanId: string = '';
  currentPaymentId: string = '';
  currentUserId: string = '';
  
  // Configuraciones para componentes compartidos
  subscriptionProcessingConfig = {
    paymentId: '',
    userId: '',
    context: 'signup' as const
  };
  
  orderSummaryConfig = {
    context: 'signup' as const,
    planName: '',
    price: 0,
    userData: null
  };
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
  onSubmit(): void {
    if (this.signupForm.valid) {
      // Guardar datos del usuario y mostrar selección de planes
      this.userData = this.signupForm.value;
      this.showPlanSelection = true;
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
      this.showPlanSelection = false;
      this.showPaymentProcessing = true;
      
      // Establecer estado de carga
      this.appContext.setLoading('user', true);
      this.appContext.setError('user', null);
      
      // Crear el usuario primero
      const userCredentials = this.createUserCredentialsObject();
      const userResponse = await this.authService.register(userCredentials);
      const userId = userResponse.user.uid;
      
      // Crear el token y objeto usuario
      const token = this.createTokenObject(userId);
      const user: User = await this.createUserObject(userId, token.id);
      
      if (this.isAdminSignup) {
        user.isAdmin = true;
        user.status = UserStatus.ADMIN;
      }
      
      // Crear usuario y token en Firebase
      await this.authService.createUser(user as User);
      await this.authService.createLinkToken(token);

      // Guardar IDs para el componente de procesamiento (sin crear pago aún)
      this.currentUserId = userId;

      // Actualizar contexto con datos del usuario
      this.appContext.setCurrentUser(user);

      this.authService
        .login(userCredentials)
        .then((response: any) => {
          this.authService
            .getUserData(response.user.uid)
            .then((userData: User) => {
              // Actualizar contexto con datos completos del usuario
              this.appContext.setCurrentUser(userData);
              
              // Mantener compatibilidad con NgRx
              this.store.dispatch(setUserData({ user: userData }));
              
              // Limpiar estado de carga
              this.appContext.setLoading('user', false);
            })
            .catch((error: any) => {
              this.appContext.setLoading('user', false);
              this.appContext.setError('user', 'Error al obtener datos del usuario');
              console.error('Error in the login:', error);
            });
        })
        .catch((error: any) => {
          this.appContext.setLoading('user', false);
          this.appContext.setError('user', 'Error de autenticación');
          console.error('Error in the login:', error);
        });

      const bearerTokenFirebase = await this.authService.getBearerTokenFirebase(userId);
      
      // Obtener el plan de Firebase para validar que existe
      const planFound = await this.planService.searchPlansByName(plan.name);
      if (!planFound || planFound.length === 0) {
        throw new Error(`Plan '${plan.name}' no encontrado en Firebase`);
      }
      
      // Guardar el plan encontrado para usar después
      this.selectedPlanId = planFound[0].id;
      const priceId = planFound[0].planPriceId || '';
      
      // Configurar componentes compartidos (sin paymentId aún)
      this.subscriptionProcessingConfig = {
        paymentId: '', // Se creará después del procesamiento exitoso
        userId: userId,
        context: 'signup'
      };
      
      this.orderSummaryConfig = {
        context: 'signup',
        planName: plan.name,
        price: plan.price,
        userData: this.userData
      };

      // PRIMERO: Verificar que el backend esté disponible
      try {
        const customerResponse = await fetch('https://trade-manager-backend-836816769157.us-central1.run.app/payments/create-customer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: userId
          })
        });

        if (!customerResponse.ok) {
          throw new Error(`Error creating customer: ${customerResponse.status} ${customerResponse.statusText}`);
        }
      } catch (customerError: any) {
        console.error('Error creating customer:', customerError);
        // Si falla la creación del customer, eliminar la cuenta creada
        await this.cleanupFailedAccount(userId);
        throw new Error('Error connecting to payment service. Please try again.');
      }

      // SEGUNDO: Intentar crear la sesión de pago
      try {
        await this.simulatePaymentProcessing(priceId, bearerTokenFirebase);
      } catch (paymentError: any) {
        console.error('Error in payment processing:', paymentError);
        // Si falla el payment, eliminar la cuenta creada
        await this.cleanupFailedAccount(userId);
        throw new Error('Payment processing failed. Please try again.');
      }
      
    } catch (error: any) {
      console.error('Error en el proceso de registro:', error);
      this.onPaymentError('Error processing the subscription. Please try again.');
    }
  }

  onGoBackToSignup(): void {
    this.showPlanSelection = false;
    // Los datos del usuario ya están en el formulario, no necesitamos hacer nada más
  }

  // TODO: IMPLEMENTAR ENDPOINT DE PAGO - Reemplazar simulación con API real
  private async simulatePaymentProcessing(priceId: string, bearerTokenFirebase: string): Promise<void> {
    if (!priceId || !bearerTokenFirebase) {
      throw new Error('Price ID or bearer token not found');
    }

    try {
      const response = await fetch('https://trade-manager-backend-836816769157.us-central1.run.app/payments/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerTokenFirebase}`
        },
        body: JSON.stringify({
          priceId: priceId,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error creating checkout session: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseData = await response.json();
      const paymentUrl = responseData.body?.url || responseData.url;
      
      if (!paymentUrl) {
        throw new Error('Payment URL not found in response');
      }

      // Navegar a la URL de pago en la misma pestaña
      window.location.href = paymentUrl;
      
    } catch (fetchError: any) {
      console.error('Fetch error details:', fetchError);
      throw new Error('Error connecting to payment service. Please try again.');
    }
  }

  private onPaymentError(errorMessage?: string): void {
    this.showPaymentProcessing = false;
    this.showPlanSelection = true;
    const message = errorMessage || 'Error processing the subscription. Please try again.';
    alert(message);
  }

  async onPaymentProcessingSuccess(): Promise<void> {
    try {
      // Actualizar el usuario con el plan seleccionado
      //await this.updateUserWithPlan();
      
      // Crear el pago en la subcolección de payments
      await this.createUserSubscription();
    } catch (error) {
      console.error('Error updating user and creating subscription:', error);
      this.onPaymentProcessingError();
    }
  }

  onPaymentProcessingError(): void {
    this.showPaymentProcessing = false;
    this.showPlanSelection = true;
    alert('Error processing the subscription. Please try again.');
  }

  // Método para limpiar la cuenta si el payment falla
  private async cleanupFailedAccount(userId: string): Promise<void> {
    try {
      
      // 1. Eliminar usuario de Firebase Auth (esto elimina la autenticación)
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        await currentUser.delete();
        console.log('Firebase Auth user deleted');
      }
      
      // 2. Eliminar datos del usuario de Firebase Firestore
      await this.authService.deleteUser(userId);
      
      // 3. Eliminar token si existe
      try {
        const token = this.createTokenObject(userId);
        await this.authService.deleteLinkToken(token.id);
      } catch (tokenError) {
        console.log('Token may not exist or already deleted:', tokenError);
      }
      
      // 4. Limpiar contexto y store
      this.appContext.setCurrentUser(null);
      this.store.dispatch({ type: '[User] Clear User' });
      
      // 5. Limpiar variables locales
      this.currentUserId = '';
      this.selectedPlanId = '';
      this.currentPaymentId = '';
    } catch (cleanupError) {
      console.error('Error during account cleanup:', cleanupError);
      // No lanzar error aquí para no interrumpir el flujo principal
    }
  }

  onPaymentProcessingGoBack(): void {
    this.showPaymentProcessing = false;
    this.showPlanSelection = true;
  }

  onOrderSummaryContinue(): void {
    this.showOrderSummary = false;
    alert('Registration completed successfully!');
    this.router.navigate(['/login']);
  }

  private async updateUserWithPlan(): Promise<void> {
    if (!this.selectedPlan || !this.currentUserId) {
      throw new Error('Plan selected or user ID not available');
    }

    try {
      // Obtener el usuario actual
      const user = await this.authService.getUserById(this.currentUserId);
      if (!user) {
        throw new Error('User not found in Firebase');
      }

      // Actualizar el usuario con información del plan
      const updatedUser = {
        ...user,
        subscription_date: new Date().getTime(),
        lastUpdated: new Date().getTime(),
        status: UserStatus.ACTIVE
      };

      // Actualizar el usuario en Firebase
      await this.authService.updateUser(this.currentUserId, updatedUser);
      
    } catch (error) {
      console.error('❌ Error updating user:', error);
      throw new Error(`Error actualizando usuario: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  private async createUserSubscription(): Promise<void> {
    if (!this.selectedPlan || !this.currentUserId || !this.selectedPlanId) {
      throw new Error('Plan seleccionado, ID de usuario o ID de plan no disponible');
    }

    try {

      // Crear el objeto de pago con la interfaz Payment usando el ID real del plan
      const paymentData: Omit<Subscription, 'id' | 'created_at' | 'updated_at'> = {
        planId: "Cb1B0tpxdE6AP6eMZDo0",
        status: UserStatus.CREATED,
        userId: this.currentUserId,
      };

      // Crear el pago en la subcolección de payments
      const subscriptionId = await this.subscriptionService.createSubscription(this.currentUserId, paymentData);
      this.currentPaymentId = subscriptionId;
      
      // Actualizar la configuración con el paymentId real
      this.subscriptionProcessingConfig.paymentId = subscriptionId;
      
    } catch (error) {
      console.error('❌ Error creando pago:', error);
      throw new Error(`Error creando pago: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
}
