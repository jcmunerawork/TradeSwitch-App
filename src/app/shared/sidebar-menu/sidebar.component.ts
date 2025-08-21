import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../features/auth/service/authService';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  standalone: true,
})
export class Sidebar {
  isDashboardOpen = true;
userName: string = 'Test User';

  constructor(private authService: AuthService) { }

  



  toggleDashboard() {
    this.isDashboardOpen = !this.isDashboardOpen;
  }


  logout() {
    this.authService.logout().then(() => {
      console.log('Logout successful');
    }).catch((error) => {
      console.error('Logout failed:', error);
      alert('Logout failed. Please try again.');
    });
  }

}
