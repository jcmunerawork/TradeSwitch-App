import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PasswordInputComponent } from "../../../shared/components/password-input/password-input.component";
import { TextInputComponent  } from '../../../shared/components';
import { AuthService } from '../service/authService';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { setUserData } from '../store/user.actions';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, PasswordInputComponent, TextInputComponent, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  loginForm: FormGroup;
  showPassword = false;

  constructor(private fb: FormBuilder, private authService: AuthService,private store: Store ) {
    this.loginForm = this.fb.group({
      loginEmail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      rememberMe: [false]
    });

    this.loginForm.valueChanges.subscribe(value => {
      console.log('Form values changed:', value);
      console.log('Form status changed:', this.loginForm.status);
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      // TODO: Implement login logic
      console.log('Login:', this.loginForm.value);

      const userCredentials = this.createUserCredentialsObject();
      this.authService.login(userCredentials).then((response: any) => {
        console.log('Login successful:', response);

        this.authService.getUserData(response.user.uid).then((userData: User) => {
          console.log('User data:', userData);
          this.store.dispatch(setUserData({ user: userData }));
        });

      }).catch((error: any) => {
        console.error('Login failed:', error);
        alert('Login failed. Please try again.');
      });
    }
  }

  private createUserCredentialsObject():  UserCredentials {
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
