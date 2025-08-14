import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

@Component({
  selector: 'app-assets-allowed',
  templateUrl: './report-form.component.html',
  styleUrls: ['./report-form.component.scss'],
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  standalone: true,
})
export class ReportFormComponent {
  addAccountForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.addAccountForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      server: ['', Validators.required],
    });
  }

  onSubmit() {
    if (this.addAccountForm.valid) {
      console.log(this.addAccountForm.value);
    }
  }
}
