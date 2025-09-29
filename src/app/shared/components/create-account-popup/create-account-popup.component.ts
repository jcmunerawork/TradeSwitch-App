import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    // When the popup becomes visible, set the account number based on current count
    if (changes['visible'] && changes['visible'].currentValue === true) {
      this.setAccountNumber();
    }
  }

  private setAccountNumber() {
    // Set the account number to be the next number after current count
    this.newAccount.accountNumber = this.currentAccountCount + 1;
  }


  // Form data
  newAccount = {
    emailTradingAccount: '',
    brokerPassword: '',
    accountName: '',
    broker: '',
    server: '',
    accountID: '',
    balance: 0,
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
        !this.newAccount.server || !this.newAccount.accountID) {
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
      
      // 2. Validate account email is not already used by another user
      const emailExists = await this.validateEmailNotUsed();
      if (emailExists) {
        alert('This broker email is already registered by another user.');
        return;
      }
      
      // 3. Create account object for Firebase
      const accountData = this.createAccountObject();
      
      // 4. Save to Firebase
      await this.authService.createAccount(accountData);
      
      // 5. Show success modal
      this.showSuccessModal = true;
      
      // 6. Emit the created account data
      this.create.emit(accountData);
      
    } catch (error) {
      console.error('Error creating trading account:', error);
      alert('Failed to create trading account. Please try again.');
    }
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
      accountNumber: 0,
      balance: 0,
    };
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
      balance: this.newAccount.balance,
      createdAt: Timestamp.now(),
    };
  }

  /**
   * Validates if the account exists in TradeLocker
   * Simply tries to get JWT token - if successful, credentials are valid
   */
  private async validateAccountInTradeLocker(): Promise<boolean> {
    try {
      const tokenResponse = await this.getJWTToken();
      return !!(tokenResponse && tokenResponse.accessToken);
    } catch (error) {
      console.error('Error validating account in TradeLocker:', error);
      return false;
    }
  }

  /**
   * Gets JWT token from TradeLocker using account credentials
   */
  private async getJWTToken(): Promise<any> {
    const tokenUrl = 'https://demo.tradelocker.com/backend-api/auth/jwt/token';
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    const body = {
      email: this.newAccount.emailTradingAccount,
      password: this.newAccount.brokerPassword,
      server: this.newAccount.server
    };

    return this.http.post(tokenUrl, body, { headers }).toPromise();
  }

  /**
   * Validates that the broker email is not already used by another user
   * Uses direct query to Firebase for better performance
   */
  private async validateEmailNotUsed(): Promise<boolean> {
    try {
      const emailExists = await this.authService.checkEmailExists(this.newAccount.emailTradingAccount, this.userId);
      return !emailExists;
    } catch (error) {
      console.error('Error validating email uniqueness:', error);
      return false;
    }
  }
}
