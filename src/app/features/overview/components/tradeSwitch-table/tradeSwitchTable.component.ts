import { Component, Input, Injectable, HostListener, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User, UserStatus } from '../../models/overview';
import { FormsModule } from '@angular/forms';
import { NumberFormatterService } from '../../../../shared/utils/number-formatter.service';
import { AuthService } from '../../../../features/auth/service/authService';
import { AccountData } from '../../../../features/auth/models/userModel';

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
   * Cargar todas las cuentas y agruparlas por userId
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
   * Obtener cuentas de un usuario
   */
  getUserAccounts(userId: string): AccountData[] {
    return this.userAccountsMap.get(userId) || [];
  }
  
  /**
   * Verificar si un usuario tiene cuentas
   */
  hasAccounts(userId: string): boolean {
    const accounts = this.userAccountsMap.get(userId);
    return accounts ? accounts.length > 0 : false;
  }
  
  /**
   * Toggle expansión de filas de usuario
   */
  toggleExpand(userId: string) {
    if (this.expandedUsers.has(userId)) {
      this.expandedUsers.delete(userId);
    } else {
      this.expandedUsers.add(userId);
    }
  }
  
  /**
   * Verificar si un usuario está expandido
   */
  isExpanded(userId: string): boolean {
    return this.expandedUsers.has(userId);
  }

  private _searchTerm = '';
  get searchTerm(): string {
    return this._searchTerm;
  }
  set searchTerm(val: string) {
    this._searchTerm = val;
    this.goToPage(1);
  }

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

  get paginatedUsers(): User[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredUsers.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredUsers.length / this.itemsPerPage);
  }

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
  
  getDisplayStatus(user: User): string {
    const status = this.statusClass(user);
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  returnClass(returnValue: number) {
    return returnValue >= 0 ? 'green' : 'red';
  }

  openFilter() {
    this.showFilter = !this.showFilter;
  }

  closeFilter() {
    this.showFilter = false;
  }

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

  applyFilters() {
    this.goToPage(1);
  }
  
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
  
  // Getter para mostrar el rango de porcentaje en tiempo real
  get stratFollowedRange(): string {
    // Asegurar que min no sea mayor que max
    const min = Math.min(this.initialMinStrat, this.initialMaxStrat);
    const max = Math.max(this.initialMinStrat, this.initialMaxStrat);
    return `${min}% - ${max}%`;
  }
  
  // Método para asegurar que minStrat no sea mayor que maxStrat
  onMinStratChange() {
    if (this.initialMinStrat > this.initialMaxStrat) {
      const temp = this.initialMinStrat;
      this.initialMinStrat = this.initialMaxStrat;
      this.initialMaxStrat = temp;
    }
  }
  
  // Método para asegurar que maxStrat no sea menor que minStrat
  onMaxStratChange() {
    if (this.initialMaxStrat < this.initialMinStrat) {
      const temp = this.initialMaxStrat;
      this.initialMaxStrat = this.initialMinStrat;
      this.initialMinStrat = temp;
    }
  }

  onlyNameInitials(user: User) {
    return user.firstName.charAt(0) + user.lastName.charAt(0);
  }

  goToPage(page: number) {
    if (page < 1) page = 1;
    if (page > this.totalPages) page = this.totalPages;
    this.currentPage = page;
  }

  prevPage() {
    this.goToPage(this.currentPage - 1);
  }

  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  formatCurrency(value: number | null | undefined): string {
    return this.numberFormatter.formatCurrency(value);
  }
}
