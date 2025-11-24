import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { SettingsService } from '../../service/strategy.service';
import {
  hoursAllowed,
  selectMaxDailyTrades,
} from '../../store/strategy.selectors';
import {
  HoursAllowedConfig,
  MaxDailyTradesConfig,
  RuleType,
} from '../../models/strategy.model';
import {
  setHoursAllowedConfig,
  setMaxDailyTradesConfig,
} from '../../store/strategy.actions';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxMaterialTimepickerModule } from 'ngx-material-timepicker';
import * as moment from 'moment-timezone';
import { AlertService } from '../../../../shared/services/alert.service';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

/**
 * Component for configuring the trading hours allowed rule.
 *
 * This component allows users to set the time window during which trading is
 * permitted. It includes time pickers for opening and closing times, and a
 * timezone selector with all available timezones.
 *
 * Features:
 * - Toggle rule active/inactive
 * - Time pickers for opening and closing times
 * - Timezone selector with GMT offsets
 * - Validation: opening time must be before closing time
 * - Minimum 30-minute difference between times
 *
 * Relations:
 * - Store (NgRx): Reads and updates hoursAllowed configuration
 * - NgxMaterialTimepickerModule: Time picker UI
 * - AlertService: Shows validation warnings
 *
 * @component
 * @selector app-hours-allowed
 * @standalone true
 */
@Component({
  selector: 'app-hours-allowed',
  templateUrl: './hours-allowed.component.html',
  styleUrls: ['./hours-allowed.component.scss'],
  imports: [CommonModule, FormsModule, NgxMaterialTimepickerModule],
  standalone: true,
})
export class HoursAllowedComponent implements OnInit {
  config: HoursAllowedConfig = {
    isActive: false,
    tradingOpenTime: '09:30',
    tradingCloseTime: '17:00',
    timezone: 'Zulu',
    type: RuleType.TRADING_HOURS,
  };

  timezones = Array.from(
    new Map(
      moment.tz.names().map((tz) => {
        const offset = moment.tz(tz).utcOffset();
        const offsetSign = offset >= 0 ? '+' : '-';
        const absOffset = Math.abs(offset);
        const hours = Math.floor(absOffset / 60);
        const mins = absOffset % 60;

        const formattedOffset = `(GMT${offsetSign}${hours
          .toString()
          .padStart(2, '0')}:${mins.toString().padStart(2, '0')})`;

        const abbreviation = moment.tz(tz).zoneAbbr();
        const key = `${abbreviation} ${formattedOffset}`;

        return [key, { value: tz, label: key, offsetMinutes: offset }] as [
          string,
          { value: string; label: string; offsetMinutes: number }
        ];
      })
    ).values()
  )
    .sort((a, b) => a.offsetMinutes - b.offsetMinutes)
    .map(({ value, label }) => ({ value, label }));

  constructor(private store: Store, private settingsService: SettingsService, private alertService: AlertService) {}

  ngOnInit(): void {
    this.listenRuleConfiguration();
  }

  onToggleActive(event: Event) {
    const isActive = (event.target as HTMLInputElement).checked;
    const newConfig = {
      ...this.config,
      isActive: isActive,
      // Reiniciar valores cuando se desactiva
      tradingOpenTime: isActive ? this.config.tradingOpenTime : '09:30',
      tradingCloseTime: isActive ? this.config.tradingCloseTime : '17:00',
      timezone: isActive ? this.config.timezone : 'UTC',
    };
    this.updateConfig(newConfig);
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

  onTimeChange(field: 'tradingOpenTime' | 'tradingCloseTime', value: string) {
    const tempConfig = { ...this.config, [field]: value };
    const openMinutes = this.toMinutes(tempConfig.tradingOpenTime);
    const closeMinutes = this.toMinutes(tempConfig.tradingCloseTime);
    if (openMinutes >= closeMinutes) {
      this.alertService.showWarning('Opening time must be earlier than closing time.', 'Invalid Time Range');
      return;
    }
    if (closeMinutes - openMinutes < 30) {
      this.alertService.showWarning('There must be at least a 30-minute difference between opening and closing times.', 'Minimum Time Difference');
      return;
    }
    this.updateConfig(tempConfig);
  }

  listenRuleConfiguration() {
    this.store
      .select(hoursAllowed)
      .pipe()
      .subscribe((config) => {
        this.config = { ...config };
      });
  }

  private updateConfig(config: HoursAllowedConfig) {
    this.store.dispatch(setHoursAllowedConfig({ config }));
  }

  private toMinutes(time: string): number {
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
}
