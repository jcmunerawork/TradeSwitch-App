import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { PhoneInputComponent } from '../../../shared/components/phone-input/phone-input.component';
import { BirthdayInputComponent } from '../../../shared/components/birthday-input/birthday-input.component';
import { TextInputComponent } from '../../../shared/components/text-input/text-input.component';
import { AuthService } from '../service/authService';
import { PasswordInputComponent } from '../../../shared/components/password-input/password-input.component';
import { User, UserStatus } from '../../overview/models/overview';
import { Timestamp } from 'firebase/firestore';
import { AccountData, UserCredentials } from '../models/userModel';

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
  ],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class SignupComponent implements OnInit {
  signupForm: FormGroup;
  accountForm: FormGroup;
  currentStep = 1;
  isAdminSignup: boolean = false;
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.signupForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      phoneNumber: ['', [Validators.required]],
      birthday: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
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
      if (!this.isAdminSignup) {
        if (this.currentStep === 1) {
          this.currentStep = 2;
        } else if (this.currentStep === 2) {
          this.processRegistration();
        }
      } else {
        this.processRegistration();
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  private processRegistration(): void {
    this.authService
      .register(this.createUserCredentialsObject())
      .then((response: any) => {
        const userId = response.user.uid;

        const token = this.createTokenObject(userId);
        const user = this.createUserObject(userId, token.id);

        if (this.isAdminSignup) {
          user.isAdmin = true;
        }

        this.authService.createUser(user);
        this.authService.createLinkToken(token);
        if (!this.isAdminSignup) {
          this.authService.createAccount(this.createAccountObject(userId));
        }
        alert('Registration successful!');
        this.router.navigate(['/login']);
      })
      .catch((error: any) => {
        console.error('Registration failed:', error);
        alert('Registration failed. Please try again.');
      });
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

  private createUserObject(id: string, tokenId: string): User {
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

  private createAccountObject(id: string): AccountData {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    const uniqueId = `id_${timestamp}_${randomPart}`;
    return {
      id: uniqueId,
      userId: id,
      emailTradingAccount: this.accountForm.value.emailTradingAccount,
      brokerPassword: this.accountForm.value.brokerPassword,
      server: this.accountForm.value.server,
      accountName: this.accountForm.value.accountName,
      accountID: this.accountForm.value.accountID,
      accountNumber: Number(this.accountForm.value.accountNumber),
      createdAt: Timestamp.now(),
    };
  }

  private createTokenObject(userId: string): LinkToken {
    return {
      id: this.signupForm.value.email.split('@')[0] + userId.substring(0, 4),
      userId: userId,
    };
  }
}
