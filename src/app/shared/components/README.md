# Standalone Input Components

This directory contains reusable standalone input components for the TradeManager application.

## Components

### TextInputComponent
A reusable text input component with label and validation support.

**Usage:**
```html
<app-text-input
  label="First name"
  placeholder="Your first name here"
  formControlName="firstName"
  required="true"
></app-text-input>
```

**Inputs:**
- `label`: Display label for the input
- `placeholder`: Placeholder text
- `type`: Input type (default: 'text')
- `required`: Whether the field is required
- `disabled`: Whether the field is disabled

### PhoneInputComponent
A phone number input with country code selector.

**Usage:**
```html
<app-phone-input
  label="Phone number"
  placeholder="(000) 00-0000"
  formControlName="phoneNumber"
  required="true"
></app-phone-input>
```

**Features:**
- Country code dropdown with flags
- Phone number formatting
- Reactive form integration

### BirthdayInputComponent
A birthday input with separate month, day, and year dropdowns.

**Usage:**
```html
<app-birthday-input
  label="Birthday"
  formControlName="birthday"
  required="true"
></app-birthday-input>
```

**Features:**
- Month dropdown with full month names
- Day dropdown (1-31)
- Year dropdown (current year - 100 to current year - 13)
- Returns date in YYYY-MM-DD format

## Integration with Reactive Forms

All components implement `ControlValueAccessor` and can be used directly with Angular's reactive forms:

```typescript
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

export class MyComponent {
  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      phoneNumber: ['', [Validators.required]],
      birthday: ['', [Validators.required]]
    });
  }
}
```

## Styling

All components use a dark theme with:
- White text on dark backgrounds
- Subtle borders with hover/focus states
- Consistent spacing and typography
- Responsive design

## Standalone Components

All components are standalone and can be imported directly without NgModules:

```typescript
import { TextInputComponent } from './shared/components/text-input/text-input.component';
import { PhoneInputComponent } from './shared/components/phone-input/phone-input.component';
import { BirthdayInputComponent } from './shared/components/birthday-input/birthday-input.component';
```
