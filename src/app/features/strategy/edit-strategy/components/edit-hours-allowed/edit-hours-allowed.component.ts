import { Component, OnInit } from '@angular/core';
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
import { NgxMaterialTimepickerModule } from 'ngx-material-timepicker';
import * as moment from 'moment-timezone';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

@Component({
  selector: 'app-edit-hours-allowed',
  templateUrl: './edit-hours-allowed.component.html',
  styleUrls: ['./edit-hours-allowed.component.scss'],
  imports: [CommonModule, FormsModule, NgxMaterialTimepickerModule],
  standalone: true,
})
export class EditHoursAllowedComponent implements OnInit {
  config: HoursAllowedConfig = {
    isActive: false,
    tradingOpenTime: '09:30',
    tradingCloseTime: '17:00',
    timezone: 'UTC',
    type: RuleType.TRADING_HOURS,
  };

  timezones = Array.from(
    new Map(
      moment.tz.names()
        .map((tz) => {
          try {
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
          } catch (error) {
            console.warn('Error processing timezone:', tz, error);
            return null;
          }
        })
        .filter((item): item is [string, { value: string; label: string; offsetMinutes: number }] => item !== null)
    ).values()
  )
    .sort((a, b) => a.offsetMinutes - b.offsetMinutes)
    .map(({ value, label }) => ({ value, label }));

  constructor(private store: Store, private settingsService: SettingsService) {}

  ngOnInit(): void {
    console.log('Available timezones:', this.timezones.slice(0, 10));
    console.log('Current config timezone:', this.config.timezone);
    this.listenRuleConfiguration();
  }

  onToggleActive(event: Event) {
    const newConfig = {
      ...this.config,
      isActive: (event.target as HTMLInputElement).checked,
    };
    this.updateConfig(newConfig);
  }
  onTimezoneChange(newTz: string) {
    console.log('Timezone changed to:', newTz);
    const newConfig = { ...this.config, timezone: newTz };
    console.log('New config with timezone:', newConfig);
    this.updateConfig(newConfig);
  }

  onTimeChange(field: 'tradingOpenTime' | 'tradingCloseTime', value: string) {
    const tempConfig = { ...this.config, [field]: value };
    const openMinutes = this.toMinutes(tempConfig.tradingOpenTime);
    const closeMinutes = this.toMinutes(tempConfig.tradingCloseTime);
    if (openMinutes >= closeMinutes) {
      alert('Opening time must be earlier than closing time.');
      return;
    }
    if (closeMinutes - openMinutes < 30) {
      alert(
        'There must be at least a 30-minute difference between opening and closing times.'
      );
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
    console.log('Dispatching hours allowed config:', config);
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
