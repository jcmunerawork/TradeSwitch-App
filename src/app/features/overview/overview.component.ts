import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { statCardComponent } from '../report/components/statCard/stat_card.component';
import { OverviewService } from './services/overview.service';
import { overviewSubscriptionData, User } from './models/overview';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { FormsModule } from '@angular/forms';
import { TradeSwitchTableComponent } from './components/tradeSwitch-table/tradeSwitchTable.component';
import { TopListComponent } from './components/top-list/top-list.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-overview',
  imports: [
    CommonModule,
    statCardComponent,
    LoadingPopupComponent,
    FormsModule,
    TradeSwitchTableComponent,
    TopListComponent,
    RouterLink,
  ],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
  standalone: true,
})
export class Overview {
  topUsers: User[] = [];
  constructor(private store: Store, private overviewSvc: OverviewService) {}

  loading = false;
  subscriptionsData: overviewSubscriptionData | null = null;
  usersData: User[] = [];
  newUsers = 0;
  newUsersGrowthPercentage = 0;

  ngOnInit(): void {
    this.loadConfig();
  }

  loadConfig() {
    this.loading = true;
    this.getOverviewSubscriptionData();
    this.getUsersData();
  }

  getUsersData() {
    this.overviewSvc
      .getUsersData()
      .then((docSnap) => {
        if (docSnap && !docSnap.empty && docSnap.docs.length > 0) {
          this.usersData = docSnap.docs
            .map((doc) => doc.data() as User)
            .filter((user) => !user.isAdmin);

          // Calcular nuevos usuarios basándose en la fecha actual
          this.calculateNewUsers();
          this.filterTop10Users();
          this.loading = false;
        } else {
          this.loading = false;
          console.warn('No config');
        }
      })
      .catch((err) => {
        this.loading = false;

        console.error('Error to get the config', err);
      });
  }

  getOverviewSubscriptionData() {
    this.overviewSvc
      .getOverviewSubscriptionData()
      .then((docSnap) => {
        if (docSnap && !docSnap.empty && docSnap.docs.length > 0) {
          const data = docSnap.docs[0].data() as overviewSubscriptionData;
          this.subscriptionsData = data;
        } else {
          console.warn('No config');
        }
      })
      .catch((err) => {
        this.loading = false;

        console.error('Error to get the config', err);
      });
  }

  calculateNewUsers() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // Convertir las fechas a timestamps para comparar con subscription_date
    const startOfDayTimestamp = startOfDay.getTime();
    const endOfDayTimestamp = endOfDay.getTime();
    
    // Filtrar usuarios que se registraron hoy
    this.newUsers = this.usersData.filter(user => 
      user.subscription_date >= startOfDayTimestamp && 
      user.subscription_date < endOfDayTimestamp
    ).length;
    
    // Calcular el porcentaje de crecimiento
    this.calculateGrowthPercentage();
  }

  calculateGrowthPercentage() {
    const totalUsers = this.usersData.length;
    
    if (totalUsers === 0) {
      this.newUsersGrowthPercentage = 0;
      return;
    }
    
    // Calcular el porcentaje de nuevos usuarios respecto al total
    // (nuevos usuarios / total usuarios) * 100
    this.newUsersGrowthPercentage = (this.newUsers / totalUsers) * 100;
    
    // Redondear a 1 decimal
    this.newUsersGrowthPercentage = Math.round(this.newUsersGrowthPercentage * 10) / 10;
  }

  filterTop10Users() {
    this.topUsers = this.usersData
      .filter((user) => user.profit > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }
}
