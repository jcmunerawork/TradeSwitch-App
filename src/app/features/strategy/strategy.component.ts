import { Component } from '@angular/core';
import { MaxDailyTradesComponent } from './components/max-daily-trades/max-daily-trades.component';

@Component({
  selector: 'app-strategy',
  imports: [MaxDailyTradesComponent],
  templateUrl: './strategy.component.html',
  styleUrl: './strategy.component.scss',
  standalone: true,
})
export class Strategy {}
