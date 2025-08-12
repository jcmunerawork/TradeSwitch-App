import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-confirm-popup',
  imports: [],
  templateUrl: './confirm-popup.component.html',
  styleUrl: './confirm-popup.component.scss',
  standalone: true,
})
export class ConfirmPopupComponent {
  @Input() visible = false;
  @Input() close!: () => void;
  @Input() cancel!: () => void;
}
