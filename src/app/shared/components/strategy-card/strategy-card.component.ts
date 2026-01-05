import { Component, Input, Output, EventEmitter, HostListener, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StrategyCardData } from './strategy-card.interface';
import { NumberFormatterService } from '../../utils/number-formatter.service';
import { StrategyDaysUpdaterService } from '../../services/strategy-days-updater.service';
import { interval, Subscription } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { BackendApiService } from '../../../core/services/backend-api.service';
import { getAuth } from 'firebase/auth';

/**
 * Component for displaying a strategy card with details and actions.
 *
 * This component displays a single strategy in card format with its
 * status, statistics, and action buttons. It supports inline name editing,
 * favorite toggling, and various strategy operations.
 *
 * Features:
 * - Display strategy information (name, status, rules, days active, win rate)
 * - Inline name editing with Firebase sync
 * - Favorite toggle
 * - More options menu (edit, duplicate, delete)
 * - Customize button
 * - Active rules calculation from Firebase
 * - Days active calculation and update
 * - Status indicators (active/inactive)
 * - Win rate visualization
 *
 * Strategy Information:
 * - Name: Editable inline
 * - Status: Active/Inactive indicator
 * - Rules: Count of active rules
 * - Days Active: Calculated from creation date
 * - Win Rate: Percentage display
 * - Favorite: Star indicator
 *
 * Actions:
 * - Edit: Opens strategy editor
 * - Favorite: Toggles favorite status
 * - More Options: Shows menu (edit, duplicate, delete)
 * - Customize: Opens customization
 *
 * Relations:
 * - StrategyDaysUpdaterService: Updates days active
 * - NumberFormatterService: Formats win rate percentage
 * - Used by StrategyComponent for strategy list display
 *
 * @component
 * @selector app-strategy-card
 * @standalone true
 */
@Component({
  selector: 'app-strategy-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  @Output() editStrategy = new EventEmitter<string>();
  @Output() duplicate = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();
  @Output() nameChanged = new EventEmitter<{id: string, newName: string}>();

  showOptionsMenu = false;
  isEditingName = false;
  editingStrategyName = '';
  isSavingName = false;

  private numberFormatter = new NumberFormatterService();
  private updateSubscription?: Subscription;
  private userId?: string;

  constructor(
    private daysUpdaterService: StrategyDaysUpdaterService,
    private backendApi: BackendApiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /**
   * Get Firebase ID token for backend API calls
   */
  private async getIdToken(): Promise<string> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return await currentUser.getIdToken();
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
      console.error('Error updating days active:', error);
    }
  }

  onEdit() {
    this.startEditName();
  }

  startEditName() {
    this.isEditingName = true;
    this.editingStrategyName = this.strategy.name;
    // Focus en el input después de que se renderice
    setTimeout(() => {
      const input = document.querySelector('.strategy-name-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  async saveStrategyName() {
    if (this.editingStrategyName.trim() && this.editingStrategyName.trim() !== this.strategy.name) {
      const newName = this.editingStrategyName.trim();
      this.isSavingName = true;
      
      try {
        // Actualizar en Firebase
        await this.updateStrategyNameInFirebase(newName);
        
        // Actualizar el nombre localmente
        this.strategy.name = newName;
        
        // Emitir evento para notificar al componente padre
        this.nameChanged.emit({
          id: this.strategy.id,
          newName: newName
        });
      } catch (error) {
        // No actualizamos el nombre local si falla en Firebase
        console.error('Error updating the name of the strategy:', error);
      } finally {
        this.isSavingName = false;
      }
    }
    
    this.isEditingName = false;
    this.editingStrategyName = '';
  }

  cancelEditName() {
    this.isEditingName = false;
    this.editingStrategyName = '';
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

  onEditStrategy() {
    this.editStrategy.emit(this.strategy.id);
  }

  onDuplicate() {
    this.showOptionsMenu = false;
    this.duplicate.emit(this.strategy.id);
  }

  onDelete() {
    this.showOptionsMenu = false;
    // Debug: Verificar que el ID existe antes de emitir
    if (!this.strategy.id || this.strategy.id.trim() === '') {
      console.error('❌ StrategyCard: Cannot delete - strategy.id is empty', {
        strategy: this.strategy,
        hasId: !!this.strategy.id,
        idValue: this.strategy.id
      });
      return;
    }
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
   * Actualiza el nombre de la estrategia usando el backend API
   */
  private async updateStrategyNameInFirebase(newName: string): Promise<void> {
    if (!this.strategy.id) {
      throw new Error('Cannot update: missing strategy ID');
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.updateConfigurationOverview(
        this.strategy.id,
        { name: newName },
        idToken
      );
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update strategy name');
      }
    } catch (error) {
      console.error('Error updating the name:', error);
      throw error;
    }
  }

  /**
   * Calcula las reglas activas desde el backend API
   */
  private async calculateActiveRules(): Promise<void> {
    if (!this.strategy.configurationId) {
      return;
    }

    try {
      const idToken = await this.getIdToken();
      const response = await this.backendApi.getConfigurationById(
        this.strategy.configurationId,
        idToken
      );
      
      if (response.success && response.data?.configuration) {
        const configData = response.data.configuration;
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
      console.error('Error calculating active rules:', error);
    }
  }
}
