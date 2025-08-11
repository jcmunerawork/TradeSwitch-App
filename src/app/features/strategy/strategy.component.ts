import { Component } from '@angular/core';
import { MaxDailyTradesComponent } from './components/max-daily-trades/max-daily-trades.component';
import { RiskRewardComponent } from './components/risk-reward/risk-reward.component';

@Component({
  selector: 'app-strategy',
  imports: [MaxDailyTradesComponent, RiskRewardComponent],
  templateUrl: './strategy.component.html',
  styleUrl: './strategy.component.scss',
  standalone: true,
})
export class Strategy {}
