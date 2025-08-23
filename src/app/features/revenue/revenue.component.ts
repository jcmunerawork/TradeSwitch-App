import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { Component } from '@angular/core';
import {
  DailyRevenueData,
  MonthlyRevenueData,
  RevenueSummary,
} from './models/revenue';
import { Store } from '@ngrx/store';
import {
  dailyRevenueMock,
  mockRevenueSummary,
  monthlyRevenueMock,
} from './mocks/revenue_mock';
import { statCardComponent } from '../report/components/statCard/stat_card.component';
import { RevenueGraphComponent } from './components/revenueGraph/revenue-graph.component';

@Component({
  selector: 'app-revenue',
  imports: [
    CommonModule,
    LoadingPopupComponent,
    FormsModule,
    statCardComponent,
    RevenueGraphComponent,
  ],
  templateUrl: './revenue.component.html',
  styleUrl: './revenue.component.scss',
  standalone: true,
})
export class RevenueComponent {
  revenueSummary: RevenueSummary | null = null;
  revenueDailyData: DailyRevenueData[] | null = null;
  revenueMonthlyData: MonthlyRevenueData[] | null = null;
  loading = false;

  constructor(private store: Store) {}

  ngOnInit(): void {
    this.loadConfig();
  }

  loadConfig() {
    this.revenueSummary = mockRevenueSummary;
    this.revenueDailyData = dailyRevenueMock;
    this.revenueMonthlyData = monthlyRevenueMock;
    this.getUsersData();
  }

  getUsersData() {}
}
