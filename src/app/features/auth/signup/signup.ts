import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { PhoneInputComponent } from "../../../shared/components/phone-input/phone-input.component";
import { BirthdayInputComponent } from "../../../shared/components/birthday-input/birthday-input.component";
import { TextInputComponent } from "../../../shared/components/text-input/text-input.component";
import { AuthService } from '../service/authService';
import { PasswordInputComponent } from "../../../shared/components/password-input/password-input.component";

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
    RouterLink
],
  templateUrl: './signup.html',
  styleUrl: './signup.scss'
})
export class SignupComponent {
  signupForm: FormGroup;

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.signupForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      phoneNumber: ['', [Validators.required]],
      birthday: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
    
  }


  onChange(): void {
    console.log('Form changed:', this.signupForm.value);
  }
  onSubmit(): void {

    if (this.signupForm.valid) {
      this.authService.register(this.createUserCredentialsObject()).then((response: any) => {
        // Assuming you want to use the refresh token as the tokenId
        const userId = response.user.uid;

        const token = this.createTokenObject(userId);
        const user = this.createUserObject(userId, token.id);


        this.authService.createUser(user);
        this.authService.createLinkToken(token);
        alert('Registration successful!');
        this.router.navigate(['/login']);
        
      }).catch((error: any) => {
        console.error('Registration failed:', error);
        alert('Registration failed. Please try again.');
      });
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

  private createUserCredentialsObject(): UserCredentials {
    return {
      email: this.signupForm.value.email,
      password: this.signupForm.value.password
    };
  }

  private createUserObject(id: String, tokenId: String): User {
    return {
      id: id,
      email: this.signupForm.value.email,
      tokenId: tokenId,
      firstName: this.signupForm.value.firstName,
      lastName: this.signupForm.value.lastName,
      phoneNumber: this.signupForm.value.phoneNumber,
      birthday: this.signupForm.value.birthday
    };
  }

  private createTokenObject(userId: string): LinkToken {
    return {
      id: this.signupForm.value.email.split('@')[0] + userId.substring(0, 4), // Example token ID
      userId: userId,
      // 1 hour expiration
    };
  }

}
