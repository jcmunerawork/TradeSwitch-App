import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StrategyCardData } from './strategy-card.interface';

@Component({
  selector: 'app-strategy-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './strategy-card.component.html',
  styleUrls: ['./strategy-card.component.scss']
})
export class StrategyCardComponent {
  @Input() strategy: StrategyCardData = {
    id: '',
    name: '',
    status: 'Inactive',
    lastModified: '',
    rules: 0,
    timesApplied: 0,
    winRate: 0,
    isFavorite: false
  };

  @Input() showCustomizeButton: boolean = true;
  @Input() customizeButtonText: string = 'Customize strategy';

  @Output() edit = new EventEmitter<string>();
  @Output() favorite = new EventEmitter<string>();
  @Output() moreOptions = new EventEmitter<string>();
  @Output() customize = new EventEmitter<string>();
  @Output() duplicate = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();

  showOptionsMenu = false;

  onEdit() {
    this.edit.emit(this.strategy.id);
  }

  onFavorite() {
    this.favorite.emit(this.strategy.id);
  }

  onMoreOptions(event: Event) {
    event.stopPropagation();
    this.showOptionsMenu = !this.showOptionsMenu;
    this.moreOptions.emit(this.strategy.id);
  }

  onCustomize() {
    this.customize.emit(this.strategy.id);
  }

  onDuplicate() {
    this.showOptionsMenu = false;
    this.duplicate.emit(this.strategy.id);
  }

  onDelete() {
    this.showOptionsMenu = false;
    this.delete.emit(this.strategy.id);
  }

  onCloseOptionsMenu() {
    this.showOptionsMenu = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    // Solo cerrar si el click no es en el botón de more options o en el menú
    const target = event.target as HTMLElement;
    const moreBtn = target.closest('.more-btn');
    const optionsMenu = target.closest('.options-menu');
    
    if (this.showOptionsMenu && !moreBtn && !optionsMenu) {
      this.showOptionsMenu = false;
    }
  }

  getStatusClass(): string {
    return this.strategy.status.toLowerCase();
  }

  getWinRateWidth(): string {
    return `${this.strategy.winRate}%`;
  }
}
