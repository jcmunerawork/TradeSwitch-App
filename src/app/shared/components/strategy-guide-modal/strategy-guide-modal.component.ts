import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Component for displaying a strategy creation guide modal.
 *
 * This component provides a step-by-step guide for new users on how to
 * create and manage trading strategies. It includes three steps with
 * images and descriptions, and allows users to skip the guide in the future.
 *
 * Features:
 * - Three-step guide (Create, Select, Edit)
 * - Step navigation (next/previous)
 * - Image and description for each step
 * - "Don't show again" option
 * - Direct navigation to strategy editing
 * - Close modal functionality
 *
 * Guide Steps:
 * 1. Create a strategy: Design trading plan with custom rules
 * 2. Select strategy: Pick strategy for each account
 * 3. Edit a strategy: Fine-tune rules anytime
 *
 * Usage:
 * Shown to first-time users when they access the strategy page.
 * Users can opt to not see it again.
 *
 * Relations:
 * - Used by StrategyComponent for first-time user guidance
 *
 * @component
 * @selector app-strategy-guide-modal
 * @standalone true
 */
@Component({
  selector: 'app-strategy-guide-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './strategy-guide-modal.component.html',
  styleUrl: './strategy-guide-modal.component.scss'
})
export class StrategyGuideModalComponent {
  @Output() closeModal = new EventEmitter<void>();
  @Output() dontShowAgain = new EventEmitter<void>();
  @Output() editStrategy = new EventEmitter<void>();

  currentStep = 0;
  totalSteps = 3;

  steps = [
    {
      title: 'Create a strategy',
      description: 'Design your trading plan and set personalized rules that fit you.',
      image: 'assets/images/strategy/Create.webp',
      content: 'Create your own trading strategy with custom rules and parameters.'
    },
    {
      title: 'Select strategy',
      description: 'Pick the perfect strategy for each account with ease.',
      image: 'assets/images/strategy/Select.webp',
      content: 'Choose from your created strategies and apply them to your trading accounts.'
    },
    {
      title: 'Edit a strategy',
      description: 'Fine tune rules anytime to activate or disable specific ones.',
      image: 'assets/images/strategy/Edit.webp',
      content: 'Modify your strategies, adjust parameters, and optimize your trading rules.'
    }
  ];

  onNext(): void {
    if (this.currentStep < this.totalSteps - 1) {
      this.currentStep++;
    } else {
      // En el último paso, emitir evento para editar estrategia
      this.editStrategy.emit();
    }
  }

  onPrevious(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }

  onDontShowAgain(): void {
    this.dontShowAgain.emit();
  }

  getCurrentStep() {
    return this.steps[this.currentStep];
  }

  getButtonText(): string {
    return this.currentStep === this.totalSteps - 1 ? 'Edit strategy' : 'Next';
  }
}
