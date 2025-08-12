import { Component } from '@angular/core';
import { MaxDailyTradesComponent } from './components/max-daily-trades/max-daily-trades.component';
import { RiskRewardComponent } from './components/risk-reward/risk-reward.component';
import { RiskPerTradeComponent } from './components/risk-per-trade/risk-per-trade.component';
import { DaysAllowedComponent } from './components/days-allowed/days-allowed.component';
import { HoursAllowedComponent } from './components/hours-allowed/hours-allowed.component';
import { AssetsAllowedComponent } from './components/assets-allowed/assets-allowed.component';

@Component({
  selector: 'app-strategy',
  imports: [
    MaxDailyTradesComponent,
    RiskRewardComponent,
    RiskPerTradeComponent,
    DaysAllowedComponent,
    HoursAllowedComponent,
    AssetsAllowedComponent,
  ],
  templateUrl: './strategy.component.html',
  styleUrl: './strategy.component.scss',
  standalone: true,
})
export class Strategy {}
