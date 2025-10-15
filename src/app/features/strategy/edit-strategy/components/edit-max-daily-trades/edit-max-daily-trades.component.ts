import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { SettingsService } from '../../../service/strategy.service';
import { selectMaxDailyTrades } from '../../../store/strategy.selectors';
import { MaxDailyTradesConfig, RuleType } from '../../../models/strategy.model';
import { setMaxDailyTradesConfig } from '../../../store/strategy.actions';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-edit-max-daily-trades',
  templateUrl: './edit-max-daily-trades.component.html',
  styleUrls: ['./edit-max-daily-trades.component.scss'],
  imports: [CommonModule],
  standalone: true,
})
export class EditMaxDailyTradesComponent implements OnInit {
  config: MaxDailyTradesConfig = {
    isActive: false,
    maxDailyTrades: 0, // Cambiar el valor por defecto a 0
    type: RuleType.MAX_DAILY_TRADES,
  };

  // Estado de validación
  isValid: boolean = true;
  errorMessage: string = '';

  constructor(private store: Store, private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.listenRuleConfiguration();
  }
  
  onToggleActive(event: Event) {
    const isActive = (event.target as HTMLInputElement).checked;
    const newConfig = {
      ...this.config,
      isActive: isActive,
      // Resetear a 0 cuando se desactiva
      maxDailyTrades: isActive ? this.config.maxDailyTrades : 0,
    };
    this.updateConfig(newConfig);
  }

  onChangeValue(event: Event) {
    const numValue = Number((event.target as HTMLInputElement).value);
    const newConfig: MaxDailyTradesConfig = {
      ...this.config,
      maxDailyTrades: numValue < 1 ? 1 : numValue,
    };
    this.updateConfig(newConfig);
  }

  // Métodos para spinner (solo incrementar/decrementar)
  incrementValue() {
    if (this.config.isActive) {
      const newConfig: MaxDailyTradesConfig = {
        ...this.config,
        maxDailyTrades: this.config.maxDailyTrades + 1,
      };
      this.updateConfig(newConfig);
    }
  }

  decrementValue() {
    if (this.config.isActive && this.config.maxDailyTrades > 0) {
      const newConfig: MaxDailyTradesConfig = {
        ...this.config,
        maxDailyTrades: this.config.maxDailyTrades - 1,
      };
      this.updateConfig(newConfig);
    }
  }

  listenRuleConfiguration() {
    this.store
      .select(selectMaxDailyTrades)
      .pipe()
      .subscribe((config) => {
        // Si la configuración no está activa, usar valor 0 para mostrar placeholder
        if (!config.isActive) {
          this.config = {
            ...config,
            maxDailyTrades: 0
          };
        } else {
          this.config = config;
        }
        
        // Validar la configuración después de actualizarla
        this.validateConfig(this.config);
      });
  }

  private updateConfig(config: MaxDailyTradesConfig) {
    this.store.dispatch(setMaxDailyTradesConfig({ config }));
    this.validateConfig(config);
  }

  private validateConfig(config: MaxDailyTradesConfig) {
    if (!config.isActive) {
      this.isValid = true;
      this.errorMessage = '';
      return;
    }

    if (config.maxDailyTrades <= 0) {
      this.isValid = false;
      this.errorMessage = 'You must have at least one trade per day';
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
