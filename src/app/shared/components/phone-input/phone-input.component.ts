import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, ReactiveFormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

interface CountryCode {
  code: string;
  flag: string;
  dialCode: string;
}

@Component({
  selector: 'app-phone-input',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './phone-input.component.html',
  styleUrls: ['./phone-input.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneInputComponent),
      multi: true
    }
  ]
})
export class PhoneInputComponent implements ControlValueAccessor {
  @Input() label: string = 'Phone number';
  @Input() placeholder: string = '(000) 00-0000';
  @Input() required: boolean = false;
  @Input() disabled: boolean = false;

  selectedCountry: CountryCode = { code: 'US', flag: '🇺🇸', dialCode: '+1' };
  phoneNumber: string = '';
  showCountryDropdown: boolean = false;
  touched: boolean = false;

  countries: CountryCode[] = [
    { code: 'US', flag: '🇺🇸', dialCode: '+1' },
    { code: 'CA', flag: '🇨🇦', dialCode: '+1' },
    { code: 'MX', flag: '🇲🇽', dialCode: '+52' },
    { code: 'CO', flag: '🇨🇴', dialCode: '+57' },
    { code: 'ES', flag: '🇪🇸', dialCode: '+34' },
    { code: 'GB', flag: '🇬🇧', dialCode: '+44' },
    { code: 'DE', flag: '🇩🇪', dialCode: '+49' },
    { code: 'FR', flag: '🇫🇷', dialCode: '+33' }
  ];

  onChange = (value: string) => {};
  onTouched = () => {};

  writeValue(value: string): void {
    this.phoneNumber = value;
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

  onPhoneInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.phoneNumber = value;
    this.onChange(`${this.selectedCountry.dialCode} ${value}`);
  }

  onBlur(): void {
    if (!this.touched) {
      this.touched = true;
      this.onTouched();
    }
  }

  selectCountry(country: CountryCode): void {
    this.selectedCountry = country;
    this.showCountryDropdown = false;
    this.onChange(`${country.dialCode} ${this.phoneNumber}`);
  }

  toggleCountryDropdown(): void {
    if (!this.disabled) {
      this.showCountryDropdown = !this.showCountryDropdown;
    }
  }
}
