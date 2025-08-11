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

  constructor(private store: Store, private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.listenRuleConfiguration();
  }
  onToggleActive(event: Event) {
    const newConfig = {
      ...this.config,
      isActive: (event.target as HTMLInputElement).checked,
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

  listenRuleConfiguration() {
    this.store
      .select(riskReward)
      .pipe()
      .subscribe((config) => {
        this.config = config;
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
