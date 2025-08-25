import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../features/auth/service/authService';
import { Store } from '@ngrx/store';
import { selectUser } from '../../features/auth/store/user.selectios';
import { setUserData } from '../../features/auth/store/user.actions';
import { User, UserStatus } from '../../features/overview/models/overview';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  standalone: true,
})
export class Sidebar {
  isDashboardOpen = true;
  userName: string = '';
  lastName: string = '';
  isAdmin: boolean = false;
  userToken: string = '';
  isBanned: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private store: Store
  ) {
    this.store.select(selectUser).subscribe((user) => {
      this.userName = user?.user?.firstName || '';
      this.lastName = user?.user?.lastName || '';
      this.isAdmin = user?.user?.isAdmin || false;
      this.userToken = user?.user?.tokenId || '';
      this.isBanned = user?.user?.status === UserStatus.BANNED;
    });
  }

  onlyNameInitials() {
    return this.userName.charAt(0) + this.lastName.charAt(1);
  }

  toggleDashboard() {
    this.isDashboardOpen = !this.isDashboardOpen;
  }

  logout() {
    this.authService
      .logout()
      .then(() => {
        this.store.dispatch(setUserData({ user: null }));
        this.router.navigate(['/login']);
      })
      .catch((error) => {
        alert('Logout failed. Please try again.');
      });
  }
}
