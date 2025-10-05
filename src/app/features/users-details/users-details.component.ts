import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { FormsModule } from '@angular/forms';
import { UserManagementService } from '../../shared/services/user-management.service';
import { UsersTableComponent } from './components/users-table/users-table.component';
import { User, UserStatus } from '../overview/models/overview';
import { Timestamp } from 'firebase/firestore';
import { UserModalComponent } from './components/user-modal/user-modal.component';
import { AuthService } from '../auth/service/authService';
import { AppContextService } from '../../shared/context';

@Component({
  selector: 'app-users-details',
  imports: [
    CommonModule,
    LoadingPopupComponent,
    FormsModule,
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
    private userManagementService: UserManagementService,
    private userSvc: AuthService,
    private appContext: AppContextService
  ) {}

  loading = false;
  usersData: User[] = [];

  ngOnInit(): void {
    // Suscribirse a los datos del contexto
    this.subscribeToContextData();
    this.loadConfig();
  }

  private subscribeToContextData() {
    // Suscribirse a los datos del usuario actual
    this.appContext.currentUser$.subscribe(user => {
      // Verificar si el usuario actual es admin
      if (user && user.isAdmin) {
        // Solo los admins pueden ver esta página
        this.loadUsersData();
      }
    });

    // Suscribirse a los estados de carga
    this.appContext.isLoading$.subscribe(loading => {
      this.loading = loading.user;
    });

    // Suscribirse a los errores
    this.appContext.errors$.subscribe(errors => {
      if (errors.user) {
        console.error('Error en gestión de usuarios:', errors.user);
      }
    });
  }

  loadConfig() {
    this.getUsersData();
  }

  private loadUsersData() {
    this.getUsersData();
  }

  async getUsersData() {
    try {
      const allUsers = await this.userManagementService.getAllUsers();
      this.usersData = allUsers.filter((user) => !user.isAdmin);
      this.loading = false;
    } catch (error) {
      this.loading = false;
      console.error('Error getting users data:', error);
    }
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
}
