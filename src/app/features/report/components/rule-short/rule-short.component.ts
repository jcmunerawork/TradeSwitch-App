import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * Component for displaying a short rule indicator.
 *
 * This component displays a rule title and an active/inactive status indicator.
 * It is used in the report view to show which trading rules are currently active.
 *
 * @component
 * @selector app-rule-short
 * @standalone true
 */
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
