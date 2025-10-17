import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

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
