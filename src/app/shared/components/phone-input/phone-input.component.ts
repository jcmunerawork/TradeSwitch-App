import { Component, Input, forwardRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, ReactiveFormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CountryService, CountryOption } from '../../../services/countryService';

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
export class PhoneInputComponent implements ControlValueAccessor, OnInit {
  @Input() label: string = 'Phone number';
  @Input() placeholder: string = '(000) 00-0000';
  @Input() required: boolean = false;
  @Input() disabled: boolean = false;

  selectedCountry: CountryCode = { code: 'US', flag: 'https://flagcdn.com/us.svg', dialCode: '+1' };
  phoneNumber: string = '';
  showCountryDropdown: boolean = false;
  touched: boolean = false;
  searchTerm: string = '';
  filteredCountries: CountryCode[] = [];
  countries: CountryCode[] = [];
  loading: boolean = true;

  constructor(private countryService: CountryService) {}

  ngOnInit(): void {
    this.loadCountries();
  }

  private loadCountries(): void {
    this.countryService.getCountries().subscribe({
      next: (countries) => {
        this.countries = countries;
        this.filteredCountries = countries;
        this.loading = false;
        
        // Buscar Colombia por defecto, si no existe usar US
        const colombia = countries.find(c => c.code === 'CO');
        if (colombia) {
          this.selectedCountry = colombia;
        }
      },
      error: (error) => {
        console.error('Error loading countries:', error);
        this.loading = false;
        // Mantener el país por defecto en caso de error
      }
    });
  }

  onChange = (value: string) => {};
  onTouched = () => {};

  writeValue(value: string): void {
    if (value) {
      // Si el valor ya incluye un código de país, extraer solo el número
      const phoneMatch = value.match(/^(\+\d{1,4})\s(.+)$/);
      if (phoneMatch) {
        const [, dialCode, phoneNumber] = phoneMatch;
        // Buscar el país correspondiente al código de marcación
        const country = this.countries.find(c => c.dialCode === dialCode);
        if (country) {
          this.selectedCountry = country;
        }
        this.phoneNumber = phoneNumber;
      } else {
        this.phoneNumber = value;
      }
    } else {
      this.phoneNumber = '';
    }
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
    this.onChange(this.formatPhoneNumber(value));
  }

  private formatPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber) return '';
    return `${this.selectedCountry.dialCode} ${phoneNumber}`;
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
    this.onChange(this.formatPhoneNumber(this.phoneNumber));
  }

  toggleCountryDropdown(): void {
    if (!this.disabled && !this.loading) {
      this.showCountryDropdown = !this.showCountryDropdown;
      if (this.showCountryDropdown) {
        this.filteredCountries = this.countries;
        this.searchTerm = '';
      }
    }
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm = value;
    this.filterCountries();
  }

  private filterCountries(): void {
    if (!this.searchTerm) {
      this.filteredCountries = this.countries;
    } else {
      const searchLower = this.searchTerm.toLowerCase();
      this.filteredCountries = this.countries.filter(country => 
        country.code.toLowerCase().includes(searchLower) ||
        country.dialCode.includes(searchLower)
      );
    }
  }
}
