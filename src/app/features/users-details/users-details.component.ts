import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { FormsModule } from '@angular/forms';
import { OverviewService } from '../overview/services/overview.service';
import { UsersTableComponent } from './components/users-table/users-table.component';
import { User } from '../overview/models/overview';
import { Timestamp } from 'firebase/firestore';
import { UserModalComponent } from './components/user-modal/user-modal.component';

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
  constructor(private store: Store, private overviewSvc: OverviewService) {}

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
          this.usersData = docSnap.docs.map((doc) => {
            const subscription_date = doc.data()['subscription_date'];

            return {
              ...(doc.data() as User),
              subscription_date: subscription_date.toDate(),
            };
          });

          for (let index = 0; index < 100; index++) {
            const randomUser: User = {
              ...this.usersData[1],
              profit: Math.floor(Math.random() * 1000),
              number_trades: Math.floor(Math.random() * 100),
            };
            this.usersData.push(randomUser);
            this.filterTop10Users();
          }
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

  filterTop10Users() {
    this.topUsers = this.usersData
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }

  onBan(event: { username: string; reason: string }) {
    // Handle ban logic here
  }

  onUnban(username: string) {
    // Handle unban logic here
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
