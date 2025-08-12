import { Component, Input } from '@angular/core';

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
