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
import { AlertService } from '../../../../shared/services/alert.service';

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

  constructor(private fb: FormBuilder, private authService: AuthService, private subscriptionService: SubscriptionService, private alertService: AlertService) {
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
      // Crear usuario en Firebase Auth
      const credentials: UserCredentials = { email, password } as { email: string; password: string };

      const existingUser = await this.authService.getUserByEmail(email);
      if (existingUser) {
        this.alertService.showError('This email is already registered. Please use a different email or try logging in.', 'Email Already Registered');
        return;
      }

      const userResponse = await this.authService.register(credentials);
      const userId = userResponse.user.uid;

      // Token
      const token: LinkToken = {
        id: email.split('@')[0] + userId.substring(0, 4),
        userId,
      } as any;

      // User doc
      const user: User = {
        id: userId,
        email,
        tokenId: token.id,
        firstName: this.form.value.firstName,
        lastName: this.form.value.lastName,
        phoneNumber: this.form.value.phoneNumber,
        birthday: this.form.value.birthday,
        best_trade: 0,
        netPnl: 0,
        number_trades: 0,
        profit: 0,
        status: this.role === 'admin' ? UserStatus.ADMIN : UserStatus.ACTIVE,
        strategy_followed: 0,
        subscription_date: new Date().getTime(),
        lastUpdated: new Date().getTime(),
        total_spend: 0,
        isAdmin: this.role === 'admin' ? true : false,
        trading_accounts: 0,
        strategies: 0,
      };

      await this.authService.createUser(user as User);
      await this.authService.createLinkToken(token);

      // Crear suscripción Free
      const freeSubscriptionData: Omit<Subscription, 'id' | 'created_at' | 'updated_at'> = {
        planId: 'Cb1B0tpxdE6AP6eMZDo0',
        status: UserStatus.ACTIVE,
        userId,
      };
      await this.subscriptionService.createSubscription(userId, freeSubscriptionData);

      this.showSuccess = true;
      this.created.emit();
    } catch (e) {
      console.error('Error creating user:', e);
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