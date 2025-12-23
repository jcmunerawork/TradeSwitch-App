import { Component, HostListener, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { SettingsService } from '../../service/strategy.service';
import {
  assetsAllowed,
  daysAllowed,
  selectMaxDailyTrades,
} from '../../store/strategy.selectors';
import {
  AssetsAllowedConfig,
  Days,
  DaysAllowedConfig,
  MaxDailyTradesConfig,
  RuleType,
} from '../../models/strategy.model';
import {
  setAssetsAllowedConfig,
  setDaysAllowedConfig,
  setMaxDailyTradesConfig,
} from '../../store/strategy.actions';
import { CommonModule } from '@angular/common';

/**
 * Component for configuring the assets allowed for trading rule.
 *
 * This component allows users to select which trading instruments/assets are
 * permitted for trading. It includes a searchable dropdown for selecting
 * instruments and displays selected assets as removable chips.
 *
 * Features:
 * - Toggle rule active/inactive
 * - Searchable dropdown for instrument selection
 * - Display selected assets as chips
 * - Remove asset functionality
 * - Syncs with NgRx store
 *
 * Relations:
 * - Store (NgRx): Reads and updates assetsAllowed configuration
 * - SettingsService: Strategy service (injected but not directly used)
 *
 * @component
 * @selector app-assets-allowed
 * @standalone true
 */
@Component({
  selector: 'app-assets-allowed',
  templateUrl: './assets-allowed.component.html',
  styleUrls: ['./assets-allowed.component.scss'],
  imports: [CommonModule],
  standalone: true,
})
export class AssetsAllowedComponent implements OnInit {
  config: AssetsAllowedConfig = {
    isActive: false,
    type: RuleType.ASSETS_ALLOWED,
    assetsAllowed: ['XMRUSD', 'BTCUSD'],
  };

  symbols: string[] = [];
  availableSymbolsOptions: string[] = [];
  selectedInstrument: string | undefined = undefined;
  searchTerm: string = '';

  dropdownOpen = false;

  constructor(private store: Store, private settingsService: SettingsService) {}

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
      });
  }

  private updateConfig(config: AssetsAllowedConfig) {
    this.store.dispatch(setAssetsAllowedConfig({ config }));
  }
}
