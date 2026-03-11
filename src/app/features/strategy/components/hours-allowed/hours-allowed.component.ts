import { Component, Input, OnInit } from '@angular/core';
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
import * as moment from 'moment-timezone';
import { AlertService } from '../../../../core/services';
import { ScrollTimePickerComponent } from '../../edit-strategy/components/scroll-time-picker/scroll-time-picker.component';

/**
 * Component for configuring the trading hours allowed rule.
 *
 * This component allows users to set the time window during which trading is
 * permitted. It includes time pickers for opening and closing times, and a
 * timezone selector with all available timezones.
 *
 * Features:
 * - Toggle rule active/inactive
 * - Scroll time pickers for opening and closing times (typeable + dropdown)
 * - Timezone selector with GMT offsets; optional browser default and info icon when isMyChoices
 * - Validation: opening time must be before closing time
 * - Minimum 30-minute difference between times
 *
 * Relations:
 * - Store (NgRx): Reads and updates hoursAllowed configuration
 * - ScrollTimePickerComponent: Time picker UI
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
  imports: [CommonModule, FormsModule, ScrollTimePickerComponent],
  standalone: true,
})
export class HoursAllowedComponent implements OnInit {
  /** When true, default timezone to browser and show timezone info icon. */
  @Input() isMyChoices = true;

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

  timezoneInfoTooltip = 'This timezone is where you make your trades (e.g. market/exchange), not your physical location.';
  showTimezoneTooltip = false;
  timeRangeError = '';
  private _defaultTimezoneSet = false;

  constructor(private store: Store, private settingsService: SettingsService, private alertService: AlertService) {}

  ngOnInit(): void {
    if (this.isMyChoices) {
      this.ensureBrowserTimezoneInList();
    }
    this.listenRuleConfiguration();
  }

  private getBrowserTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || moment.tz.guess() || 'UTC';
    } catch {
      return 'UTC';
    }
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
      tradingOpenTime: isActive ? this.config.tradingOpenTime : '09:30',
      tradingCloseTime: isActive ? this.config.tradingCloseTime : '17:00',
      timezone: isActive ? timezone : 'UTC',
    };
    this.updateConfig(newConfig);
  }
  onTimezoneChange(newTz: string) {
    // Validar que la timezone sea válida
    if (this.isValidTimezone(newTz)) {
      const newConfig = { ...this.config, timezone: newTz };
      this.updateConfig(newConfig);
    } else {// 
    }
  }

  isValidTimezone(timezone: string): boolean {
    return this.timezones.some(tz => tz.value === timezone);
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
        } else if (this.isMyChoices && (!config.timezone || config.timezone.trim() === '') && !this._defaultTimezoneSet) {
          this._defaultTimezoneSet = true;
          this.updateConfig({ ...config, timezone: this.getBrowserTimezone() });
          return;
        }
        this.config = { ...config };
      });
  }

  private updateConfig(config: HoursAllowedConfig) {
    this.store.dispatch(setHoursAllowedConfig({ config }));
  }

  private toMinutes(time: string): number {
    if (!time || time.trim() === '') return 0;
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

  private fromMinutes(totalMinutes: number): string {
    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    const hours24 = Math.floor(normalized / 60);
    const mins = normalized % 60;
    const isPm = hours24 >= 12;
    const h12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
    return `${h12}:${mins.toString().padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;
  }
}
