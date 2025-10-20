import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
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
export class Sidebar implements OnDestroy {
  isDashboardOpen = true;
  isSidebarMinimized = false;
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
    
    // Escuchar cambios de ruta para ajustar el sidebar
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateSidebarWidth(event.url);
      });
    
    // Establecer el ancho inicial del sidebar (solo en el cliente)
    if (typeof document !== 'undefined') {
      this.updateSidebarWidth(this.router.url);
    }
  }

  private updateSidebarWidth(url: string) {
    if (typeof document === 'undefined') return;
    
    const root = document.documentElement;
    const routesWithoutSidebar = ['/login', '/signup'];
    const hasSidebar = !routesWithoutSidebar.some(route => url.includes(route));
    
    if (hasSidebar) {
      // Hay sidebar, usar el ancho según el estado
      if (this.isSidebarMinimized) {
        root.style.setProperty('--sidebar-width', '80px');
      } else {
        root.style.setProperty('--sidebar-width', '230px');
      }
    } else {
      // No hay sidebar, resetear a 0
      root.style.setProperty('--sidebar-width', '0px');
    }
  }

  ngOnDestroy() {
    // Resetear la variable CSS cuando el componente se destruye (ej: al ir a login)
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--sidebar-width', '0px');
    }
  }

  onlyNameInitials() {
    return this.userName.charAt(0) + this.lastName.charAt(1);
  }

  toggleDashboard() {
    this.isDashboardOpen = !this.isDashboardOpen;
  }

  toggleSidebar() {
    this.isSidebarMinimized = !this.isSidebarMinimized;
    // Actualizar variable CSS usando la nueva lógica
    this.updateSidebarWidth(this.router.url);
  }

  logout() {
    this.authService
      .logout()
      .then(() => {
        // Limpiar todo el localStorage
        localStorage.clear();
        this.store.dispatch(setUserData({ user: null }));
        this.router.navigate(['/login']);
      })
      .catch((error) => {
        alert('Logout failed. Please try again.');
      });
  }
}
