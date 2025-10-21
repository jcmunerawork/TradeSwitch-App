import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alert-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-popup.component.html',
  styleUrl: './alert-popup.component.scss'
})
export class AlertPopupComponent {
  @Input() visible: boolean = false;
  @Input() title: string = 'Alert';
  @Input() message: string = '';
  @Input() buttonText: string = 'OK';
  @Input() type: 'info' | 'warning' | 'error' | 'success' = 'info';
  
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  onConfirm(): void {
    this.confirm.emit();
    this.close.emit();
  }
}
