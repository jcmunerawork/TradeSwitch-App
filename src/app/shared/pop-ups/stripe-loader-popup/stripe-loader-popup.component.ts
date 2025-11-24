import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Component for displaying a loading overlay during Stripe redirect.
 *
 * This component provides a full-screen loading overlay that is shown
 * when redirecting users to Stripe for payment processing. It displays
 * a loading message to inform users that they are being redirected.
 *
 * Features:
 * - Full-screen overlay
 * - Customizable loading message
 * - Visibility control
 *
 * Usage:
 * <app-stripe-loader-popup
 *   [visible]="isRedirecting"
 *   [message]="'Redirecting to Stripe...'">
 * </app-stripe-loader-popup>
 *
 * Relations:
 * - Used by PlanSettingsComponent during Stripe checkout redirect
 * - Used when opening Stripe customer portal
 *
 * @component
 * @selector app-stripe-loader-popup
 * @standalone true
 */
@Component({
  selector: 'app-stripe-loader-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stripe-loader-popup.component.html',
  styleUrl: './stripe-loader-popup.component.scss'
})
export class StripeLoaderPopupComponent {
  @Input() visible: boolean = false;
  @Input() message: string = 'Redirecting to Stripe...';
}
