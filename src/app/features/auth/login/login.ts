import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { PasswordInputComponent } from '../../../shared/components/password-input/password-input.component';
import { TextInputComponent } from '../../../shared/components';
import { AuthService } from '../service/authService';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { setUserData } from '../store/user.actions';
import { User } from '../../overview/models/overview';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PasswordInputComponent,
    TextInputComponent,
    RouterLink,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  loginForm: FormGroup;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private store: Store,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      loginEmail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      rememberMe: [false],
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      console.log('Login:', this.loginForm.value);

      const userCredentials = this.createUserCredentialsObject();
      this.authService
        .login(userCredentials)
        .then((response: any) => {
          this.authService
            .getUserData(response.user.uid)
            .then((userData: User) => {
              console.log('User data:', userData);
              this.store.dispatch(setUserData({ user: userData }));
              if (userData.isAdmin) {
                this.router.navigate(['/overview']);
              } else {
                this.router.navigate(['/report']);
              }
            });
        })
        .catch((error: any) => {
          alert('Login failed. Please try again.');
        });
    }
  }

  private createUserCredentialsObject(): UserCredentials {
    return {
      email: this.loginForm.value.loginEmail,
      password: this.loginForm.value.password,
    };
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  signInWithGoogle(): void {
    // TODO: Implement Google sign-in
    console.log('Google sign-in');
  }

  signInWithApple(): void {
    // TODO: Implement Apple sign-in
    console.log('Apple sign-in');
  }
}
