import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password-popup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordPopupComponent {
  @Input() visible: boolean = false;
  @Output() close = new EventEmitter<void>();

  form: FormGroup;
  submitted = false;
  loading = false;
  successMessage = '';
  errorMessage = '';

  constructor(private fb: FormBuilder, private authService: AuthService) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onBack(): void {
    this.resetFeedback();
    this.close.emit();
  }

  async onSubmit(): Promise<void> {
    this.submitted = true;
    this.successMessage = '';
    this.errorMessage = '';
    if (this.form.invalid || this.loading) return;

    this.loading = true;
    const email = this.form.value.email as string;
    try {
      await this.authService.sendPasswordReset(email);
      this.successMessage = 'We have sent you an email with instructions.';
    } catch (error: any) {
      if (error?.code === 'auth/user-not-found') {
        this.errorMessage = 'No account found with this email.';
      } else if (error?.code === 'auth/invalid-email') {
        this.errorMessage = 'Invalid email format.';
      } else {
        this.errorMessage = 'Failed to send reset email. Please try again later.';
      }
    } finally {
      this.loading = false;
    }
  }

  private resetFeedback(): void {
    this.submitted = false;
    this.successMessage = '';
    this.errorMessage = '';
    this.loading = false;
  }
}


