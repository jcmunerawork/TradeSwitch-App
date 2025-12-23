import { Component, Input } from '@angular/core';

/**
 * Component for displaying an edit popup overlay.
 *
 * This component provides a simple popup overlay that can be used to display
 * edit forms or content. It includes a close callback for handling dismissal.
 *
 * Features:
 * - Visibility control
 * - Close callback function
 * - Reusable popup overlay
 *
 * Usage:
 * <app-edit-popup
 *   [visible]="showEditPopup"
 *   [close]="onCloseEditPopup">
 * </app-edit-popup>
 *
 * Relations:
 * - Used by components that need edit popup overlays
 *
 * @component
 * @selector app-edit-popup
 * @standalone true
 */
@Component({
  selector: 'app-edit-popup',
  imports: [],
  templateUrl: './edit-popup.component.html',
  styleUrl: './edit-popup.component.scss',
  standalone: true,
})
export class EditPopupComponent {
  @Input() visible = false;
  @Input() close!: () => void;
}
