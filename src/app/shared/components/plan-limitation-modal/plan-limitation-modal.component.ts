import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

/**
 * Interface for plan limitation modal data.
 *
 * @interface PlanLimitationModalData
 */
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

/**
 * Component for displaying plan limitation modals.
 *
 * This component displays modals when users hit plan limitations, either
 * requiring an upgrade or being blocked from a feature. It supports two
 * modal types: upgrade (suggests upgrading) and blocked (access denied).
 *
 * Features:
 * - Two modal types: upgrade and blocked
 * - Customizable title, message, and button texts
 * - Primary and secondary actions
 * - Navigation to account page or signup
 * - Close modal functionality
 *
 * Modal Types:
 * - upgrade: User has reached limit, suggests upgrading plan
 * - blocked: User is banned/cancelled, access denied
 *
 * Usage:
 * <app-plan-limitation-modal
 *   [modalData]="limitationModalData"
 *   (closeModal)="onCloseModal()">
 * </app-plan-limitation-modal>
 *
 * Relations:
 * - PlanLimitationsGuard: Generates modal data
 * - Used by components that check plan limitations
 *
 * @component
 * @selector app-plan-limitation-modal
 * @standalone true
 */
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
