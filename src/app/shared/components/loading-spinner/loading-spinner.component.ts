import { Component, Input } from '@angular/core';

/**
 * Component for displaying a loading spinner with customizable title and description.
 *
 * This component provides a reusable loading indicator that can be used throughout
 * the application to show that data is being loaded or an operation is in progress.
 *
 * Features:
 * - Customizable title and description text
 * - Reusable across the application
 * - Standalone component (no module dependencies)
 *
 * Relations:
 * - Used by various components to show loading states
 *
 * @component
 * @selector app-loading-spinner
 * @standalone true
 */
@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [],
  templateUrl: './loading-spinner.component.html',
  styleUrl: './loading-spinner.component.scss'
})
export class LoadingSpinnerComponent {
  @Input() title: string = 'Loading...';
  @Input() description: string = 'Please wait while we load your data.';
}
