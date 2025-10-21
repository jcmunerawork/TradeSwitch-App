import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AlertService, AlertConfig } from '../../services/alert.service';
import { AlertPopupComponent } from '../../pop-ups/alert-popup/alert-popup.component';

@Component({
  selector: 'app-global-alert',
  standalone: true,
  imports: [CommonModule, AlertPopupComponent],
  template: `
    <app-alert-popup
      [visible]="alertVisible"
      [title]="alertConfig?.title || ''"
      [message]="alertConfig?.message || ''"
      [buttonText]="alertConfig?.buttonText || 'OK'"
      [type]="alertConfig?.type || 'info'"
      (close)="onClose()"
      (confirm)="onConfirm()">
    </app-alert-popup>
  `
})
export class GlobalAlertComponent implements OnInit, OnDestroy {
  alertVisible = false;
  alertConfig: AlertConfig | null = null;
  private subscription: Subscription = new Subscription();

  constructor(private alertService: AlertService) {}

  ngOnInit(): void {
    this.subscription = this.alertService.alert$.subscribe(alert => {
      this.alertVisible = alert.visible;
      this.alertConfig = alert.config;
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onClose(): void {
    this.alertService.hideAlert();
  }

  onConfirm(): void {
    this.alertService.hideAlert();
  }
}
