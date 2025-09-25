import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  templateUrl: './stat_card.component.html',
  styleUrls: ['./stat_card.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class statCardComponent {
  @Input() title!: string;
  @Input() value?: string | number;
  @Input() showPercentage?: boolean = false;
  @Input() percentage?: number;
  @Input() isPositive?: boolean = true;

  constructor() {}
}
