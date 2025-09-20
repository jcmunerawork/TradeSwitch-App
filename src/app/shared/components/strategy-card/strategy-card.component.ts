import { Component, Input, Output, EventEmitter } from '@angular/core';
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

  onEdit() {
    this.edit.emit(this.strategy.id);
  }

  onFavorite() {
    this.favorite.emit(this.strategy.id);
  }

  onMoreOptions() {
    this.moreOptions.emit(this.strategy.id);
  }

  onCustomize() {
    this.customize.emit(this.strategy.id);
  }

  getStatusClass(): string {
    return this.strategy.status.toLowerCase();
  }

  getWinRateWidth(): string {
    return `${this.strategy.winRate}%`;
  }
}
