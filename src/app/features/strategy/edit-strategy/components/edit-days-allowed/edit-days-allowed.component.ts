import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { SettingsService } from '../../../service/strategy.service';
import {
  daysAllowed,
  selectMaxDailyTrades,
} from '../../../store/strategy.selectors';
import {
  Days,
  DaysAllowedConfig,
  MaxDailyTradesConfig,
  RuleType,
} from '../../../models/strategy.model';
import {
  setDaysAllowedConfig,
  setMaxDailyTradesConfig,
} from '../../../store/strategy.actions';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-edit-days-allowed',
  templateUrl: './edit-days-allowed.component.html',
  styleUrls: ['./edit-days-allowed.component.scss'],
  imports: [CommonModule],
  standalone: true,
})
export class EditDaysAllowedComponent implements OnInit {
  config: DaysAllowedConfig = {
    isActive: false,
    type: RuleType.DAYS_ALLOWED,
    tradingDays: [],
  };

  daysButtons = [
    { day: Days.MONDAY, isActive: false },
    { day: Days.TUESDAY, isActive: false },
    { day: Days.WEDNESDAY, isActive: false },
    { day: Days.THURSDAY, isActive: false },
    { day: Days.FRIDAY, isActive: false },
    { day: Days.SATURDAY, isActive: false },
    { day: Days.SUNDAY, isActive: false },
  ];

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
      // Reiniciar días cuando se desactiva
      tradingDays: isActive ? this.config.tradingDays : [],
    };
    
    // Reiniciar botones de días
    if (!isActive) {
      this.daysButtons.forEach(day => {
        day.isActive = false;
      });
    }
    
    this.updateConfig(newConfig);
  }

  onChangeValue(day: { day: Days; isActive: boolean }) {
    if (this.config.isActive) {
      this.daysButtons.forEach((d) => {
        if (d.day === day.day) {
          d.isActive = !d.isActive;
        }
      });

      const newConfig: DaysAllowedConfig = {
        ...this.config,
        tradingDays: this.transformDaysActive(),
      };
      this.updateConfig(newConfig);
    }
  }

  transformDaysActive(): string[] {
    let daysArr: string[] = [];

    this.daysButtons.forEach((d) => {
      if (d.isActive) {
        daysArr.push(d.day);
      }
    });

    return daysArr;
  }

  listenRuleConfiguration() {
    this.store
      .select(daysAllowed)
      .pipe()
      .subscribe((config) => {
        this.config = config;
        this.daysButtons.forEach((dayOption) => {
          const findedDay = config.tradingDays.find((d) => d === dayOption.day);
          if (findedDay) {
            dayOption.isActive = true;
          }
        });
        
        // Validar la configuración después de actualizarla
        this.validateConfig(this.config);
      });
  }

  private updateConfig(config: DaysAllowedConfig) {
    this.store.dispatch(setDaysAllowedConfig({ config }));
    this.validateConfig(config);
  }

  private validateConfig(config: DaysAllowedConfig) {
    if (!config.isActive) {
      this.isValid = true;
      this.errorMessage = '';
      return;
    }

    if (!config.tradingDays || config.tradingDays.length === 0) {
      this.isValid = false;
      this.errorMessage = 'You must select at least one day';
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
