import { Component, HostListener, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
  private isBrowser: boolean;

  constructor(
    private store: Store, 
    private settingsService: SettingsService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

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
    
    if (this.config.isActive) {
      this.dropdownOpen = true;
    }
  }

  onSearchFocus() {
    if (this.config.isActive) {
      this.dropdownOpen = true;
    } else {
      console.warn('⚠️ AssetsAllowedComponent: No se puede abrir dropdown porque la regla no está activa');
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
    const filtered = !this.searchTerm
      ? this.availableSymbolsOptions
      : this.availableSymbolsOptions.filter(symbol => 
          symbol.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
    
    return filtered;
  }

  ngOnInit(): void {
    this.listenRuleConfiguration();
    this.loadInstrumentsFromLocalStorage();
  }

  /**
   * Carga los instrumentos disponibles desde localStorage
   * Estos instrumentos se guardan cuando se hace login o se edita una strategy
   */
  private loadInstrumentsFromLocalStorage(): void {
    if (!this.isBrowser) {
      console.warn('⚠️ AssetsAllowedComponent: No es navegador, no se pueden cargar instrumentos desde localStorage');
      return;
    }

    try {
      const storedInstruments = localStorage.getItem('tradeswitch_available_instruments');
      
      if (storedInstruments) {
        const instruments = JSON.parse(storedInstruments);
        if (Array.isArray(instruments) && instruments.length > 0) {
          this.availableSymbolsOptions = instruments;
        } else {
          console.warn('⚠️ AssetsAllowedComponent: Los instrumentos en localStorage no son un array válido o están vacíos', instruments);
        }
      } else {
        console.warn('⚠️ AssetsAllowedComponent: No se encontraron instrumentos en localStorage');
      }
    } catch (error) {
      console.error('❌ AssetsAllowedComponent: Error cargando instrumentos desde localStorage:', error);
    }
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
