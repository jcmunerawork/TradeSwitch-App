import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import {
  MaxDailyTradesConfig,
  RiskPerTradeConfig,
  RiskRewardConfig,
  RuleType,
} from '../../models/strategy.model';
import { Store } from '@ngrx/store';
import { SettingsService } from '../../service/strategy.service';
import { riskPerTrade, riskReward } from '../../store/strategy.selectors';
import {
  setRiskPerTradeConfig,
  setRiskRewardConfig,
} from '../../store/strategy.actions';
import { currencies } from './models/risk-per-trade.model';

@Component({
  selector: 'app-risk-per-trade',
  templateUrl: './risk-per-trade.component.html',
  styleUrls: ['./risk-per-trade.component.scss'],
  imports: [CommonModule],
  standalone: true,
})
export class RiskPerTradeComponent implements OnInit {
  config: RiskPerTradeConfig = {
    isActive: false,
    maxRiskPercentage: 2,
    maxRiskPerTrade: 200,
    type: RuleType.RISK_REWARD_RATIO,
  };

  inputFirstRatioValue: number = 0;

  inputSecondRatioValue: number = 0;

  initialRiskTrade: number | undefined;

  selectedCurrency = currencies[0];

  dropdownOpen = false;

  currencies = currencies;

  constructor(private store: Store, private settingsService: SettingsService) {}

  @HostListener('document:click')
  closeDropdown() {
    this.dropdownOpen = false;
  }

  ngOnInit(): void {
    this.listenRuleConfiguration();
  }

  toggleDropdown() {
    if (this.config.isActive) {
      this.dropdownOpen = !this.dropdownOpen;
    } else {
      this.dropdownOpen = false;
    }
  }

  selectCurrency(currency: { code: string; country: string }) {
    this.selectedCurrency = currency;
    this.dropdownOpen = false;
  }

  onToggleActive(event: Event) {
    const newConfig = {
      ...this.config,
      isActive: (event.target as HTMLInputElement).checked,
    };
    this.updateConfig(newConfig);
  }

  onChangeValue(event: Event) {
    const numValue = Number((event.target as HTMLInputElement).value);
    const moneyRisk = ((numValue / 100) * 200) / 0.02;

    const newConfig: RiskPerTradeConfig = {
      ...this.config,
      maxRiskPercentage: numValue,
      maxRiskPerTrade: moneyRisk,
    };
    this.updateConfig(newConfig);
  }

  listenRuleConfiguration() {
    this.store
      .select(riskPerTrade)
      .pipe()
      .subscribe((config) => {
        this.config = config;
        if (!this.initialRiskTrade) {
          this.initialRiskTrade = config.maxRiskPerTrade;
        }
      });
  }

  private updateConfig(config: RiskPerTradeConfig) {
    this.store.dispatch(setRiskPerTradeConfig({ config }));
  }
}
