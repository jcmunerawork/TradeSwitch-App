import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { SettingsService } from '../../service/strategy.service';
import { selectMaxDailyTrades } from '../../store/strategy.selectors';
import { MaxDailyTradesConfig, RuleType } from '../../models/strategy.model';
import { setMaxDailyTradesConfig } from '../../store/strategy.actions';
import { CommonModule } from '@angular/common';

/**
 * Component for configuring the maximum daily trades rule.
 *
 * This component allows users to set the maximum number of trades that can be
 * executed per day. It includes increment/decrement buttons and ensures the
 * minimum value is 1.
 *
 * Features:
 * - Toggle rule active/inactive
 * - Number input with validation (minimum 1)
 * - Increment/decrement buttons
 * - Syncs with NgRx store
 *
 * Relations:
 * - Store (NgRx): Reads and updates maxDailyTrades configuration
 * - SettingsService: Strategy service (injected but not directly used)
 *
 * @component
 * @selector app-max-daily-trades
 * @standalone true
 */
@Component({
  selector: 'app-max-daily-trades',
  templateUrl: './max-daily-trades.component.html',
  styleUrls: ['./max-daily-trades.component.scss'],
  imports: [CommonModule],
  standalone: true,
})
export class MaxDailyTradesComponent implements OnInit {
  config: MaxDailyTradesConfig = {
    isActive: false,
    maxDailyTrades: 1,
    type: RuleType.MAX_DAILY_TRADES,
  };

  constructor(private store: Store, private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.listenRuleConfiguration();
  }
  onToggleActive(event: Event) {
    const isActive = (event.target as HTMLInputElement).checked;
    const newConfig = {
      ...this.config,
      isActive: isActive,
      // Mantener el valor actual, no resetear
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
    if (this.config.isActive && this.config.maxDailyTrades > 1) {
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
        this.config = config;
      });
  }

  private updateConfig(config: MaxDailyTradesConfig) {
    this.store.dispatch(setMaxDailyTradesConfig({ config }));
  }
}
