import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-create-account-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-account-popup.component.html',
  styleUrls: ['./create-account-popup.component.scss']
})
export class CreateAccountPopupComponent {
  @Input() visible = false;
  @Input() userId: string = '';
  @Input() currentAccountCount: number = 0;
  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();


  // Form data
  newAccount = {
    accountID: '',
    accountName: '',
    brokerPassword: '',
    server: '',
    emailTradingAccount: '',
    balance: 0,
  };

  // Confirmation modals
  showCancelConfirm = false;
  showSuccessModal = false;

  onClose() {
    this.close.emit();
  }

  onCancel() {
    this.showCancelConfirm = true;
  }

  onConfirmCancel() {
    this.showCancelConfirm = false;
    this.cancel.emit();
  }

  onContinueEditing() {
    this.showCancelConfirm = false;
  }

  onCreate() {
    // Basic validation
    if (!this.newAccount.accountID || !this.newAccount.accountName || 
        !this.newAccount.brokerPassword || !this.newAccount.server || 
        !this.newAccount.emailTradingAccount) {
      alert('Please fill in all required fields.');
      return;
    }
    
    // Prepare account data with calculated fields
    const accountData = {
      ...this.newAccount,
      userId: this.userId,
      accountNumber: this.currentAccountCount + 1,
      createdAt: new Date()
    };
    
    this.showSuccessModal = true;
    this.create.emit(accountData);
  }

  onGoToList() {
    this.showSuccessModal = false;
    this.close.emit();
  }

  resetForm() {
    this.newAccount = {
      accountID: '',
      accountName: '',
      brokerPassword: '',
      server: '',
      emailTradingAccount: '',
      balance: 0,
    };
  }
}
