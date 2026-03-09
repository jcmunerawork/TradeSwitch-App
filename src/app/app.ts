import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from './shared/sidebar-menu/sidebar.component';
import { MobileHeaderComponent } from './shared/mobile-header/mobile-header.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { TradingHistorySyncService } from './features/report/services/trading-history-sync.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar, MobileHeaderComponent, ToastContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  standalone: true,
})
export class App {
  protected readonly title = signal('Trade-Switch');
  private syncService = inject(TradingHistorySyncService);
}
