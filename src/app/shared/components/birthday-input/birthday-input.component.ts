import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, ReactiveFormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

interface DateValue {
  month: string;
  day: string;
  year: string;
}

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
}
