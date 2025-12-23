import { Component, Input } from '@angular/core';

import { CommonModule } from '@angular/common';

/**
 * Component for displaying confirmation dialogs.
 *
 * This component provides a reusable confirmation dialog for actions that
 * require user confirmation. It supports both regular and dangerous actions
 * with customizable messages and button texts.
 *
 * Features:
 * - Customizable title and message
 * - Customizable confirm and cancel button texts
 * - Dangerous action styling (for destructive actions)
 * - Close and cancel callbacks
 * - Visibility control
 *
 * Usage:
 * <app-confirm-popup
 *   [visible]="showConfirm"
 *   [title]="'Confirm Action'"
 *   [message]="'Are you sure?'"
 *   [confirmButtonText]="'Confirm'"
 *   [cancelButtonText]="'Cancel'"
 *   [isDangerous]="false"
 *   [close]="onClose"
 *   [cancel]="onCancel">
 * </app-confirm-popup>
 *
 * Relations:
 * - Used by components that require user confirmation before actions
 *
 * @component
 * @selector app-confirm-popup
 * @standalone true
 */
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
