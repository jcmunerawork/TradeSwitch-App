import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, ReactiveFormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Reusable text input component with Angular Forms integration.
 *
 * This component provides a customizable text input that integrates with
 * Angular Reactive Forms and Template-driven Forms through ControlValueAccessor.
 * It supports labels, placeholders, validation states, and disabled states.
 *
 * Features:
 * - Angular Forms integration (ControlValueAccessor)
 * - Customizable label and placeholder
 * - Support for different input types (text, email, password, etc.)
 * - Required field indicator
 * - Disabled state support
 * - Touch state tracking
 * - Validation error display
 *
 * Usage:
 * <app-text-input
 *   formControlName="email"
 *   label="Email"
 *   placeholder="Enter your email"
 *   type="email"
 *   [required]="true">
 * </app-text-input>
 *
 * Relations:
 * - Used in forms throughout the application
 * - Integrates with Angular Reactive Forms and Template-driven Forms
 *
 * @component
 * @selector app-text-input
 * @standalone true
 */
@Component({
  selector: 'app-text-input',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './text-input.component.html',
  styleUrls: ['./text-input.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextInputComponent),
      multi: true
    }
  ]
})
export class TextInputComponent implements ControlValueAccessor {
  @Input() label: string = '';
  @Input() placeholder: string = '';
  @Input() type: string = 'text';
  @Input() required: boolean = false;
  @Input() disabled: boolean = false;

  value: string = '';
  touched: boolean = false;

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
    this.onChange(value);
  }

  onBlur(): void {
    if (!this.touched) {
      this.touched = true;
      this.onTouched();
    }
  }
}
