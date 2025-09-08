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
  accountForm: FormGroup;
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private store: Store
  ) {
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

  onSubmit(): void {
    if (this.accountForm.valid) {
      this.processRegistration();
    } else {
      this.markFormGroupTouched();
    }
  }

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

  private markFormGroupTouched(): void {
    Object.keys(this.accountForm.controls).forEach((key) => {
      const control = this.accountForm.get(key);
      control?.markAsTouched();
    });
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
}
