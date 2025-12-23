import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradeLockerApiService } from '../../services/tradelocker-api.service';
import { AuthService } from '../../../features/auth/service/authService';
import { AccountData } from '../../../features/auth/models/userModel';
import { Timestamp } from 'firebase/firestore';
import { NumberFormatterService } from '../../utils/number-formatter.service';

/**
 * Component for creating and editing trading accounts.
 *
 * This component provides a modal interface for adding new trading accounts
 * or editing existing ones. It validates account credentials with TradeLocker
 * API and handles account creation/update operations.
 *
 * Features:
 * - Create new trading accounts
 * - Edit existing trading accounts
 * - Account validation with TradeLocker API
 * - Formatted balance input with currency formatting
 * - Confirmation modals (cancel, success)
 * - Form validation
 * - Account credential validation
 *
 * Account Fields:
 * - Account name
 * - Broker
 * - Email (trading account email)
 * - Password (broker password)
 * - Server
 * - Account ID
 * - Account number
 * - Initial balance (formatted currency input)
 *
 * Validation:
 * - Validates account exists in TradeLocker before creation
 * - Checks account credentials with TradeLocker API
 * - Form field validation
 *
 * Relations:
 * - AuthService: Creates/updates accounts in Firebase
 * - TradeLockerApiService: Validates account credentials
 * - NumberFormatterService: Formats balance input
 *
 * @component
 * @selector app-create-account-popup
 * @standalone true
 */
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
    private tradeLockerApiService: TradeLockerApiService,
    private numberFormatter: NumberFormatterService
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

  // Properties for formatted balance input
  initialBalanceInput: string = '';
  initialBalanceDisplay: string = '';

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
      netPnl: this.accountToEdit.netPnl || 0,
      profit: this.accountToEdit.profit || 0,
      bestTrade: this.accountToEdit.bestTrade || 0,
    };

    console.log('updatedAccountData', updatedAccountData);
    console.log('this.accountToEdit.id', this.accountToEdit.id);

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

  // Balance input event handlers
  onInitialBalanceInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.initialBalanceInput = target.value;
  }

  onInitialBalanceFocus() {
    // When user focuses, show only the number without formatting for editing
    if (this.newAccount.initialBalance > 0) {
      this.initialBalanceInput = this.newAccount.initialBalance.toString();
    } else {
      this.initialBalanceInput = '';
    }
  }

  onInitialBalanceBlur() {
    // Convert the value to number
    const numericValue = this.numberFormatter.parseCurrencyValue(this.initialBalanceInput);
    if (!isNaN(numericValue) && numericValue >= 0) {
      // Save the unformatted value
      this.newAccount.initialBalance = numericValue;
      
      // Show visual format (only for display)
      this.initialBalanceDisplay = this.numberFormatter.formatCurrencyDisplay(numericValue);
      
      // Update the input to show the visual format
      this.initialBalanceInput = this.initialBalanceDisplay;
    } else {
      // If not a valid number, clear
      this.initialBalanceInput = '';
      this.initialBalanceDisplay = '';
      this.newAccount.initialBalance = 0;
    }
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
    
    // Reset balance input properties
    this.initialBalanceInput = '';
    this.initialBalanceDisplay = '';
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
      
      // Set balance input values for display with currency format
      if (this.newAccount.initialBalance > 0) {
        this.initialBalanceDisplay = this.numberFormatter.formatCurrencyDisplay(this.newAccount.initialBalance);
        this.initialBalanceInput = this.initialBalanceDisplay; // Show formatted value initially
      } else {
        this.initialBalanceInput = '';
        this.initialBalanceDisplay = '';
      }
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
      netPnl: 0,
      profit: 0,
      bestTrade: 0,
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
   * When in edit mode, excludes the current account being edited
   */
  private async validateAccountUniqueness(): Promise<{isValid: boolean, message: string}> {
    try {
      // Check if broker + server + accountId combination already exists
      // If editing, exclude the current account being edited
      const accountExists = await this.authService.checkAccountExists(
        this.newAccount.broker,
        this.newAccount.server,
        this.newAccount.accountID,
        this.userId,
        this.editMode && this.accountToEdit ? this.accountToEdit.id : undefined
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
      console.error('Error validating account uniqueness:', error);
      return {
        isValid: false,
        message: 'This account is already registered. Try with another account or delete the existing trade account it is linked to.'
      };
    }
  }
}
