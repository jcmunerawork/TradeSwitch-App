/**
 * Add-account feature module.
 *
 * Single component that provides a form to register a new trading account:
 * email, broker password, broker name, server, account name, account ID, and account number.
 * On submit, creates the account (via AuthService) and navigates to the trading accounts page.
 */
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
 * Provides a form to register a new trading account: email, broker password,
 * broker, server, account name, account ID, and account number. On valid submit,
 * builds an AccountData object, creates the account via AuthService, and navigates
 * to the trading accounts page.
 *
 * Dependencies:
 * - AuthService: creates the account in Firebase
 * - Store (NgRx): provides current user for userId
 * - Router: redirects to /trading-accounts after creation
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
  /** Reactive form group for all trading account fields (email, password, broker, server, account name/ID/number). */
  accountForm: FormGroup;

  /**
   * Initializes the component and builds the account form with validators.
   *
   * Form fields: emailTradingAccount (required, email), brokerPassword (required, min 6),
   * broker (required), server (required), accountName (required), accountID (required),
   * accountNumber (required, digits only).
   *
   * @param fb - FormBuilder for creating the reactive form
   * @param authService - Auth service used to create the account
   * @param router - Router used to navigate after creation
   * @param store - NgRx store to read current user
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
   * Handles form submit from the template.
   *
   * If the form is valid, runs processRegistration(); otherwise marks all controls
   * as touched so validation messages are shown.
   */
  onSubmit(): void {
    if (this.accountForm.valid) {
      this.processRegistration();
    } else {
      this.markFormGroupTouched();
    }
  }

  /**
   * Performs account creation: reads current user from store, builds AccountData
   * from form values, calls AuthService.createAccount, then navigates to /trading-accounts.
   *
   * @private
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
   * Marks every control in accountForm as touched so that validation errors
   * are shown for invalid fields.
   *
   * @private
   */
  private markFormGroupTouched(): void {
    Object.keys(this.accountForm.controls).forEach((key) => {
      const control = this.accountForm.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Builds an AccountData object from the current form values and the given user id.
   *
   * Generates a unique account id as `id_{timestampBase36}_{random6}`. Includes
   * emailTradingAccount, brokerPassword, broker, server, accountName, accountID,
   * accountNumber (as number), and createdAt (Firestore Timestamp).
   *
   * @private
   * @param id - User id to set as userId on the account
   * @returns AccountData instance ready to pass to AuthService.createAccount
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
