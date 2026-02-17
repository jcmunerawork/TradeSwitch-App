/**
 * Report feature: short rule row (title + active/inactive indicator).
 *
 * Used in the report view to list trading rules and their status.
 */
import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * Displays a rule title and active/inactive indicator for the report rules section.
 */
@Component({
  selector: 'app-rule-short',
  templateUrl: './rule-short.component.html',
  styleUrls: ['./rule-short.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class RuleShortComponent {
  /** Rule title (e.g. "Max Daily Trades", "Risk Reward"). */
  @Input() title!: string;
  /** Whether the rule is active. */
  @Input() isActive?: any;

  constructor() {}
}
