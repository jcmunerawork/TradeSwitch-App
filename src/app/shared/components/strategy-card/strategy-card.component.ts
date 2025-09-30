import { Component, Input, Output, EventEmitter, HostListener, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StrategyCardData } from './strategy-card.interface';
import { NumberFormatterService } from '../../utils/number-formatter.service';
import { StrategyDaysUpdaterService } from '../../services/strategy-days-updater.service';
import { interval, Subscription } from 'rxjs';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '../../../firebase/firebase.init';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'app-strategy-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './strategy-card.component.html',
  styleUrls: ['./strategy-card.component.scss']
})
export class StrategyCardComponent implements OnInit, OnDestroy {
  @Input() strategy: StrategyCardData = {
    id: '',
    name: '',
    status: false,
    lastModified: '',
    rules: 0,
    days_active: 0,
    winRate: 0,
    isFavorite: false,
    created_at: null,
    updated_at: null,
    userId: '',
    configurationId: '',
    dateActive: [],
    dateInactive: []
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

  private numberFormatter = new NumberFormatterService();
  private updateSubscription?: Subscription;
  private userId?: string;
  private db: any;

  constructor(
    private daysUpdaterService: StrategyDaysUpdaterService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.db = getFirestore(firebaseApp);
    }
  }

  ngOnInit(): void {
    this.calculateActiveRules();
    this.updateDaysActive();
  }

  ngOnDestroy(): void {
    // Limpiar suscripciones si las hay
  }

  /**
   * Actualiza los días activos de la estrategia
   */
  private async updateDaysActive(): Promise<void> {
    if (!this.strategy.id || !this.strategy.userId) {
      return;
    }

    try {
      // Calcular días activos localmente para mostrar inmediatamente
      if (this.strategy.created_at) {
        const calculatedDays = this.daysUpdaterService.getDaysActive(this.strategy.created_at);
        this.strategy.days_active = calculatedDays;
      }

      // Actualizar en Firebase
      await this.daysUpdaterService.updateStrategyDaysActive(this.strategy.id, this.strategy.userId);
    } catch (error) {
      console.error('Error al actualizar días activos:', error);
    }
  }

  onEdit() {
    this.edit.emit(this.strategy.id);
  }

  onFavorite() {
    this.favorite.emit(this.strategy.id);
  }

  onMoreOptions(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.showOptionsMenu = !this.showOptionsMenu;
    // Removed moreOptions.emit() to prevent Google alert
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
    return this.strategy.status ? 'active' : 'inactive';
  }

  getStatusText(): string {
    return this.strategy.status ? 'Active' : 'Inactive';
  }

  getWinRateWidth(): string {
    return `${this.strategy.winRate}%`;
  }

  formatPercentage(value: number): string {
    return this.numberFormatter.formatPercentage(value);
  }

  /**
   * Calcula las reglas activas desde la colección configurations
   */
  private async calculateActiveRules(): Promise<void> {
    if (!this.db || !this.strategy.configurationId) {
      return;
    }

    try {
      const configDoc = await getDoc(doc(this.db, 'configurations', this.strategy.configurationId));
      
      if (configDoc.exists()) {
        const configData = configDoc.data();
        let activeRulesCount = 0;

        // Contar reglas activas
        if (configData['maxDailyTrades']?.isActive) activeRulesCount++;
        if (configData['riskReward']?.isActive) activeRulesCount++;
        if (configData['riskPerTrade']?.isActive) activeRulesCount++;
        if (configData['daysAllowed']?.isActive) activeRulesCount++;
        if (configData['hoursAllowed']?.isActive) activeRulesCount++;
        if (configData['assetsAllowed']?.isActive) activeRulesCount++;

        this.strategy.rules = activeRulesCount;
      }
    } catch (error) {
      console.error('Error al calcular reglas activas:', error);
    }
  }
}
