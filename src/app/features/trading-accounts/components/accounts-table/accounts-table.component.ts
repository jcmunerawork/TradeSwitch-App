import { Component, Input, Output, OnInit, OnDestroy, OnChanges, SimpleChanges, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';
import { User } from '../../../overview/models/overview';
import { EventEmitter } from '@angular/core';
import { Timestamp } from 'firebase/firestore';
import { AccountData } from '../../../auth/models/userModel';
import { ShowConfirmationComponent } from '../show-confirmation/show-confirmation.component';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';
import { AppContextService } from '../../../../shared/context';

/**
 * Component for displaying trading accounts in a table format.
 *
 * This component provides a filterable and sortable table for trading accounts.
 * It supports filtering by account name and balance range, sorting by creation date,
 * and includes functionality for editing and deleting accounts.
 *
 * Features:
 * - Search by account name
 * - Filter by balance range (with formatted currency inputs)
 * - Sort by creation date (ascending/descending)
 * - Edit account functionality
 * - Delete account with confirmation
 * - Currency formatting for balances
 *
 * Relations:
 * - ShowConfirmationComponent: Confirmation modal for account deletion
 * - NumberFormatterService: Currency formatting and parsing
 * - TradingAccountsComponent: Parent component (receives accounts, emits edit/delete events)
 *
 * @component
 * @selector app-accounts-table
 * @standalone true
 */
@Component({
  selector: 'app-accounts-table',
  standalone: true,
  imports: [CommonModule, FormsModule, ShowConfirmationComponent],
  templateUrl: './accounts-table.component.html',
  styleUrls: ['./accounts-table.component.scss'],
})
export class AccountsTableComponent implements OnInit, OnDestroy, OnChanges {
  @Input() accounts: AccountData[] = [];
  @Output() delete = new EventEmitter<AccountData>();
  @Output() edit = new EventEmitter<AccountData>();

  initialMinBalance = 0;
  initialMaxBalance = 1000000;
  showFilter = false;
  sortField: 'createdAt' = 'createdAt';
  sortAsc: boolean = true;
  showConfirmation = false;

  // Applied filter values (separate from input values)
  appliedMinBalance = 0;
  appliedMaxBalance = 1000000;

  // Properties for formatted balance inputs
  minBalanceDisplay: string = '';
  maxBalanceDisplay: string = '';
  minBalanceInput: string = '';
  maxBalanceInput: string = '';

  // Reference to filter container for click outside detection
  @ViewChild('filterContainer') filterContainer?: ElementRef;

  // Balance properties (now handled by parent component)
  private subscriptions: Subscription[] = [];
  
  // Real-time balances from streams (usando signal del contexto)
  // Se inicializa en ngOnInit después de que appContext esté disponible
  accountBalances: Map<string, number> = new Map();

  constructor(
    private router: Router,
    private numberFormatter: NumberFormatterService,
    private appContext: AppContextService
  ) {
    // Initialize inputs as empty to show placeholders
    this.minBalanceInput = '';
    this.maxBalanceInput = '';
    this.minBalanceDisplay = '';
    this.maxBalanceDisplay = '';
  }

  private _searchTerm = '';
  accountToDelete!: AccountData;
  get searchTerm(): string {
    return this._searchTerm;
  }
  set searchTerm(val: string) {
    this._searchTerm = val;
  }

  get filteredUsers(): AccountData[] {
    const lower = this._searchTerm.trim().toLowerCase();

    let result = this.accounts.filter((account) => {
      const matchesSearch = `${account.accountName}`
        .toLowerCase()
        .includes(lower);

      let matchesMinBalance = (account.balance ?? 0) >= this.appliedMinBalance;
      let matchesMaxBalance = (account.balance ?? 0) <= this.appliedMaxBalance;

      if (account.balance === undefined) {
        matchesMinBalance = true;
        matchesMaxBalance = true;
      }

      return matchesSearch && matchesMinBalance && matchesMaxBalance;
    });

    result = result.sort((a, b) => {
      // Manejar createdAt de manera segura
      // this.sortField siempre es 'createdAt' según la definición del tipo
      const fieldA = this.getCreatedAtDate(a).getTime();
      const fieldB = this.getCreatedAtDate(b).getTime();

      if (fieldA < fieldB) return this.sortAsc ? -1 : 1;
      if (fieldA > fieldB) return this.sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }


  statusClass(status: string) {
    return status;
  }

  returnClass(returnValue: number) {
    return returnValue >= 0 ? 'green' : 'red';
  }

  openFilter() {
    this.showFilter = !this.showFilter;
    
    if (this.showFilter) {
      // Load current applied values into inputs
      this.initialMinBalance = this.appliedMinBalance;
      this.initialMaxBalance = this.appliedMaxBalance;
      
      // Set input values for display
      if (this.initialMinBalance > 0) {
        this.minBalanceInput = this.initialMinBalance.toString();
        this.minBalanceDisplay = this.numberFormatter.formatCurrencyDisplay(this.initialMinBalance);
      } else {
        this.minBalanceInput = '';
        this.minBalanceDisplay = '';
      }
      
      if (this.initialMaxBalance > 0 && this.initialMaxBalance !== 1000000) {
        this.maxBalanceInput = this.initialMaxBalance.toString();
        this.maxBalanceDisplay = this.numberFormatter.formatCurrencyDisplay(this.initialMaxBalance);
      } else {
        this.maxBalanceInput = '';
        this.maxBalanceDisplay = '';
      }
    }
  }

  closeFilter() {
    this.showFilter = false;
  }

  apply() {
    this.applyFilters();
  }

  applyFilters() {
    // Apply the current input values to the filter
    this.appliedMinBalance = this.initialMinBalance;
    this.appliedMaxBalance = this.initialMaxBalance;
    this.showFilter = false;
  }

  // Host listener to detect clicks outside the filter modal
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.showFilter && this.filterContainer) {
      const clickedInside = this.filterContainer.nativeElement.contains(event.target as Node);
      if (!clickedInside) {
        this.showFilter = false;
      }
    }
  }

  toggleSort() {
    this.sortAsc = !this.sortAsc;
  }

  getUserDate(date: number): Date {
    return new Date(date);
  }

  /**
   * Convierte createdAt a Date de manera segura
   * Maneja Timestamp de Firestore, Date, string o number
   * Siempre devuelve una fecha válida
   */
  getCreatedAtDate(account: AccountData): Date {
    if (!account || !account.createdAt) {
      return new Date();
    }

    const createdAt = account.createdAt as any;
    let date: Date | null = null;

    // Si es un Timestamp de Firestore
    if (createdAt instanceof Timestamp) {
      try {
        date = createdAt.toDate();
        if (date && !isNaN(date.getTime())) {
          return date;
        }
      } catch (e) {
        console.warn('Error converting Timestamp to Date:', e);
      }
      return new Date();
    }

    // Si ya es un Date
    if (createdAt instanceof Date) {
      if (!isNaN(createdAt.getTime())) {
        return createdAt;
      }
      return new Date();
    }

    // Si es un objeto con formato Firestore serializado (seconds, nanoseconds)
    if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
      const seconds = createdAt.seconds;
      if (typeof seconds === 'number' && seconds > 0) {
        try {
          date = new Date(seconds * 1000);
          if (date && !isNaN(date.getTime())) {
            return date;
          }
        } catch (e) {
          console.warn('Error converting Firestore seconds to Date:', e);
        }
      }
      return new Date();
    }

    // Si es un string, intentar parsear
    if (typeof createdAt === 'string') {
      // Si está vacío, devolver fecha actual
      if (createdAt.trim() === '') {
        return new Date();
      }
      
      try {
        date = new Date(createdAt);
        // Validar que la fecha sea válida y no sea "Invalid Date"
        if (date && !isNaN(date.getTime()) && date.toString() !== 'Invalid Date') {
          return date;
        }
      } catch (e) {
        console.warn('Error parsing date string:', createdAt, e);
      }
      return new Date();
    }

    // Si es un number (timestamp en milisegundos o segundos)
    if (typeof createdAt === 'number') {
      // Si es muy pequeño, probablemente está en segundos, convertir a milisegundos
      const timestamp = createdAt < 10000000000 ? createdAt * 1000 : createdAt;
      try {
        date = new Date(timestamp);
        if (date && !isNaN(date.getTime())) {
          return date;
        }
      } catch (e) {
        console.warn('Error converting number to Date:', timestamp, e);
      }
      return new Date();
    }

    // Fallback: intentar convertir a Date
    try {
      date = new Date(createdAt);
      if (date && !isNaN(date.getTime()) && date.toString() !== 'Invalid Date') {
        return date;
      }
    } catch (e) {
      console.warn('Error in fallback date conversion:', e);
    }

    // Si todo falla, devolver fecha actual
    return new Date();
  }

  deleteAccount(account: AccountData) {
    this.showConfirmation = true;
    this.accountToDelete = account;
  }

  editAccount(account: AccountData) {
    this.edit.emit(account);
  }

  confirmDelete() {
    this.delete.emit(this.accountToDelete);
    this.accountToDelete = {} as AccountData;
    this.showConfirmation = false;
  }

  cancelDelete() {
    this.showConfirmation = false;
    this.accountToDelete = {} as AccountData;
  }

  ngOnInit() {
    // Inicializar accountBalances con el valor actual del signal
    this.accountBalances = this.appContext.accountBalances();
    
    // Suscribirse a balances en tiempo real del contexto
    this.subscriptions.push(
      this.appContext.accountBalances$.subscribe(balances => {
        this.accountBalances = balances;
      })
    );
    
    // Cargar balances para todas las cuentas (método antiguo comentado)
    // this.loadAccountBalances();
  }
  
  /**
   * Get balance for an account (from real-time streams or account data)
   */
  getAccountBalance(account: AccountData): number | undefined {
    // Obtener balance actualizado del signal
    const currentBalances = this.appContext.accountBalances();
    
    // Primero intentar obtener del balance en tiempo real
    const realTimeBalance = currentBalances.get(account.accountID) || 
                           currentBalances.get(account.id);
    
    if (realTimeBalance !== undefined && realTimeBalance !== null) {
      return realTimeBalance;
    }
    
    // Fallback al balance del objeto account
    return account.balance;
  }

  /**
   * Check if balances are currently loading
   */
  isBalancesLoading(): boolean {
    return this.appContext.balancesLoading();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['accounts']) {
      // Recargar balances cuando cambien las cuentas
      if (this.accounts && this.accounts.length > 0) {
        this.loadAccountBalances();
      }
    }
  }

  ngOnDestroy() {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Carga el balance real para todas las cuentas usando el ReportService
   * Nota: Los balances se cargan desde el componente padre (trading-accounts)
   */
  loadAccountBalances() {
    // Los balances se cargan desde el componente padre
    // Este método se mantiene para compatibilidad pero no hace nada
  }

  // Methods for balance input formatting
  onMinBalanceInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.minBalanceInput = target.value;
  }

  onMaxBalanceInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.maxBalanceInput = target.value;
  }

  onMinBalanceFocus() {
    // When user focuses, show only the number without formatting for editing
    if (this.initialMinBalance > 0) {
      this.minBalanceInput = this.initialMinBalance.toString();
    } else {
      this.minBalanceInput = '';
    }
  }

  onMaxBalanceFocus() {
    // When user focuses, show only the number without formatting for editing
    if (this.initialMaxBalance > 0 && this.initialMaxBalance !== 1000000) {
      this.maxBalanceInput = this.initialMaxBalance.toString();
    } else {
      this.maxBalanceInput = '';
    }
  }

  onMinBalanceBlur() {
    // Convert the value to number
    const numericValue = this.numberFormatter.parseCurrencyValue(this.minBalanceInput);
    if (!isNaN(numericValue) && numericValue >= 0) {
      // Save the unformatted value
      this.initialMinBalance = numericValue;
      
      // Show visual format (only for display)
      this.minBalanceDisplay = this.numberFormatter.formatCurrencyDisplay(numericValue);
      
      // Update the input to show the visual format
      this.minBalanceInput = this.minBalanceDisplay;
    } else {
      // If not a valid number, clear
      this.minBalanceInput = '';
      this.minBalanceDisplay = '';
      this.initialMinBalance = 0;
    }
  }

  onMaxBalanceBlur() {
    // Convert the value to number
    const numericValue = this.numberFormatter.parseCurrencyValue(this.maxBalanceInput);
    if (!isNaN(numericValue) && numericValue >= 0) {
      // Save the unformatted value
      this.initialMaxBalance = numericValue;
      
      // Show visual format (only for display)
      this.maxBalanceDisplay = this.numberFormatter.formatCurrencyDisplay(numericValue);
      
      // Update the input to show the visual format
      this.maxBalanceInput = this.maxBalanceDisplay;
    } else {
      // If not a valid number, clear
      this.maxBalanceInput = '';
      this.maxBalanceDisplay = '';
      this.initialMaxBalance = 0; // Reset to 0 instead of 1000000
    }
  }



}
