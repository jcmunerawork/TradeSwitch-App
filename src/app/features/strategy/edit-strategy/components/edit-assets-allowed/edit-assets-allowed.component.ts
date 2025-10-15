import { Component, HostListener, OnInit, Input } from '@angular/core';
import { Store } from '@ngrx/store';
import { SettingsService } from '../../../service/strategy.service';
import {
  assetsAllowed,
  daysAllowed,
  selectMaxDailyTrades,
} from '../../../store/strategy.selectors';
import {
  AssetsAllowedConfig,
  Days,
  DaysAllowedConfig,
  MaxDailyTradesConfig,
  RuleType,
} from '../../../models/strategy.model';
import {
  setAssetsAllowedConfig,
  setDaysAllowedConfig,
  setMaxDailyTradesConfig,
} from '../../../store/strategy.actions';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-edit-assets-allowed',
  templateUrl: './edit-assets-allowed.component.html',
  styleUrls: ['./edit-assets-allowed.component.scss'],
  imports: [CommonModule],
  standalone: true,
})
export class EditAssetsAllowedComponent implements OnInit {
  @Input() availableSymbolsOptions: string[] = [];

  config: AssetsAllowedConfig = {
    isActive: false,
    type: RuleType.ASSETS_ALLOWED,
    assetsAllowed: ['XMRUSD', 'BTCUSD'],
  };

  symbols: string[] = [];
  selectedInstrument: string | undefined = undefined;
  searchTerm: string = '';

  dropdownOpen = false;

  // Estado de validación
  isValid: boolean = true;
  errorMessage: string = '';

  constructor(
    private store: Store, 
    private settingsService: SettingsService
  ) {}

  closeDropdown() {
    this.dropdownOpen = false;
  }

  toggleDropdown() {
    if (this.config.isActive) {
      this.dropdownOpen = !this.dropdownOpen;
    } else {
      this.dropdownOpen = false;
    }
  }

  onSearchInput(event: Event) {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.dropdownOpen = true;
  }

  onSearchFocus() {
    if (this.config.isActive) {
      this.dropdownOpen = true;
    }
  }

  onSearchBlur() {
    // Delay para permitir click en dropdown
    setTimeout(() => {
      this.dropdownOpen = false;
    }, 200);
  }

  selectInstrument(intrument: string) {
    this.selectedInstrument = intrument;
    this.addSymbol(intrument);
    this.dropdownOpen = false;
    this.selectedInstrument = undefined;
    this.searchTerm = ''; // Limpiar búsqueda
  }

  getFilteredSymbols(): string[] {
    if (!this.searchTerm) {
      return this.availableSymbolsOptions;
    }
    return this.availableSymbolsOptions.filter(symbol => 
      symbol.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  ngOnInit(): void {
    this.listenRuleConfiguration();
  }

  addSymbol(symbol: string) {
    if (symbol && !this.symbols.includes(symbol)) {
      this.symbols = [...this.symbols, symbol];
    }
    this.updateConfig({
      ...this.config,
      assetsAllowed: this.symbols,
    });
  }

  removeSymbol(symbol: string) {
    if (this.config.isActive) {
      this.symbols = this.symbols.filter((s) => s !== symbol);
      this.updateConfig({
        ...this.config,
        assetsAllowed: this.symbols,
      });
    }
  }

  onToggleActive(event: Event) {
    const isActive = (event.target as HTMLInputElement).checked;
    const newConfig = {
      ...this.config,
      isActive: isActive,
      // Reiniciar assets cuando se desactiva
      assetsAllowed: isActive ? this.config.assetsAllowed : [],
    };
    
    // Reiniciar símbolos seleccionados
    if (!isActive) {
      this.symbols = [];
    }
    
    this.updateConfig(newConfig);
  }

  listenRuleConfiguration() {
    this.store
      .select(assetsAllowed)
      .pipe()
      .subscribe((config) => {
        this.config = { ...config };
        this.symbols = this.config.assetsAllowed;
        
        // Validar la configuración después de actualizarla
        this.validateConfig(this.config);
      });
  }

  private updateConfig(config: AssetsAllowedConfig) {
    this.store.dispatch(setAssetsAllowedConfig({ config }));
    this.validateConfig(config);
  }

  private validateConfig(config: AssetsAllowedConfig) {
    
    if (!config.isActive) {
      this.isValid = true;
      this.errorMessage = '';
      return;
    }

    if (!config.assetsAllowed || config.assetsAllowed.length === 0) {
      this.isValid = false;
      this.errorMessage = 'You must select at least one asset';
    } else {
      this.isValid = true;
      this.errorMessage = '';
    }
  }

  // Método público para verificar si la regla es válida
  public isRuleValid(): boolean {
    return this.isValid;
  }

  // Método público para obtener el mensaje de error
  public getErrorMessage(): string {
    return this.errorMessage;
  }

}
