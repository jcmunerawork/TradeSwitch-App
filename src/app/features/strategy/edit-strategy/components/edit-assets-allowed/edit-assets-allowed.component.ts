import { Component, HostListener, OnInit, Input, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
  private isBrowser: boolean;

  // Estado de validación
  isValid: boolean = true;
  errorMessage: string = '';

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
      console.warn('⚠️ EditAssetsAllowedComponent: No se puede abrir dropdown porque la regla no está activa');
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
    // Si no se pasaron instrumentos como input, cargarlos desde localStorage
    if (!this.availableSymbolsOptions || this.availableSymbolsOptions.length === 0) {
      this.loadInstrumentsFromLocalStorage();
    }
  }

  /**
   * Carga los instrumentos disponibles desde localStorage
   * Estos instrumentos se guardan cuando se hace login o se edita una strategy
   * Se usa como respaldo si no se pasan instrumentos como @Input
   */
  private loadInstrumentsFromLocalStorage(): void {
    if (!this.isBrowser) {
      console.warn('⚠️ EditAssetsAllowedComponent: No es navegador, no se pueden cargar instrumentos desde localStorage');
      return;
    }

    try {
      const storedInstruments = localStorage.getItem('tradeswitch_available_instruments');
      
      if (storedInstruments) {
        const instruments = JSON.parse(storedInstruments);
        if (Array.isArray(instruments) && instruments.length > 0) {
          this.availableSymbolsOptions = instruments;
        } else {
          console.warn('⚠️ EditAssetsAllowedComponent: Los instrumentos en localStorage no son un array válido o están vacíos', instruments);
        }
      } else {
        console.warn('⚠️ EditAssetsAllowedComponent: No se encontraron instrumentos en localStorage');
      }
    } catch (error) {
      console.error('❌ EditAssetsAllowedComponent: Error cargando instrumentos desde localStorage:', error);
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
