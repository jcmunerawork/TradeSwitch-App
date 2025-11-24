import { Component, Input, Injectable, HostListener, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User, UserStatus } from '../../models/overview';
import { FormsModule } from '@angular/forms';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';
import { AuthService } from '../../../../features/auth/service/authService';
import { AccountData } from '../../../../features/auth/models/userModel';

/**
 * Component for displaying a comprehensive user table with filtering and pagination.
 * 
 * This component provides a detailed table view of all users with the following features:
 * - Search by user name
 * - Filter by status, strategy followed percentage, number of strategies, and trading accounts
 * - Expandable rows showing user's trading accounts
 * - Pagination for large datasets
 * - CSV-friendly data display
 * 
 * Related to:
 * - OverviewComponent: Receives users array as Input
 * - AuthService: Fetches user trading accounts
 * - NumberFormatterService: Formats currency values
 * 
 * @component
 * @selector app-trade-switch-table
 * @standalone true
 */
@Component({
  selector: 'app-trade-switch-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tradeSwitchTable.component.html',
  styleUrls: ['./tradeSwitchTable.component.scss'],
})
@Injectable()
export class TradeSwitchTableComponent implements OnInit, OnDestroy {
  @Input() users: User[] = [];
  @ViewChild('filterModal', { static: false }) filterModal!: ElementRef;
  @ViewChild('filterButton', { static: false }) filterButton!: ElementRef;
  
  // Mapa de userId -> AccountData[]
  userAccountsMap: Map<string, AccountData[]> = new Map();
  // Set de userIds expandidos
  expandedUsers: Set<string> = new Set();
  // Flag para saber si las cuentas están cargadas
  accountsLoaded = false;
  
  // Valores iniciales (usados en el formulario)
  initialStatus: UserStatus | string = '';
  initialMinStrat: number = 0;
  initialMaxStrat: number = 100;
  initialStrategies: number = 0; // 0-8, si es 0 no filtra
  initialTradingAccounts: number = 0; // 0-8, si es 0 no filtra
  
  // Valores aplicados (usados para filtrar)
  appliedStatus: UserStatus | string = '';
  appliedMinStrat: number = 0;
  appliedMaxStrat: number = 100;
  appliedStrategies: number = 0; // 0-8, si es 0 no filtra
  appliedTradingAccounts: number = 0; // 0-8, si es 0 no filtra
  
  showFilter = false;
  currentPage: number = 1;
  itemsPerPage: number = 10;

  private numberFormatter = new NumberFormatterService();
  
  constructor(private authService: AuthService) {}
  
  ngOnInit() {
    this.loadAllAccounts();
  }
  
  ngOnDestroy() {
    // Cleanup si es necesario
  }
  
  /**
   * Loads all trading accounts and groups them by userId.
   * 
   * Fetches all accounts from Firebase and creates a map
   * where each userId maps to an array of their accounts.
   * 
   * Related to:
   * - AuthService.getAllAccounts(): Fetches all accounts from Firebase
   * 
   * @async
   * @memberof TradeSwitchTableComponent
   */
  async loadAllAccounts() {
    try {
      const allAccounts = await this.authService.getAllAccounts();
      if (allAccounts) {
        // Agrupar cuentas por userId
        const accountsMap = new Map<string, AccountData[]>();
        allAccounts.forEach(account => {
          if (!accountsMap.has(account.userId)) {
            accountsMap.set(account.userId, []);
          }
          accountsMap.get(account.userId)!.push(account);
        });
        this.userAccountsMap = accountsMap;
      }
      this.accountsLoaded = true;
    } catch (error) {
      console.error('Error loading accounts:', error);
      this.accountsLoaded = true;
    }
  }
  
  /**
   * Gets trading accounts for a specific user.
   * 
   * @param userId - User ID to get accounts for
   * @returns Array of AccountData for the user, or empty array if none
   * @memberof TradeSwitchTableComponent
   */
  getUserAccounts(userId: string): AccountData[] {
    return this.userAccountsMap.get(userId) || [];
  }
  
  /**
   * Checks if a user has any trading accounts.
   * 
   * @param userId - User ID to check
   * @returns true if user has accounts, false otherwise
   * @memberof TradeSwitchTableComponent
   */
  hasAccounts(userId: string): boolean {
    const accounts = this.userAccountsMap.get(userId);
    return accounts ? accounts.length > 0 : false;
  }
  
  /**
   * Toggles the expansion state of a user row.
   * 
   * Adds or removes the userId from the expandedUsers set
   * to show/hide the user's trading accounts.
   * 
   * @param userId - User ID to toggle expansion for
   * @memberof TradeSwitchTableComponent
   */
  toggleExpand(userId: string) {
    if (this.expandedUsers.has(userId)) {
      this.expandedUsers.delete(userId);
    } else {
      this.expandedUsers.add(userId);
    }
  }
  
  /**
   * Checks if a user row is currently expanded.
   * 
   * @param userId - User ID to check
   * @returns true if user row is expanded, false otherwise
   * @memberof TradeSwitchTableComponent
   */
  isExpanded(userId: string): boolean {
    return this.expandedUsers.has(userId);
  }

  private _searchTerm = '';
  
  /**
   * Gets the current search term.
   * 
   * @returns Current search term string
   * @memberof TradeSwitchTableComponent
   */
  get searchTerm(): string {
    return this._searchTerm;
  }
  
  /**
   * Sets the search term and resets to first page.
   * 
   * When search term changes, automatically navigates to page 1
   * to show filtered results from the beginning.
   * 
   * @param val - New search term value
   * @memberof TradeSwitchTableComponent
   */
  set searchTerm(val: string) {
    this._searchTerm = val;
    this.goToPage(1);
  }

  /**
   * Host listener for clicks outside the filter modal.
   * 
   * Closes the filter modal when user clicks outside of it
   * or the filter button. Prevents closing when clicking inside.
   * 
   * @param event - Mouse click event
   * @memberof TradeSwitchTableComponent
   */
  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    if (this.showFilter && 
        this.filterModal?.nativeElement &&
        this.filterButton?.nativeElement &&
        !this.filterModal.nativeElement.contains(event.target) &&
        !this.filterButton.nativeElement.contains(event.target)) {
      this.closeFilter();
    }
  }

  /**
   * Getter that returns filtered users based on search term and applied filters.
   * 
   * Filters users by:
   * - Search term: Matches against first name and last name
   * - Status: Matches user's display status
   * - Strategy followed: Range between min and max percentage
   * - Strategies: Exact number match (0 means no filter)
   * - Trading accounts: Exact number match (0 means no filter)
   * 
   * @returns Array of filtered User objects
   * @memberof TradeSwitchTableComponent
   */
  get filteredUsers(): User[] {
    const lower = this._searchTerm.trim().toLowerCase();

    return this.users.filter((user) => {
      const matchesSearch = `${user.firstName.split(' ')[0]} ${
        user.lastName.split(' ')[0]
      }`
        .toLowerCase()
        .includes(lower);
      
      const userDisplayStatus = this.statusClass(user);
      const matchesStatus =
        !this.appliedStatus || this.appliedStatus === '' || userDisplayStatus === this.appliedStatus;

      let matchesMinStrat = user.strategy_followed !== undefined && user.strategy_followed >= (this.appliedMinStrat ?? 0);
      let matchesMaxStrat = user.strategy_followed !== undefined && user.strategy_followed <= (this.appliedMaxStrat ?? 100);

      if (user.strategy_followed === undefined) {
        matchesMinStrat = false;
        matchesMaxStrat = false;
      }

      // Si appliedStrategies es 0, no se filtra; si es > 0, se filtra por ese número exacto
      const matchesStrategies = this.appliedStrategies === 0 || (user.strategies ?? 0) === this.appliedStrategies;

      // Si appliedTradingAccounts es 0, no se filtra; si es > 0, se filtra por ese número exacto
      const matchesTradingAccounts = this.appliedTradingAccounts === 0 || (user.trading_accounts ?? 0) === this.appliedTradingAccounts;

      return (
        matchesSearch && 
        matchesStatus && 
        matchesMinStrat && 
        matchesMaxStrat &&
        matchesStrategies &&
        matchesTradingAccounts
      );
    });
  }

  /**
   * Getter that returns paginated users for current page.
   * 
   * Calculates the slice of filtered users to display based on
   * currentPage and itemsPerPage.
   * 
   * @returns Array of users for current page
   * @memberof TradeSwitchTableComponent
   */
  get paginatedUsers(): User[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredUsers.slice(start, end);
  }

  /**
   * Getter that calculates total number of pages.
   * 
   * Based on filtered users count and items per page.
   * 
   * @returns Total number of pages
   * @memberof TradeSwitchTableComponent
   */
  get totalPages(): number {
    return Math.ceil(this.filteredUsers.length / this.itemsPerPage);
  }

  /**
   * Determines the display status class for a user.
   * 
   * Status logic:
   * - "banned" if user status is banned
   * - "created" if all user metrics are zero (new/inactive user)
   * - "active" if user has any activity (non-zero metrics)
   * 
   * @param user - User object to determine status for
   * @returns Status class string ('banned', 'created', or 'active')
   * @memberof TradeSwitchTableComponent
   */
  statusClass(user: User): string {
    // Si el status es banned, retornar banned
    if (String(user.status) === 'banned') {
      return 'banned';
    }
    
    // Verificar si todos los valores están en 0
    const allValuesZero = 
      (user.trading_accounts ?? 0) === 0 &&
      (user.strategies ?? 0) === 0 &&
      (user.strategy_followed ?? 0) === 0 &&
      (user.netPnl ?? 0) === 0 &&
      (user.profit ?? 0) === 0 &&
      (user.number_trades ?? 0) === 0 &&
      (user.total_spend ?? 0) === 0;
    
    // Si todos los valores están en 0, retornar created
    if (allValuesZero) {
      return 'created';
    }
    
    // Si no todos están en 0, retornar active
    return 'active';
  }
  
  /**
   * Gets display status string with capitalized first letter.
   * 
   * @param user - User object to get status for
   * @returns Capitalized status string (e.g., "Active", "Created", "Banned")
   * @memberof TradeSwitchTableComponent
   */
  getDisplayStatus(user: User): string {
    const status = this.statusClass(user);
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  /**
   * Determines CSS class for return value display.
   * 
   * Returns 'green' for positive or zero values, 'red' for negative values.
   * 
   * @param returnValue - Numeric value to determine class for
   * @returns CSS class string ('green' or 'red')
   * @memberof TradeSwitchTableComponent
   */
  returnClass(returnValue: number) {
    return returnValue >= 0 ? 'green' : 'red';
  }

  /**
   * Toggles the filter panel visibility.
   * 
   * @memberof TradeSwitchTableComponent
   */
  openFilter() {
    this.showFilter = !this.showFilter;
  }

  /**
   * Closes the filter panel.
   * 
   * @memberof TradeSwitchTableComponent
   */
  closeFilter() {
    this.showFilter = false;
  }

  /**
   * Applies filter values from initial to applied state.
   * 
   * Copies all initial filter values to applied values,
   * closes the filter panel, and applies the filters.
   * 
   * Related to:
   * - applyFilters(): Applies the filters and resets pagination
   * 
   * @memberof TradeSwitchTableComponent
   */
  apply() {
    // Aplicar los valores iniciales a los aplicados
    this.appliedStatus = this.initialStatus;
    this.appliedMinStrat = this.initialMinStrat;
    this.appliedMaxStrat = this.initialMaxStrat;
    this.appliedStrategies = this.initialStrategies;
    this.appliedTradingAccounts = this.initialTradingAccounts;
    
    this.showFilter = false;
    this.applyFilters();
  }

  /**
   * Applies filters and resets to first page.
   * 
   * Navigates to page 1 when filters are applied to show
   * filtered results from the beginning.
   * 
   * @memberof TradeSwitchTableComponent
   */
  applyFilters() {
    this.goToPage(1);
  }
  
  /**
   * Resets all filters to default values.
   * 
   * Clears both initial and applied filter values,
   * closes the filter panel, and applies the reset filters.
   * 
   * @memberof TradeSwitchTableComponent
   */
  resetFilters() {
    this.initialStatus = '';
    this.initialMinStrat = 0;
    this.initialMaxStrat = 100;
    this.initialStrategies = 0;
    this.initialTradingAccounts = 0;
    
    this.appliedStatus = '';
    this.appliedMinStrat = 0;
    this.appliedMaxStrat = 100;
    this.appliedStrategies = 0;
    this.appliedTradingAccounts = 0;
    
    this.showFilter = false; // Cerrar el filter
    this.applyFilters();
  }
  
  /**
   * Getter that returns the strategy followed percentage range as a formatted string.
   * 
   * Ensures min is not greater than max by using Math.min/max.
   * Used for real-time display in the filter UI.
   * 
   * @returns Formatted range string (e.g., "0% - 100%")
   * @memberof TradeSwitchTableComponent
   */
  get stratFollowedRange(): string {
    // Asegurar que min no sea mayor que max
    const min = Math.min(this.initialMinStrat, this.initialMaxStrat);
    const max = Math.max(this.initialMinStrat, this.initialMaxStrat);
    return `${min}% - ${max}%`;
  }
  
  /**
   * Ensures minStrat is not greater than maxStrat.
   * 
   * If minStrat exceeds maxStrat, swaps the values.
   * Called when minStrat input changes.
   * 
   * @memberof TradeSwitchTableComponent
   */
  onMinStratChange() {
    if (this.initialMinStrat > this.initialMaxStrat) {
      const temp = this.initialMinStrat;
      this.initialMinStrat = this.initialMaxStrat;
      this.initialMaxStrat = temp;
    }
  }
  
  /**
   * Ensures maxStrat is not less than minStrat.
   * 
   * If maxStrat is less than minStrat, swaps the values.
   * Called when maxStrat input changes.
   * 
   * @memberof TradeSwitchTableComponent
   */
  onMaxStratChange() {
    if (this.initialMaxStrat < this.initialMinStrat) {
      const temp = this.initialMaxStrat;
      this.initialMaxStrat = this.initialMinStrat;
      this.initialMinStrat = temp;
    }
  }

  /**
   * Gets user initials from first and last name.
   * 
   * Takes first character of firstName and lastName and concatenates them.
   * 
   * @param user - User object containing firstName and lastName
   * @returns Two-letter initials string
   * @memberof TradeSwitchTableComponent
   */
  onlyNameInitials(user: User) {
    return user.firstName.charAt(0) + user.lastName.charAt(0);
  }

  /**
   * Navigates to a specific page.
   * 
   * Validates page number is within valid range (1 to totalPages)
   * and updates currentPage.
   * 
   * @param page - Page number to navigate to
   * @memberof TradeSwitchTableComponent
   */
  goToPage(page: number) {
    if (page < 1) page = 1;
    if (page > this.totalPages) page = this.totalPages;
    this.currentPage = page;
  }

  /**
   * Navigates to the previous page.
   * 
   * @memberof TradeSwitchTableComponent
   */
  prevPage() {
    this.goToPage(this.currentPage - 1);
  }

  /**
   * Navigates to the next page.
   * 
   * @memberof TradeSwitchTableComponent
   */
  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  /**
   * Formats a numeric value as currency.
   * 
   * Uses NumberFormatterService to format the value with
   * appropriate currency symbol and formatting.
   * 
   * Related to:
   * - NumberFormatterService.formatCurrency(): Formats currency values
   * 
   * @param value - Numeric value to format (can be null or undefined)
   * @returns Formatted currency string
   * @memberof TradeSwitchTableComponent
   */
  formatCurrency(value: number | null | undefined): string {
    return this.numberFormatter.formatCurrency(value);
  }
}
