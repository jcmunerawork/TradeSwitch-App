import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

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
