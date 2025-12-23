import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, ReactiveFormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

interface DateValue {
  month: string;
  day: string;
  year: string;
}

/**
 * Birthday input component with month, day, and year dropdowns.
 *
 * This component provides a date input for birthdays using three separate
 * dropdowns for month, day, and year. It generates valid date ranges and
 * handles date formatting for form submission.
 *
 * Features:
 * - Angular Forms integration (ControlValueAccessor)
 * - Three separate dropdowns (month, day, year)
 * - Year range: 100 years ago to 13 years ago (minimum age validation)
 * - Day range: 1-31 (adjusts based on month/year)
 * - Date formatting (YYYY-MM-DD)
 * - Customizable label
 * - Touch state tracking
 *
 * Date Range:
 * - Years: Current year - 100 to Current year - 13
 * - Days: 1-31 (validated based on month)
 * - Months: January through December
 *
 * Usage:
 * <app-birthday-input
 *   formControlName="birthday"
 *   label="Birthday"
 *   [required]="true">
 * </app-birthday-input>
 *
 * Relations:
 * - Used in registration and profile forms
 * - Integrates with Angular Reactive Forms
 *
 * @component
 * @selector app-birthday-input
 * @standalone true
 */
@Component({
  selector: 'app-birthday-input',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './birthday-input.component.html',
  styleUrls: ['./birthday-input.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BirthdayInputComponent),
      multi: true
    }
  ]
})
export class BirthdayInputComponent implements ControlValueAccessor {
  @Input() label: string = 'Birthday';
  @Input() required: boolean = false;
  @Input() disabled: boolean = false;

  dateValue: DateValue = { month: '', day: '', year: '' };
  touched: boolean = false;
  showMonthDropdown: boolean = false;
  showDayDropdown: boolean = false;
  showYearDropdown: boolean = false;
 
  months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  days: string[] = [];
  years: string[] = [];

  onChange = (value: string) => {};
  onTouched = () => {};

  constructor() {
    this.generateDays();
    this.generateYears();
  }

  private generateDays(): void {
    for (let i = 1; i <= 31; i++) {
      this.days.push(i.toString().padStart(2, '0'));
    }
  }

  private generateYears(): void {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 100; i <= currentYear - 13; i++) {
      this.years.push(i.toString());
    }
    this.years.reverse();
  }

  writeValue(value: string): void {
    if (value) {
      const date = new Date(value);
      this.dateValue = {
        month: (date.getMonth() + 1).toString().padStart(2, '0'),
        day: date.getDate().toString().padStart(2, '0'),
        year: date.getFullYear().toString()
      };
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

  onDateChange(): void {
    if (this.dateValue.month && this.dateValue.day && this.dateValue.year) {
      const dateString = `${this.dateValue.year}-${this.dateValue.month}-${this.dateValue.day}`;
      this.onChange(dateString);
    } else {
      this.onChange('');
    }
  }

  onBlur(): void {
    if (!this.touched) {
      this.touched = true;
      this.onTouched();
    }
  }

  onMonthFocus(): void {
    this.showMonthDropdown = true;
    this.showDayDropdown = false;
    this.showYearDropdown = false;
  }

  onDayFocus(): void {
    this.showMonthDropdown = false;
    this.showDayDropdown = true;
    this.showYearDropdown = false;
  }

  onYearFocus(): void {
    this.showMonthDropdown = false;
    this.showDayDropdown = false;
    this.showYearDropdown = true;
  }

  onMonthBlur(): void {
    this.showMonthDropdown = false;
    this.onBlur();
  }

  onDayBlur(): void {
    this.showDayDropdown = false;
    this.onBlur();
  }

  onYearBlur(): void {
    this.showYearDropdown = false;
    this.onBlur();
  }
}
