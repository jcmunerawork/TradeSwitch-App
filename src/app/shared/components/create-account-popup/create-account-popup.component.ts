import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradeLockerApiService } from '../../services/tradelocker-api.service';
import { AuthService } from '../../../features/auth/service/authService';
import { AccountData } from '../../../features/auth/models/userModel';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-create-account-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-account-popup.component.html',
  styleUrls: ['./create-account-popup.component.scss']
})
export class CreateAccountPopupComponent implements OnChanges {
  @Input() visible = false;
  @Input() userId: string = '';
  @Input() currentAccountCount: number = 0;
  @Input() editMode = false;
  @Input() accountToEdit: AccountData | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<any>();
  @Output() update = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  constructor(
    private authService: AuthService,
    private tradeLockerApiService: TradeLockerApiService
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    // When the popup becomes visible, reset or populate the form
    if (changes['visible'] && changes['visible'].currentValue === true) {
      if (this.editMode && this.accountToEdit) {
        this.populateFormForEdit();
      } else {
        this.resetForm();
      }
    }
  }


  // Form data
  newAccount = {
    emailTradingAccount: '',
    brokerPassword: '',
    accountName: '',
    broker: '',
    server: '',
    accountID: '',
    initialBalance: 0,
    accountNumber: 0,
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

  

  async onCreate() {
    // Basic validation
    if (!this.newAccount.accountName || !this.newAccount.broker || 
        !this.newAccount.emailTradingAccount || !this.newAccount.brokerPassword || 
        !this.newAccount.server || !this.newAccount.accountID || !this.newAccount.accountNumber) {
      alert('Please fill in all required fields.');
      return;
    }
    
    try {
      // 1. Validate account exists in TradeLocker
      const accountExists = await this.validateAccountInTradeLocker();
      if (!accountExists) {
        alert('Account does not exist in TradeLocker. Please verify the credentials.');
        return;
      }
      
      // 2. Validate account email and ID uniqueness
      const validationResult = await this.validateAccountUniqueness();
      if (!validationResult.isValid) {
        alert(validationResult.message);
        return;
      }
      
      if (this.editMode && this.accountToEdit) {
        // Update existing account
        await this.updateAccount();
      } else {
        // Create new account
        await this.createNewAccount();
      }
      
    } catch (error) {
      console.error('Error processing trading account:', error);
      alert(`Failed to ${this.editMode ? 'update' : 'create'} trading account. Please try again.`);
    }
  }

  private async createNewAccount() {
    // Create account object for Firebase
    const accountData = this.createAccountObject();
    
    // Save to Firebase
    await this.authService.createAccount(accountData);
    
    // Show success modal
    this.showSuccessModal = true;
    
    // Emit the created account data
    this.create.emit(accountData);
  }

  private async updateAccount() {
    if (!this.accountToEdit) return;

    // Create updated account object
    const updatedAccountData: AccountData = {
      ...this.accountToEdit,
      accountName: this.newAccount.accountName,
      broker: this.newAccount.broker,
      server: this.newAccount.server,
      emailTradingAccount: this.newAccount.emailTradingAccount,
      brokerPassword: this.newAccount.brokerPassword,
      accountID: this.newAccount.accountID,
      accountNumber: this.newAccount.accountNumber,
      initialBalance: this.newAccount.initialBalance,
    };
    
    // Update in Firebase
    await this.authService.updateAccount(this.accountToEdit.id, updatedAccountData);
    
    // Show success modal
    this.showSuccessModal = true;
    
    // Emit the updated account data
    this.update.emit(updatedAccountData);
  }

  onGoToList() {
    this.showSuccessModal = false;
    this.close.emit();
  }

  resetForm() {
    this.newAccount = {
      accountName: '',
      broker: '',
      server: '',
      emailTradingAccount: '',
      brokerPassword: '',
      accountID: '',
      accountNumber: 1, // Default to 1 as suggested
      initialBalance: 0,
    };
  }

  populateFormForEdit() {
    if (this.accountToEdit) {
      this.newAccount = {
        accountName: this.accountToEdit.accountName || '',
        broker: this.accountToEdit.broker || '',
        server: this.accountToEdit.server || '',
        emailTradingAccount: this.accountToEdit.emailTradingAccount || '',
        brokerPassword: this.accountToEdit.brokerPassword || '',
        accountID: this.accountToEdit.accountID || '',
        accountNumber: this.accountToEdit.accountNumber || 1,
        initialBalance: this.accountToEdit.initialBalance || 0,
      };
    }
  }

  private createAccountObject(): AccountData {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    const uniqueId = `id_${timestamp}_${randomPart}`;
    
    return {
      id: uniqueId,
      userId: this.userId,
      emailTradingAccount: this.newAccount.emailTradingAccount,
      brokerPassword: this.newAccount.brokerPassword,
      broker: this.newAccount.broker,
      server: this.newAccount.server,
      accountName: this.newAccount.accountName,
      accountID: this.newAccount.accountID,
      accountNumber: this.newAccount.accountNumber,
      initialBalance: this.newAccount.initialBalance,
      createdAt: Timestamp.now(),
    };
  }

  /**
   * Validates if the account exists in TradeLocker
   * Simply tries to get JWT token - if successful, credentials are valid
   */
  private async validateAccountInTradeLocker(): Promise<boolean> {
    try {
      return await this.tradeLockerApiService.validateAccount({
        email: this.newAccount.emailTradingAccount,
        password: this.newAccount.brokerPassword,
        server: this.newAccount.server
      });
    } catch (error) {
      console.error('Error validating account in TradeLocker:', error);
      return false;
    }
  }

  /**
   * Validates that broker + server + accountId combination is unique across all accounts
   * Returns validation result with appropriate message
   */
  private async validateAccountUniqueness(): Promise<{isValid: boolean, message: string}> {
    try {
      // Check if broker + server + accountId combination already exists
      const accountExists = await this.authService.checkAccountExists(
        this.newAccount.broker,
        this.newAccount.server,
        this.newAccount.accountID,
        this.userId
      );
      
      if (accountExists) {
        return {
          isValid: false,
          message: 'This account is already registered. Try with another account or delete the existing trade account it is linked to.'
        };
      }

      return {
        isValid: true,
        message: ''
      };
    } catch (error) {
      return {
        isValid: false,
        message: 'This account is already registered. Try with another account or delete the existing trade account it is linked to.'
      };
    }
  }
}
