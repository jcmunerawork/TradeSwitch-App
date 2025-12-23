import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../features/auth/service/authService';
import { Store } from '@ngrx/store';
import { selectUser } from '../../features/auth/store/user.selectios';
import { setUserData } from '../../features/auth/store/user.actions';
import { User, UserStatus } from '../../features/overview/models/overview';

/**
 * Sidebar navigation component for the application.
 *
 * This component provides the main navigation sidebar with user information,
 * menu items, and logout functionality. It dynamically adjusts its width based
 * on the current route and user state, and manages CSS custom properties for
 * layout consistency.
 *
 * Features:
 * - User information display (name, initials, admin status, ban status)
 * - Collapsible sidebar (minimized/expanded states)
 * - Dynamic width management via CSS custom properties
 * - Route-based visibility (hidden on login/signup pages)
 * - Logout functionality
 * - Dashboard section toggle
 * - Responsive to route changes
 *
 * Width Management:
 * - Expanded: 230px
 * - Minimized: 80px
 * - Hidden: 0px (on login/signup routes)
 * - Uses CSS custom property: --sidebar-width
 *
 * Relations:
 * - AuthService: Handles logout functionality
 * - Store (NgRx): Gets current user data
 * - Router: Monitors route changes for width adjustment
 *
 * @component
 * @selector app-sidebar
 * @standalone true
 */
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
  private hasInitializedWidth = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private store: Store
  ) {
    // Inicializar el ancho a 0 inmediatamente para evitar el flash
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--sidebar-width', '0px');
    }

    this.store.select(selectUser).subscribe((user) => {
      this.userName = user?.user?.firstName || '';
      this.lastName = user?.user?.lastName || '';
      this.isAdmin = user?.user?.isAdmin || false;
      this.userToken = user?.user?.tokenId || '';
      this.isBanned = user?.user?.status === UserStatus.BANNED;
      
      // Solo actualizar el ancho del sidebar una vez que tengamos datos del usuario
      if (this.userName && !this.hasInitializedWidth) {
        this.hasInitializedWidth = true;
        this.updateSidebarWidth(this.router.url);
      } else if (!this.userName && this.hasInitializedWidth) {
        // Si el usuario se desloguea, resetear
        this.hasInitializedWidth = false;
        if (typeof document !== 'undefined') {
          const root = document.documentElement;
          root.style.setProperty('--sidebar-width', '0px');
        }
      }
    });
    
    // Escuchar cambios de ruta para ajustar el sidebar
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        // Solo actualizar si ya tenemos usuario
        if (this.userName) {
          this.updateSidebarWidth(event.url);
        }
      });
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
