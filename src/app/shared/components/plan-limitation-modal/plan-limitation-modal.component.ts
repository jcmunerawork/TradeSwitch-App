import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export interface PlanLimitationModalData {
  showModal: boolean;
  modalType: 'upgrade' | 'blocked';
  title: string;
  message: string;
  primaryButtonText: string;
  secondaryButtonText?: string;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
}

@Component({
  selector: 'app-plan-limitation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plan-limitation-modal.component.html',
  styleUrls: ['./plan-limitation-modal.component.scss']
})
export class PlanLimitationModalComponent {
  @Input() modalData: PlanLimitationModalData = {
    showModal: false,
    modalType: 'upgrade',
    title: '',
    message: '',
    primaryButtonText: '',
    onPrimaryAction: () => {}
  };

  @Output() closeModal = new EventEmitter<void>();

  constructor(private router: Router) {}

  onCloseModal(): void {
    this.closeModal.emit();
  }

  onPrimaryAction(): void {
    this.modalData.onPrimaryAction();
    this.onCloseModal();
  }

  onSecondaryAction(): void {
    if (this.modalData.onSecondaryAction) {
      this.modalData.onSecondaryAction();
    }
    this.onCloseModal();
  }

  navigateToAccount(): void {
    this.router.navigate(['/account']);
  }

  navigateToSignup(): void {
    this.router.navigate(['/signup']);
  }
}
