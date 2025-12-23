import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  PhoneInputComponent,
  TextInputComponent,
} from '../../shared/components';
import { Router, RouterLink } from '@angular/router';
import { PasswordInputComponent } from '../../shared/components/password-input/password-input.component';
import { AuthService } from '../auth/service/authService';
import { Store } from '@ngrx/store';
import { selectUser } from '../auth/store/user.selectios';
import { AccountData } from '../auth/models/userModel';
import { Timestamp } from 'firebase/firestore';
import { first } from 'rxjs';

/**
 * Component for adding a new trading account.
 * 
 * This component provides a form interface for users to register
 * a new trading account with their broker. It collects account
 * information including email, password, broker details, and account
 * identification data.
 * 
 * Related to:
 * - AuthService: Creates the account in Firebase
 * - Store (NgRx): Gets current user data
 * - Router: Navigates to trading accounts page after creation
 * 
 * @component
 * @selector app-add-account
 * @standalone true
 */
@Component({
  selector: 'app-add-account',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TextInputComponent,
    PasswordInputComponent,
    RouterLink,
  ],
  templateUrl: './add-account.component.html',
  styleUrls: ['./add-account.component.scss'],
})
export class AddAccountComponent {
  /** Form group containing all trading account input fields */
  accountForm: FormGroup;
  
  /**
   * Constructor for AddAccountComponent.
   * 
   * Initializes the reactive form with all required fields and validators:
   * - emailTradingAccount: Required email validation
   * - brokerPassword: Required, minimum 6 characters
   * - broker: Required broker name
   * - server: Required server name
   * - accountName: Required account name
   * - accountID: Required account ID
   * - accountNumber: Required, numeric pattern only
   * 
   * @param fb - FormBuilder for creating reactive forms
   * @param authService - Service for authentication and account operations
   * @param router - Router for navigation
   * @param store - NgRx Store for accessing user state
   */
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private store: Store
  ) {
    this.accountForm = this.fb.group({
      emailTradingAccount: ['', [Validators.required, Validators.email]],
      brokerPassword: ['', [Validators.required, Validators.minLength(6)]],
      broker: ['', [Validators.required]],
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
   * Handles form submission when user clicks the submit button.
   * 
   * Validates the form and either:
   * - Processes registration if form is valid
   * - Marks all form fields as touched to show validation errors if invalid
   * 
   * @memberof AddAccountComponent
   */
  onSubmit(): void {
    if (this.accountForm.valid) {
      this.processRegistration();
    } else {
      this.markFormGroupTouched();
    }
  }

  /**
   * Processes the account registration.
   * 
   * Gets the current user from the store, creates an account object
   * with the form data, and saves it to Firebase. After successful
   * creation, navigates to the trading accounts page.
   * 
   * Related to:
   * - Store.select(selectUser): Gets current user from NgRx store
   * - AuthService.createAccount(): Creates account in Firebase
   * - createAccountObject(): Builds account data object
   * - Router.navigate(): Redirects to trading accounts page
   * 
   * @private
   * @memberof AddAccountComponent
   */
  private processRegistration(): void {
    this.store
      .select(selectUser)
      .pipe(first())
      .subscribe((user) => {
        const userId = user?.user?.id || '';
        this.authService.createAccount(this.createAccountObject(userId));
        this.router.navigate(['/trading-accounts']);
      });
  }

  /**
   * Marks all form controls as touched to trigger validation error display.
   * 
   * This method iterates through all form controls and marks them as touched,
   * which causes Angular to display validation error messages for invalid fields.
   * 
   * @private
   * @memberof AddAccountComponent
   */
  private markFormGroupTouched(): void {
    Object.keys(this.accountForm.controls).forEach((key) => {
      const control = this.accountForm.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Creates an AccountData object from form values.
   * 
   * Generates a unique ID for the account using timestamp and random string,
   * then constructs an AccountData object with all form values and metadata.
   * 
   * The unique ID is generated using:
   * - Current timestamp in base36 format
   * - Random string (6 characters)
   * - Format: `id_{timestamp}_{random}`
   * 
   * @private
   * @param id - User ID to associate with the account
   * @returns AccountData object ready to be saved to Firebase
   * @memberof AddAccountComponent
   */
  private createAccountObject(id: string): AccountData {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    const uniqueId = `id_${timestamp}_${randomPart}`;
    return {
      id: uniqueId,
      userId: id,
      emailTradingAccount: this.accountForm.value.emailTradingAccount,
      brokerPassword: this.accountForm.value.brokerPassword,
      broker: this.accountForm.value.broker,
      server: this.accountForm.value.server,
      accountName: this.accountForm.value.accountName,
      accountID: this.accountForm.value.accountID,
      accountNumber: Number(this.accountForm.value.accountNumber),
      createdAt: Timestamp.now(),
    };
  }
}
