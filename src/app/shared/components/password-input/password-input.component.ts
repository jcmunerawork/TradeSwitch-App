import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, ReactiveFormsModule, NG_VALUE_ACCESSOR, Validator, AbstractControl, ValidationErrors, NG_VALIDATORS } from '@angular/forms';

/**
 * Password input component with validation and strength indicator.
 *
 * This component provides a password input field with comprehensive validation
 * and visual strength feedback. It integrates with Angular Forms and includes
 * built-in password strength validation.
 *
 * Features:
 * - Angular Forms integration (ControlValueAccessor and Validator)
 * - Password visibility toggle
 * - Password strength indicator (weak, medium, strong)
 * - Real-time validation feedback
 * - Validation rules:
 *   - Minimum 8 characters
 *   - Must contain uppercase letter
 *   - Must contain lowercase letter
 *   - Must contain number or symbol
 *   - Cannot contain user's name or email
 * - Color-coded strength indicator
 * - Customizable label and placeholder
 *
 * Password Strength:
 * - Weak: Less than 3 validations pass
 * - Medium: 3-4 validations pass
 * - Strong: All 5 validations pass
 *
 * Usage:
 * <app-password-input
 *   formControlName="password"
 *   label="Password"
 *   [showValidation]="true"
 *   [userEmail]="userEmail"
 *   [userName]="userName">
 * </app-password-input>
 *
 * Relations:
 * - Used in registration and password change forms
 * - Integrates with Angular Reactive Forms
 *
 * @component
 * @selector app-password-input
 * @standalone true
 */
@Component({
  selector: 'app-password-input',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './password-input.component.html',
  styleUrls: ['./password-input.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PasswordInputComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => PasswordInputComponent),
      multi: true
    }
  ]
})
export class PasswordInputComponent implements ControlValueAccessor, Validator {
  @Input() label: string = 'Password';
  @Input() placeholder: string = '********************';
  @Input() required: boolean = false;
  @Input() disabled: boolean = false;
  @Input() showValidation: boolean = false;
  @Input() userEmail: string = '';
  @Input() userName: string = '';

  value: string = '';
  touched: boolean = false;
  showPassword: boolean = false;

  // Validaciones de contraseña
  passwordValidations = {
    noNameOrEmail: false,
    minLength: false,
    hasNumberOrSymbol: false,
    hasUppercase: false,
    hasLowercase: false
  };

  get passwordStrength(): string {
    const validCount = Object.values(this.passwordValidations).filter(Boolean).length;
    if (validCount < 3) return 'weak';
    if (validCount < 5) return 'medium';
    return 'strong';
  }

  get strengthColor(): string {
    const strength = this.passwordStrength;
    switch (strength) {
      case 'weak': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'strong': return '#22C55E';
      default: return '#6B7280';
    }
  }

  onChange = (value: string) => {};
  onTouched = () => {};

  writeValue(value: string): void {
    this.value = value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value = value;
    this.validatePassword(value);
    this.onChange(value);
  }

  private validatePassword(password: string): void {
    // No puede contener el nombre o email
    this.passwordValidations.noNameOrEmail = !this.containsNameOrEmail(password);
    
    // Al menos 8 caracteres
    this.passwordValidations.minLength = password.length >= 8;
    
    // Al menos 1 número o símbolo
    this.passwordValidations.hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    // Al menos 1 letra mayúscula
    this.passwordValidations.hasUppercase = /[A-Z]/.test(password);
    
    // Al menos 1 letra minúscula
    this.passwordValidations.hasLowercase = /[a-z]/.test(password);
  }

  private containsNameOrEmail(password: string): boolean {
    const lowerPassword = password.toLowerCase();
    const lowerName = this.userName.toLowerCase();
    const lowerEmail = this.userEmail.toLowerCase();
    
    return lowerPassword.includes(lowerName) || lowerPassword.includes(lowerEmail);
  }

  onBlur(): void {
    if (!this.touched) {
      this.touched = true;
      this.onTouched();
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  // Implementación de Validator
  validate(control: AbstractControl): ValidationErrors | null {
    if (!control.value || !this.showValidation) {
      return null;
    }

    const password = control.value;
    const errors: ValidationErrors = {};

    // Validar que no contenga nombre o email
    if (this.containsNameOrEmail(password)) {
      errors['containsNameOrEmail'] = true;
    }

    // Validar longitud mínima
    if (password.length < 8) {
      errors['minLength'] = true;
    }

    // Validar que tenga número o símbolo
    if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors['hasNumberOrSymbol'] = true;
    }

    // Validar que tenga mayúscula
    if (!/[A-Z]/.test(password)) {
      errors['hasUppercase'] = true;
    }

    // Validar que tenga minúscula
    if (!/[a-z]/.test(password)) {
      errors['hasLowercase'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }
}
