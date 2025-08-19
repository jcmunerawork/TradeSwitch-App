import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-rule-short',
  templateUrl: './rule-short.component.html',
  styleUrls: ['./rule-short.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class RuleShortComponent {
  @Input() title!: string;
  @Input() isActive?: any;

  constructor() {}
}
