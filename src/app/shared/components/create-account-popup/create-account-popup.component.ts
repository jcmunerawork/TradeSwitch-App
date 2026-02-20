import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradeLockerApiService } from '../../services/tradelocker-api.service';
import { AuthService } from '../../../features/auth/service/authService';
import { AccountData } from '../../../features/auth/models/userModel';
import { Timestamp } from 'firebase/firestore';
import { NumberFormatterService } from '../../utils/number-formatter.service';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';
import { ToastNotificationService } from '../../services/toast-notification.service';

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
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent],
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
    private numberFormatter: NumberFormatterService,
    private toastService: ToastNotificationService
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
    broker: 'TradeLocker',
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
  showAccountNumberTooltip = false;
  showAccountIDTooltip = false;
  isCreatingAccount = false;

  // Field validation errors (shown in red below inputs)
  fieldErrors: { accountNumber: string; accountID: string; email: string; initialBalance: string } = {
    accountNumber: '',
    accountID: '',
    email: '',
    initialBalance: ''
  };

  // String used for account number input (only digits); synced with newAccount.accountNumber
  accountNumberDisplay = '';

  showPassword = false;
  successMessage = '';
  /** Backend error message shown inside the modal so it's always visible (e.g. 400 from API) */
  backendErrorMessage = '';

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

  private clearFieldErrors() {
    this.fieldErrors = { accountNumber: '', accountID: '', email: '', initialBalance: '' };
  }

  onAccountNumberInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const digits = (input.value || '').replace(/\D/g, '');
    input.value = digits;
    this.accountNumberDisplay = digits;
    const num = parseInt(digits, 10);
    this.newAccount.accountNumber = isNaN(num) || num < 1 ? 0 : num;
  }

  onAccountIDInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const digits = (input.value || '').replace(/\D/g, '');
    input.value = digits;
    this.newAccount.accountID = digits;
  }

  validateEmail(): boolean {
    const email = (this.newAccount.emailTradingAccount || '').trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    this.fieldErrors.email = valid || !email ? '' : 'Please enter a valid email address.';
    return valid;
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async onCreate() {
    this.clearFieldErrors();
    this.backendErrorMessage = '';

    if (!this.newAccount.accountName?.trim() ||
        !this.newAccount.emailTradingAccount?.trim() ||
        !this.newAccount.brokerPassword ||
        !this.newAccount.server?.trim() ||
        !this.newAccount.accountID ||
        !this.newAccount.accountNumber) {
      this.toastService.showError('Please fill in all required fields.');
      return;
    }

    if (!this.validateEmail()) {
      this.toastService.showError('Please enter a valid email address.');
      return;
    }

    if (this.newAccount.accountNumber < 1) {
      this.fieldErrors.accountNumber = 'Account number must be at least 1.';
      this.toastService.showError('Please enter a valid account number.');
      return;
    }

    const balanceValue = this.numberFormatter.parseCurrencyValue(this.initialBalanceInput);
    const validBalance = !isNaN(balanceValue) && balanceValue >= 0;
    if (!this.editMode && (!validBalance || (this.initialBalanceInput.trim() === ''))) {
      this.fieldErrors.initialBalance = 'Please enter a valid initial balance (number ≥ 0).';
      this.toastService.showError('Please enter a valid initial balance.');
      return;
    }
    if (validBalance) {
      this.newAccount.initialBalance = balanceValue;
    }

    this.isCreatingAccount = true;

    try {
      const accountExists = await this.validateAccountInTradeLocker();
      if (!accountExists) {
        this.isCreatingAccount = false;
        this.toastService.showError('Account does not exist in TradeLocker. Please verify the credentials.');
        return;
      }

      // La unicidad (accountID, email, broker+server+accountID) se valida en el backend al hacer POST.
      // Si hay conflicto, el backend responde 409 con un mensaje concreto; se muestra en el catch.

      if (this.editMode && this.accountToEdit) {
        // Update existing account
        await this.updateAccount();
      } else {
        // Create new account
        await this.createNewAccount();
      }
      
      // Hide loading popup before showing success modal
      this.isCreatingAccount = false;
      
    } catch (error: unknown) {
      console.error('Error processing trading account:', error);
      this.isCreatingAccount = false;
      this.backendErrorMessage = this.toastService.extractErrorMessage(error as any) || `Failed to ${this.editMode ? 'update' : 'create'} trading account. Please try again.`;
      this.toastService.showBackendError(error as any, this.backendErrorMessage);
    }
  }

  private async createNewAccount() {
    const accountData = this.createAccountObject();
    const message = await this.authService.createAccount(accountData);
    this.successMessage = message || 'Trading account created successfully.';
    this.toastService.showSuccess(this.successMessage);
    this.showSuccessModal = true;
    this.create.emit(accountData);
  }

  private async updateAccount() {
    if (!this.accountToEdit) return;

    const updatedAccountData: AccountData = {
      ...this.accountToEdit,
      accountName: this.newAccount.accountName,
      broker: 'TradeLocker',
      server: this.newAccount.server,
      emailTradingAccount: this.newAccount.emailTradingAccount,
      brokerPassword: this.newAccount.brokerPassword,
      accountID: this.newAccount.accountID,
      accountNumber: this.newAccount.accountNumber,
      initialBalance: this.newAccount.initialBalance || 0,
      netPnl: this.accountToEdit.netPnl || 0,
      profit: this.accountToEdit.profit || 0,
      bestTrade: this.accountToEdit.bestTrade || 0,
    };

    const message = await this.authService.updateAccount(this.accountToEdit.id, updatedAccountData);
    this.successMessage = message || 'Trading account updated successfully.';
    this.toastService.showSuccess(this.successMessage);
    this.showSuccessModal = true;
    this.update.emit(updatedAccountData);
  }

  onGoToList() {
    // Close success modal first
    this.showSuccessModal = false;
    // Reset form
    this.resetForm();
    // Use setTimeout to ensure the success modal closes before emitting close event
    // This prevents any potential z-index or event propagation issues
    setTimeout(() => {
      this.close.emit();
    }, 0);
  }

  // Balance input: only digits and at most one decimal point
  onInitialBalanceInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let raw = (input.value || '').replace(/[^\d.]/g, '');
    const parts = raw.split('.');
    if (parts.length > 2) {
      raw = parts[0] + '.' + parts.slice(1).join('');
    }
    input.value = raw;
    this.initialBalanceInput = raw;
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
      broker: 'TradeLocker',
      server: '',
      emailTradingAccount: '',
      brokerPassword: '',
      accountID: '',
      accountNumber: 1,
      initialBalance: 0,
    };
    this.accountNumberDisplay = '1';
    this.clearFieldErrors();
    this.showPassword = false;
    this.successMessage = '';
    this.backendErrorMessage = '';
    this.initialBalanceInput = '';
    this.initialBalanceDisplay = '';
  }

  populateFormForEdit() {
    if (this.accountToEdit) {
      this.newAccount = {
        accountName: this.accountToEdit.accountName || '',
        broker: 'TradeLocker',
        server: this.accountToEdit.server || '',
        emailTradingAccount: this.accountToEdit.emailTradingAccount || '',
        brokerPassword: this.accountToEdit.brokerPassword || '',
        accountID: this.accountToEdit.accountID || '',
        accountNumber: this.accountToEdit.accountNumber || 1,
        initialBalance: this.accountToEdit.initialBalance || 0,
      };
      this.accountNumberDisplay = String(this.newAccount.accountNumber || '1');
      this.clearFieldErrors();
      this.showPassword = false;
      this.successMessage = '';
      this.backendErrorMessage = '';
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
      broker: 'TradeLocker',
      server: this.newAccount.server,
      accountName: this.newAccount.accountName,
      accountID: this.newAccount.accountID,
      accountNumber: this.newAccount.accountNumber,
      initialBalance: this.newAccount.initialBalance,
      balance: this.newAccount.initialBalance || 0, // Usar initialBalance como balance inicial
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

}
