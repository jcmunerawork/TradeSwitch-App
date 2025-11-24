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
import { AlertService } from '../../shared/services/alert.service';
import { ReasonsService } from '../../shared/services/reasons.service';
import { serverTimestamp } from 'firebase/firestore';

/**
 * Component for managing user details and administrative actions.
 *
 * This component provides administrators with tools to view, manage, and perform
 * administrative actions on users. It displays a table of all users (excluding admins)
 * and allows viewing detailed user information, banning/unbanning users, sending
 * password reset links, and logging users out from all devices.
 *
 * Features:
 * - Display all non-admin users in a table
 * - View detailed user information in a modal
 * - Ban users with reason tracking
 * - Unban users and update ban reason records
 * - Send password reset links
 * - Revoke Firebase tokens (logout everywhere)
 * - Admin-only access control
 *
 * Relations:
 * - UsersTableComponent: Displays the user table and handles user selection
 * - UserModalComponent: Shows detailed user information and action buttons
 * - UserManagementService: Fetches and updates user data
 * - AuthService: Handles password reset and token revocation
 * - ReasonsService: Manages ban reason records
 * - AppContextService: Provides current user data and loading states
 * - AlertService: Shows success/error notifications
 *
 * @component
 * @selector app-users-details
 * @standalone true
 */
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
    private appContext: AppContextService,
    private alertService: AlertService,
    private reasonsService: ReasonsService
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

  loadUsersData() {
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

  async onBan(event: { username: string; reason: string }) {
    if (!this.selectedUser) return;
    this.loading = true;
    const userId = String(this.selectedUser.id);
    this.reasonsService
      .createReason(userId, event?.reason || '')
      .then(() => this.userManagementService.updateUser(userId, { status: UserStatus.BANNED }))
      .then(async () => {
        await this.getUsersData();
        const refreshed = await this.userManagementService.getUserById(userId);
        if (refreshed) this.selectedUser = refreshed;
        this.alertService.showSuccess('User banned successfully', 'Ban User');
      })
      .catch((err) => {
        console.error('Error banning user', err);
        this.alertService.showError('Error banning user', 'Ban User');
      })
      .finally(() => (this.loading = false));
  }

  async onUnban(username: string) {
    if (!this.selectedUser) return;
    this.loading = true;
    const userId = String(this.selectedUser.id);
    this.userManagementService
      .updateUser(userId, { status: UserStatus.ACTIVE })
      .then(async () => {
        const openReason = await this.reasonsService.getOpenLatestReason(userId);
        if (openReason?.id) {
          await this.reasonsService.updateReason(userId, openReason.id, { dateUnban: serverTimestamp() } as any);
        }
      })
      .then(async () => {
        await this.getUsersData();
        const refreshed = await this.userManagementService.getUserById(userId);
        if (refreshed) this.selectedUser = refreshed;
        this.alertService.showSuccess('User unbanned successfully', 'Unban User');
      })
      .catch((err) => {
        console.error('Error unbanning user', err);
        this.alertService.showError('Error unbanning user', 'Unban User');
      })
      .finally(() => (this.loading = false));
  }

  onSendResetLink(email: string) {
    if (!email) {
      this.alertService.showInfo('Email is required', 'Password reset');
      return;
    }
    this.loading = true;
    this.userSvc
      .sendPasswordReset(email)
      .then(() => this.alertService.showSuccess('Reset link sent', 'Password reset'))
      .catch((err) => {
        console.error('Error sending reset link', err);
        this.alertService.showError('Error sending reset link', 'Password reset');
      })
      .finally(() => (this.loading = false));
  }

  onLogoutEverywhere(userId: string) {
    if (!userId) return;
    this.loading = true;
    this.userSvc
      .deleteLinkToken(userId as any)
      .then(() => this.alertService.showSuccess('Firebase token revoked', 'Logout everywhere'))
      .catch((err) => {
        console.error('Error revoking token', err);
        this.alertService.showError('Error revoking token', 'Logout everywhere');
      })
      .finally(() => (this.loading = false));
  }
}