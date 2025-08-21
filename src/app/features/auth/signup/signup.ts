import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { PhoneInputComponent } from "../../../shared/components/phone-input/phone-input.component";
import { BirthdayInputComponent } from "../../../shared/components/birthday-input/birthday-input.component";

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PhoneInputComponent,
    BirthdayInputComponent
],
  templateUrl: './signup.html',
  styleUrl: './signup.scss'
})
export class SignupComponent {
  signupForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.signupForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      phoneNumber: ['', [Validators.required]],
      birthday: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.signupForm.valid) {
      console.log('Form submitted:', this.signupForm.value);
      // Handle form submission here
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.signupForm.controls).forEach(key => {
      const control = this.signupForm.get(key);
      control?.markAsTouched();
    });
  }

  signInWithGoogle(): void {
    console.log('Sign in with Google');
    // Handle Google sign-in here
  }

  signInWithApple(): void {
    console.log('Sign in with Apple');
    // Handle Apple sign-in here
  }
}
