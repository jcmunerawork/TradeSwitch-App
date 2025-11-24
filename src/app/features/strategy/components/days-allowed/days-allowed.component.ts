import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { SettingsService } from '../../service/strategy.service';
import {
  daysAllowed,
  selectMaxDailyTrades,
} from '../../store/strategy.selectors';
import {
  Days,
  DaysAllowedConfig,
  MaxDailyTradesConfig,
  RuleType,
} from '../../models/strategy.model';
import {
  setDaysAllowedConfig,
  setMaxDailyTradesConfig,
} from '../../store/strategy.actions';
import { CommonModule } from '@angular/common';

/**
 * Component for configuring the days allowed for trading rule.
 *
 * This component allows users to select which days of the week trading is
 * permitted. It displays buttons for each day (Monday through Sunday) that
 * can be toggled on/off.
 *
 * Features:
 * - Toggle rule active/inactive
 * - Day buttons for each day of the week
 * - Visual feedback for selected days
 * - Syncs with NgRx store
 *
 * Relations:
 * - Store (NgRx): Reads and updates daysAllowed configuration
 * - SettingsService: Strategy service (injected but not directly used)
 *
 * @component
 * @selector app-days-allowed
 * @standalone true
 */
@Component({
  selector: 'app-days-allowed',
  templateUrl: './days-allowed.component.html',
  styleUrls: ['./days-allowed.component.scss'],
  imports: [CommonModule],
  standalone: true,
})
export class DaysAllowedComponent implements OnInit {
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
      });
  }

  private updateConfig(config: DaysAllowedConfig) {
    this.store.dispatch(setDaysAllowedConfig({ config }));
  }
}
