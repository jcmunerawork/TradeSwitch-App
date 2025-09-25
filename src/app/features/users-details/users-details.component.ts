import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { OverviewService } from '../overview/services/overview.service';
import { UsersTableComponent } from './components/users-table/users-table.component';
import { User, UserStatus } from '../overview/models/overview';
import { Timestamp } from 'firebase/firestore';
import { UserModalComponent } from './components/user-modal/user-modal.component';
import { AuthService } from '../auth/service/authService';

@Component({
  selector: 'app-users-details',
  imports: [
    CommonModule,
    LoadingPopupComponent,
    FormsModule,
    ReactiveFormsModule,
    UsersTableComponent,
    UserModalComponent,
  ],
  templateUrl: './users-details.component.html',
  styleUrl: './users-details.component.scss',
  standalone: true,
})
export class UsersDetails {
  topUsers: User[] = [];
  selectedUser: User | null = null;
  constructor(
    private store: Store,
    private overviewSvc: OverviewService,
    private userSvc: AuthService,
    private fb: FormBuilder
  ) {}

  loading = false;
  usersData: User[] = [];
  filteredUsersData: User[] = [];
  searchTerm: string = '';
  sortAsc: boolean = true;
  showFilter: boolean = false;
  initialMinStrat: number = 0;
  initialMaxStrat: number = 100;

  // Modal states
  showRoleSelectionModal: boolean = false;
  showCreateUserModal: boolean = false;
  showCancelModal: boolean = false;
  showSuccessModal: boolean = false;
  selectedRole: 'user' | 'admin' = 'user';
  showPassword: boolean = false;

  // Create user form
  createUserForm!: FormGroup;

  ngOnInit(): void {
    this.loadConfig();
    this.initializeCreateUserForm();
  }

  initializeCreateUserForm(): void {
    this.createUserForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      phoneNumber: [''],
      country: ['US'],
      timezone: ['GMT-5'],
      language: ['en'],
      notes: ['']
    });
  }

  loadConfig() {
    this.getUsersData();
  }

  getUsersData() {
    this.overviewSvc
      .getUsersData()
      .then((docSnap) => {
        if (docSnap && !docSnap.empty && docSnap.docs.length > 0) {
          this.usersData = docSnap.docs
            .map((doc) => {
              return {
                ...(doc.data() as User),
              };
            })
            .filter((user) => !user.isAdmin);
          
          // Inicializar los datos filtrados
          this.filteredUsersData = [...this.usersData];
          this.applyFilters();
          this.loading = false;
        } else {
          this.loading = false;
          console.warn('No config');
        }
      })
      .catch((err) => {
        this.loading = false;

        console.error('Error to get the config', err);
      });
  }

  onBan(event: { username: string; reason: string }) {
    if (event.username === this.selectedUser?.firstName) {
      this.userSvc.createUser({
        ...this.selectedUser,
        status: UserStatus.BANNED,
      });
    } else {
      alert('Use the firstName as Username to ban the user');
    }
  }

  onUnban(username: string) {
    if (username === this.selectedUser?.firstName) {
      this.userSvc.createUser({
        ...this.selectedUser,
        status: UserStatus.PURCHASED,
      });
    } else {
      alert('Use the firstName as Username to unban the user');
    }
  }

  onSetPassword(newPassword: string) {
    // Handle set password logic here
  }

  onSendResetLink(email: string) {
    // Handle send reset link logic here
  }

  onLogoutEverywhere(userId: string) {
    // Handle logout everywhere logic here
  }

  // Métodos para filtrado y búsqueda
  onSearchChange() {
    this.applyFilters();
  }

  toggleSort() {
    this.sortAsc = !this.sortAsc;
    this.applyFilters();
  }

  openFilter() {
    this.showFilter = !this.showFilter;
  }

  apply() {
    this.showFilter = false;
    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.usersData];

    // Aplicar búsqueda
    if (this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        user.firstName.toLowerCase().includes(searchLower) ||
        user.lastName.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      );
    }

    // Aplicar filtro de strategy_followed
    filtered = filtered.filter(user => {
      if (user.strategy_followed === undefined) {
        return true;
      }
      return user.strategy_followed >= this.initialMinStrat && 
             user.strategy_followed <= this.initialMaxStrat;
    });

    // Aplicar ordenamiento
    filtered.sort((a, b) => {
      const nameA = a.firstName.toLowerCase();
      const nameB = b.firstName.toLowerCase();
      
      if (this.sortAsc) {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    });

    this.filteredUsersData = filtered;
  }

  // Modal methods
  openCreateUserModal(): void {
    this.showRoleSelectionModal = true;
  }

  closeRoleSelectionModal(): void {
    this.showRoleSelectionModal = false;
  }

  closeCreateUserModal(): void {
    this.showCreateUserModal = false;
    this.createUserForm.reset();
    this.initializeCreateUserForm();
  }

  // Cancel modal methods
  openCancelModal(): void {
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
  }

  confirmCancel(): void {
    this.showCancelModal = false;
    this.showCreateUserModal = false;
    this.createUserForm.reset();
    this.initializeCreateUserForm();
  }

  // Success modal methods
  showSuccessModalAfterCreation(): void {
    this.showCreateUserModal = false;
    this.showSuccessModal = true;
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
  }

  createAnotherUser(): void {
    this.showSuccessModal = false;
    this.showRoleSelectionModal = true;
    this.createUserForm.reset();
    this.initializeCreateUserForm();
  }

  goToUserList(): void {
    this.showSuccessModal = false;
    this.getUsersData(); // Refresh the users list
  }

  getCancelModalTitle(): string {
    return this.selectedRole === 'admin' ? 'Cancel admin creation?' : 'Cancel user creation?';
  }

  selectRole(role: 'user' | 'admin'): void {
    this.selectedRole = role;
    this.showRoleSelectionModal = false;
    this.showCreateUserModal = true;
  }

  // Password methods
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  getPasswordStrength(): string {
    const password = this.createUserForm.get('password')?.value || '';
    if (password.length < 8) return 'weak';
    if (this.hasUppercase() && this.hasLowercase() && this.hasNumberOrSymbol()) return 'strong';
    return 'medium';
  }

  getPasswordStrengthClass(): string {
    const strength = this.getPasswordStrength();
    return `strength-${strength}`;
  }

  hasUppercase(): boolean {
    const password = this.createUserForm.get('password')?.value || '';
    return /[A-Z]/.test(password);
  }

  hasLowercase(): boolean {
    const password = this.createUserForm.get('password')?.value || '';
    return /[a-z]/.test(password);
  }

  hasNumberOrSymbol(): boolean {
    const password = this.createUserForm.get('password')?.value || '';
    return /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
  }

  hasMinLength(): boolean {
    const password = this.createUserForm.get('password')?.value || '';
    return password.length >= 8;
  }

  containsNameOrEmail(): boolean {
    const password = this.createUserForm.get('password')?.value || '';
    const firstName = this.createUserForm.get('firstName')?.value || '';
    const lastName = this.createUserForm.get('lastName')?.value || '';
    const email = this.createUserForm.get('email')?.value || '';
    
    const passwordLower = password.toLowerCase();
    return passwordLower.includes(firstName.toLowerCase()) || 
           passwordLower.includes(lastName.toLowerCase()) || 
           passwordLower.includes(email.toLowerCase());
  }

  isPasswordValid(): boolean {
    return this.hasUppercase() && this.hasLowercase() && this.hasNumberOrSymbol() && this.hasMinLength() && !this.containsNameOrEmail();
  }

  // Create user methods
  onCreateUserSubmit(): void {
    if (this.createUserForm.valid && this.isPasswordValid()) {
      this.createUser();
    }
  }

  private createUser(): void {
    this.loading = true;
    
    // Create user credentials
    const userCredentials = {
      email: this.createUserForm.value.email,
      password: this.createUserForm.value.password
    };

    // Register user with Firebase Auth
    this.userSvc.register(userCredentials)
      .then((response: any) => {
        const userId = response.user.uid;
        
        // Create user object
        const user = this.createUserObject(userId);
        
        // Create token
        const token = this.createTokenObject(userId);
        
        // Save user and token to Firebase
        this.userSvc.createUser(user);
        this.userSvc.createLinkToken(token);
        
        this.loading = false;
        this.showSuccessModalAfterCreation();
        this.getUsersData(); // Refresh the users list
      })
      .catch((error: any) => {
        this.loading = false;
        console.error('User creation failed:', error);
        alert('User creation failed. Please try again.');
      });
  }

  private createUserObject(userId: string): User {
    return {
      id: userId,
      email: this.createUserForm.value.email,
      firstName: this.createUserForm.value.firstName,
      lastName: this.createUserForm.value.lastName,
      phoneNumber: this.createUserForm.value.phoneNumber || '',
      birthday: new Date(), // Default birthday
      best_trade: 0,
      netPnl: 0,
      number_trades: 0,
      profit: 0,
      status: UserStatus.CREATED,
      strategy_followed: 0,
      subscription_date: new Date().getTime(),
      lastUpdated: new Date().getTime(),
      total_spend: 0,
      isAdmin: this.selectedRole === 'admin',
      tokenId: this.createUserForm.value.email.split('@')[0] + userId.substring(0, 4)
    };
  }

  private createTokenObject(userId: string): any {
    return {
      id: this.createUserForm.value.email.split('@')[0] + userId.substring(0, 4),
      userId: userId
    };
  }
}
