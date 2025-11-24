import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Component for displaying plan limitation banners.
 *
 * This component displays informational or warning banners related to plan
 * limitations, such as approaching account/strategy limits or needing to
 * upgrade. It provides actions to upgrade plans or dismiss the banner.
 *
 * Features:
 * - Customizable message and type (info, warning, error)
 * - Upgrade plan action
 * - Dismiss banner action
 * - Visibility control
 *
 * Banner Types:
 * - info: Informational banner (blue)
 * - warning: Warning banner (yellow/orange)
 * - error: Error banner (red)
 *
 * Usage:
 * <app-plan-banner
 *   [visible]="showBanner"
 *   [message]="bannerMessage"
 *   [type]="'warning'"
 *   (upgradePlan)="onUpgradePlan()"
 *   (closeBanner)="onCloseBanner()">
 * </app-plan-banner>
 *
 * Relations:
 * - Used by components that need to display plan limitation warnings
 * - Often used with PlanLimitationsGuard
 *
 * @component
 * @selector app-plan-banner
 * @standalone true
 */
@Component({
  selector: 'app-plan-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plan-banner.component.html',
  styleUrls: ['./plan-banner.component.scss']
})
export class PlanBannerComponent {
  @Input() visible: boolean = false;
  @Input() message: string = '';
  @Input() type: string = 'info';
  
  @Output() upgradePlan = new EventEmitter<void>();
  @Output() closeBanner = new EventEmitter<void>();

  onUpgradePlan() {
    this.upgradePlan.emit();
  }

  onCloseBanner() {
    this.closeBanner.emit();
  }
}
