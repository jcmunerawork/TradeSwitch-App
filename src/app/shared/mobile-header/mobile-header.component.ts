import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectUser } from '../../features/auth/store/user.selectios';
import { setUserData } from '../../features/auth/store/user.actions';
import { UserStatus } from '../../features/overview/models/overview';
import { AuthService } from '../../features/auth/service/authService';

/**
 * Mobile header component for responsive navigation.
 *
 * This component provides a mobile-friendly navigation header with a hamburger
 * menu, user information, and logout functionality. It's designed for smaller
 * screens where the sidebar is replaced by a collapsible header menu.
 *
 * Features:
 * - Mobile menu toggle (hamburger menu)
 * - User information display (name, initials, admin status, ban status)
 * - Logout functionality
 * - Responsive design for mobile devices
 * - Menu open/close state management
 *
 * Relations:
 * - AuthService: Handles logout functionality
 * - Store (NgRx): Gets current user data
 * - Router: Navigation after logout
 *
 * @component
 * @selector app-mobile-header
 * @standalone true
 */
@Component({
  selector: 'app-mobile-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mobile-header.component.html',
  styleUrls: ['./mobile-header.component.scss']
})
export class MobileHeaderComponent implements OnDestroy {
  isMobileMenuOpen = false;
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

  ngOnDestroy() {
    // Cleanup si es necesario
  }
  
  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }
  
  closeMobileMenu() {
    this.isMobileMenuOpen = false;
  }
  
  onlyNameInitials(): string {
    if (!this.userName) return '';
    return this.userName.charAt(0) + this.lastName.charAt(1);
  }
  
  logout() {
    this.closeMobileMenu();
    this.authService
      .logout()
      .then(() => {
        // AuthService ya limpia localStorage, sessionStorage, cookies y AppContext
        // Solo necesitamos limpiar el store de NgRx y navegar
        this.store.dispatch(setUserData({ user: null }));
        this.router.navigate(['/login']);
      })
      .catch((error) => {
        console.error('❌ MobileHeader: Error durante logout:', error);
        // Aún así, limpiar el store y navegar
        this.store.dispatch(setUserData({ user: null }));
        this.router.navigate(['/login']);
      });
  }
}
