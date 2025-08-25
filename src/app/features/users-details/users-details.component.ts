import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { FormsModule } from '@angular/forms';
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
    private userSvc: AuthService
  ) {}

  loading = false;
  usersData: User[] = [];

  ngOnInit(): void {
    this.loadConfig();
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
}
