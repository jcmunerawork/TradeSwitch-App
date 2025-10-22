import { Component, signal } from '@angular/core';
import {  RouterOutlet } from '@angular/router';
import { Sidebar } from './shared/sidebar-menu/sidebar.component';
import { MobileHeaderComponent } from './shared/mobile-header/mobile-header.component';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar, MobileHeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  standalone: true,
})
export class App {
  protected readonly title = signal('Trade-Switch');
}
