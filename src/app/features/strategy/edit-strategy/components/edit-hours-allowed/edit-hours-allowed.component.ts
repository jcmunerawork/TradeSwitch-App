import { Component, Input, OnInit } from '@angular/core';
import { AlertService } from '../../../../../core/services';
import { Store } from '@ngrx/store';
import { SettingsService } from '../../../service/strategy.service';
import {
  hoursAllowed,
  selectMaxDailyTrades,
} from '../../../store/strategy.selectors';
import {
  HoursAllowedConfig,
  MaxDailyTradesConfig,
  RuleType,
} from '../../../models/strategy.model';
import {
  setHoursAllowedConfig,
  setMaxDailyTradesConfig,
} from '../../../store/strategy.actions';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as moment from 'moment-timezone';
import { ScrollTimePickerComponent } from '../scroll-time-picker/scroll-time-picker.component';

@Component({
  selector: 'app-edit-hours-allowed',
  templateUrl: './edit-hours-allowed.component.html',
  styleUrls: ['./edit-hours-allowed.component.scss'],
  imports: [CommonModule, FormsModule, ScrollTimePickerComponent],
  standalone: true,
})
export class EditHoursAllowedComponent implements OnInit {
  /** Cuando es true, el timezone por defecto es el del computador al activar la regla. */
  @Input() isMyChoices = false;

  config: HoursAllowedConfig = {
    isActive: false,
    tradingOpenTime: '', // Inicialmente vacío para mostrar el placeholder
    tradingCloseTime: '', // Inicialmente vacío para mostrar el placeholder
    timezone: '', // Inicialmente vacío para mostrar el placeholder
    type: RuleType.TRADING_HOURS,
  };

  // Placeholder opcional para el select de timezone
  timezonePlaceholder: string = 'Select a timezone';
  timezoneInfoTooltip = 'This timezone is where you make your trades (e.g. market/exchange), not your physical location.';
  
  // Estado de validación
  isValid: boolean = true;
  errorMessage: string = '';
  /** Error cuando la hora final es menor o igual a la inicial (se muestra debajo de los inputs). */
  timeRangeError = '';
  showTimezoneTooltip = false;
  private _defaultTimezoneSet = false;

  timezones = [
    { value: 'Pacific/Auckland', label: 'Auckland (GMT+12:00)' },
    { value: 'Australia/Sydney', label: 'Sydney (GMT+10:00)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (GMT+10:00)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (GMT+09:00)' },
    { value: 'Asia/Seoul', label: 'Seoul (GMT+09:00)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (GMT+08:00)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (GMT+08:00)' },
    { value: 'Asia/Singapore', label: 'Singapore (GMT+08:00)' },
    { value: 'Asia/Manila', label: 'Manila (GMT+08:00)' },
    { value: 'Asia/Bangkok', label: 'Bangkok (GMT+07:00)' },
    { value: 'Asia/Jakarta', label: 'Jakarta (GMT+07:00)' },
    { value: 'Asia/Kolkata', label: 'Mumbai (GMT+05:30)' },
    { value: 'Asia/Dubai', label: 'Dubai (GMT+04:00)' },
    { value: 'Europe/Moscow', label: 'Moscow (GMT+03:00)' },
    { value: 'Africa/Cairo', label: 'Cairo (GMT+02:00)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (GMT+02:00)' },
    { value: 'Europe/Paris', label: 'Paris (GMT+01:00)' },
    { value: 'Europe/Berlin', label: 'Berlin (GMT+01:00)' },
    { value: 'Europe/Madrid', label: 'Madrid (GMT+01:00)' },
    { value: 'Europe/Rome', label: 'Rome (GMT+01:00)' },
    { value: 'UTC', label: 'UTC (GMT+00:00)' },
    { value: 'Europe/London', label: 'London (GMT+00:00)' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-03:00)' },
    { value: 'America/New_York', label: 'New York (GMT-05:00)' },
    { value: 'America/Toronto', label: 'Toronto (GMT-05:00)' },
    { value: 'America/Chicago', label: 'Chicago (GMT-06:00)' },
    { value: 'America/Mexico_City', label: 'Mexico City (GMT-06:00)' },
    { value: 'America/Denver', label: 'Denver (GMT-07:00)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-08:00)' },
    { value: 'America/Vancouver', label: 'Vancouver (GMT-08:00)' }
  ];

  constructor(private store: Store, private settingsService: SettingsService, private alertService: AlertService) {}

  ngOnInit(): void {
    if (this.isMyChoices) {
      this.ensureBrowserTimezoneInList();
    }
    this.listenRuleConfiguration();
  }

  private ensureBrowserTimezoneInList(): void {
    const tz = this.getBrowserTimezone();
    if (tz && !this.timezones.some(t => t.value === tz)) {
      const offset = moment.tz(tz).format('Z');
      const label = `${tz} (GMT${offset})`;
      this.timezones = [{ value: tz, label }, ...this.timezones];
    }
  }

  onToggleActive(event: Event) {
    const isActive = (event.target as HTMLInputElement).checked;
    let timezone = isActive ? this.config.timezone : '';
    if (isActive && this.isMyChoices && (!timezone || timezone.trim() === '')) {
      timezone = this.getBrowserTimezone();
    }
    const newConfig = {
      ...this.config,
      isActive: isActive,
      tradingOpenTime: isActive ? this.config.tradingOpenTime : '',
      tradingCloseTime: isActive ? this.config.tradingCloseTime : '',
      timezone,
    };
    this.updateConfig(newConfig);
  }

  /** Zona horaria del navegador (ej. America/New_York). */
  private getBrowserTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || moment.tz.guess() || 'UTC';
    } catch {
      return 'UTC';
    }
  }
  onTimezoneChange(newTz: string) {
    // Validar que la timezone sea válida
    if (this.isValidTimezone(newTz)) {
      const newConfig = { ...this.config, timezone: newTz };
      this.updateConfig(newConfig);
    } else {
      console.warn('Invalid timezone selected:', newTz);
    }
  }

  isValidTimezone(timezone: string): boolean {
    return this.timezones.some(tz => tz.value === timezone);
  }

  getTimezoneWithCountry(timezone: string): string {
    // Find timezone in list to get full label
    const timezoneObj = this.timezones.find(tz => tz.value === timezone);
    return timezoneObj ? timezoneObj.label : timezone;
  }

  onTimeChange(field: 'tradingOpenTime' | 'tradingCloseTime', value: string) {
    const tempConfig = { ...this.config, [field]: value };

    if (tempConfig.tradingOpenTime && tempConfig.tradingCloseTime) {
      const openMinutes = this.toMinutes(tempConfig.tradingOpenTime);
      const closeMinutes = this.toMinutes(tempConfig.tradingCloseTime);

      if (openMinutes >= closeMinutes || closeMinutes - openMinutes < 30) {
        this.timeRangeError = 'End time must be at least 30 minutes after start time.';
        const correctedClose = this.fromMinutes(openMinutes + 30);
        this.updateConfig({ ...tempConfig, tradingCloseTime: correctedClose });
        return;
      }
    }

    this.timeRangeError = '';
    this.updateConfig(tempConfig);
  }

  listenRuleConfiguration() {
    this.store
      .select(hoursAllowed)
      .pipe()
      .subscribe((config) => {
        if (!config.isActive) {
          this._defaultTimezoneSet = false;
          this.timeRangeError = '';
          this.config = {
            ...config,
            tradingOpenTime: '',
            tradingCloseTime: '',
            timezone: ''
          };
        } else {
          this.config = { ...config };
          if (this.isMyChoices && (!this.config.timezone || this.config.timezone.trim() === '') && !this._defaultTimezoneSet) {
            this._defaultTimezoneSet = true;
            this.updateConfig({ ...this.config, timezone: this.getBrowserTimezone() });
            return;
          }
        }
        this.validateConfig(this.config);
      });
  }

  private updateConfig(config: HoursAllowedConfig) {
    this.store.dispatch(setHoursAllowedConfig({ config }));
    this.validateConfig(config);
  }

  private validateConfig(config: HoursAllowedConfig) {
    
    if (!config.isActive) {
      this.isValid = true;
      this.errorMessage = '';
      return;
    }

    const missingFields = [];
    
    if (!config.tradingOpenTime || config.tradingOpenTime.trim() === '') {
      missingFields.push('start time');
    }
    
    if (!config.tradingCloseTime || config.tradingCloseTime.trim() === '') {
      missingFields.push('end time');
    }
    
    if (!config.timezone || config.timezone.trim() === '') {
      missingFields.push('timezone');
    }

    if (missingFields.length > 0) {
      this.isValid = false;
      this.errorMessage = `Please fill in the following fields: ${missingFields.join(', ')}`;
    } else {
      this.isValid = true;
      this.errorMessage = '';
    }
  }

  private toMinutes(time: string): number {
    if (!time || time.trim() === '') {
      return 0;
    }

    const is12hFormat =
      time.toUpperCase().includes('AM') || time.toUpperCase().includes('PM');

    let hours: number;
    let minutes: number;

    if (is12hFormat) {
      const [timePart, period] = time.split(' ');
      [hours, minutes] = timePart.split(':').map(Number);
      if (period.toUpperCase() === 'PM' && hours !== 12) {
        hours += 12;
      }
      if (period.toUpperCase() === 'AM' && hours === 12) {
        hours = 0;
      }
    } else {
      [hours, minutes] = time.split(':').map(Number);
    }

    return hours * 60 + minutes;
  }

  /** Convierte minutos desde medianoche a formato "h:mm AM/PM". */
  private fromMinutes(totalMinutes: number): string {
    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    const hours24 = Math.floor(normalized / 60);
    const mins = normalized % 60;
    const isPm = hours24 >= 12;
    const h12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
    return `${h12}:${mins.toString().padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;
  }

  // Public method to check if the rule is valid
  public isRuleValid(): boolean {
    return this.isValid;
  }

  // Public method to get the error message
  public getErrorMessage(): string {
    return this.errorMessage;
  }
}
