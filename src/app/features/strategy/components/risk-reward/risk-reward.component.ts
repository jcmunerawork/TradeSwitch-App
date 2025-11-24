import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  MaxDailyTradesConfig,
  RiskRewardConfig,
  RuleType,
} from '../../models/strategy.model';
import { Store } from '@ngrx/store';
import { SettingsService } from '../../service/strategy.service';
import { riskReward } from '../../store/strategy.selectors';
import { setRiskRewardConfig } from '../../store/strategy.actions';

/**
 * Component for configuring the risk/reward ratio rule.
 *
 * This component allows users to set a minimum risk/reward ratio (e.g., "1:2")
 * that trades must meet. It provides input fields for both parts of the ratio
 * and includes increment/decrement buttons for the second value.
 *
 * Features:
 * - Toggle rule active/inactive
 * - Input fields for risk and reward values
 * - Increment/decrement buttons for reward value
 * - Syncs with NgRx store
 *
 * Relations:
 * - Store (NgRx): Reads and updates riskReward configuration
 * - SettingsService: Strategy service (injected but not directly used)
 *
 * @component
 * @selector app-risk-reward-ratio
 * @standalone true
 */
@Component({
  selector: 'app-risk-reward-ratio',
  templateUrl: './risk-reward.component.html',
  styleUrls: ['./risk-reward.component.scss'],
  imports: [CommonModule],
  standalone: true,
})
export class RiskRewardComponent implements OnInit {
  config: RiskRewardConfig = {
    isActive: false,
    riskRewardRatio: '1:2',
    type: RuleType.RISK_REWARD_RATIO,
  };

  inputFirstRatioValue: number = 0;

  inputSecondRatioValue: number = 0;

  initialRatio: string | undefined;

  constructor(private store: Store, private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.listenRuleConfiguration();
  }
  onToggleActive(event: Event) {
    const isActive = (event.target as HTMLInputElement).checked;
    const newConfig = {
      ...this.config,
      isActive: isActive,
      // Reiniciar a 1:2 cuando se desactiva
      riskRewardRatio: isActive ? this.config.riskRewardRatio : '1:2',
    };
    this.updateConfig(newConfig);
  }

  onChangeValue(event: Event, isFirst: boolean) {
    const numValue = Number((event.target as HTMLInputElement).value);
    const numberArray = this.config.riskRewardRatio
      .split(':')
      .map((number) => parseInt(number, 10));

    if (isFirst) {
      numberArray[0] = numValue;
    } else {
      numberArray[1] = numValue;
    }

    const newConfig: RiskRewardConfig = {
      ...this.config,
      riskRewardRatio: numberArray.join(':'),
    };
    this.updateConfig(newConfig);
  }

  // Métodos para spinner (solo para el segundo número)
  incrementSecondValue() {
    if (this.config.isActive) {
      const numberArray = this.config.riskRewardRatio
        .split(':')
        .map((number) => parseInt(number, 10));
      
      numberArray[1] = numberArray[1] + 1;
      
      const newConfig: RiskRewardConfig = {
        ...this.config,
        riskRewardRatio: numberArray.join(':'),
      };
      this.updateConfig(newConfig);
    }
  }

  decrementSecondValue() {
    if (this.config.isActive) {
      const numberArray = this.config.riskRewardRatio
        .split(':')
        .map((number) => parseInt(number, 10));
      
      if (numberArray[1] > 2) {
        numberArray[1] = numberArray[1] - 1;
        
        const newConfig: RiskRewardConfig = {
          ...this.config,
          riskRewardRatio: numberArray.join(':'),
        };
        this.updateConfig(newConfig);
      }
    }
  }

  listenRuleConfiguration() {
    this.store
      .select(riskReward)
      .pipe()
      .subscribe((config) => {
        this.config = config;
        if (!this.initialRatio) {
          this.initialRatio = config.riskRewardRatio;
        }
        const numberArray = config.riskRewardRatio
          .split(':')
          .map((number) => parseInt(number, 10));
        this.inputFirstRatioValue = numberArray[0];
        this.inputSecondRatioValue = numberArray[1];
      });
  }

  private updateConfig(config: RiskRewardConfig) {
    this.store.dispatch(setRiskRewardConfig({ config }));
  }
}
