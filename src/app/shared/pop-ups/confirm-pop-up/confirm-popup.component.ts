import { Component, Input } from '@angular/core';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-popup',
  imports: [CommonModule],
  templateUrl: './confirm-popup.component.html',
  styleUrl: './confirm-popup.component.scss',
  standalone: true,
})
export class ConfirmPopupComponent {
  @Input() visible = false;
  @Input() close!: () => void;
  @Input() cancel!: () => void;
  @Input() title: string = 'Confirm changes to your strategy?';
  @Input() message: string = 'These updates will modify how your trading rules are applied.';
  @Input() confirmButtonText: string = 'Apply changes';
  @Input() cancelButtonText: string = 'Cancel';
  @Input() isDangerous: boolean = false; // Para acciones destructivas (eliminar, etc.)
}
