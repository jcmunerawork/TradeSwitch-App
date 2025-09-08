import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LoadingPopupComponent } from '../../shared/pop-ups/loading-pop-up/loading-popup.component';
import { FormsModule } from '@angular/forms';
import { OverviewService } from '../overview/services/overview.service';
import { AccountsTableComponent } from './components/accounts-table/accounts-table.component';
import { User, UserStatus } from '../overview/models/overview';
import { AuthService } from '../auth/service/authService';
import { AccountComponent } from '../account/account.component';
import { selectUser } from '../auth/store/user.selectios';
import { AccountData } from '../auth/models/userModel';
import { ReportService } from '../report/service/report.service';
import { setUserKey } from '../report/store/report.actions';
import { concatMap, from, catchError, of } from 'rxjs';

@Component({
  selector: 'app-trading-accounts',
  imports: [
    CommonModule,
    LoadingPopupComponent,
    FormsModule,
    AccountsTableComponent,
  ],
  templateUrl: './trading-accounts.component.html',
  styleUrl: './trading-accounts.component.scss',
  standalone: true,
})
export class TradingAccountsComponent {
  user: User | null = null;
  userKey: string = '';
  fromDate: string = '';
  toDate: string = '';

  constructor(
    private store: Store,
    private reportSvc: ReportService,
    private userSvc: AuthService
  ) {}

  loading = false;
  usersData: AccountData[] = [];

  ngOnInit(): void {
    this.store.select(selectUser).subscribe((userState) => {
      this.user = userState?.user ?? null;
      this.loadConfig();
    });
  }

  loadConfig() {
    this.getUserAccounts();
  }

  getUserAccounts() {
    this.userSvc
      .getUserAccounts(this.user?.id || '')
      .then((docSnap) => {
        if (docSnap && docSnap.length > 0) {
          this.usersData = docSnap;
          this.loading = false;
          this.getBalanceForAccounts();
          console.log('Accounts loaded', this.usersData);
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

  getBalanceForAccounts() {
    this.loading = true;
    from(this.usersData)
      .pipe(concatMap((account) => this.fetchUserKey(account)))
      .subscribe({
        next: () => {},
        complete: () => {
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          console.error(
            'Error en el proceso de actualización de balances',
            err
          );
        },
      });
  }

  fetchUserKey(account: AccountData) {
    return this.reportSvc
      .getUserKey(
        account.emailTradingAccount,
        account.brokerPassword,
        account.server
      )
      .pipe(
        concatMap((key: string) => {
          this.store.dispatch(setUserKey({ userKey: key }));
          return this.getActualBalance(key, account);
        })
      );
  }

  getActualBalance(key: string, account: AccountData) {
    return this.reportSvc
      .getBalanceData(account.accountID, key, account.accountNumber)
      .pipe(
        concatMap((balance) => {
          account.balance = balance;
          return [account];
        })
      );
  }

  deleteAccount(account: AccountData) {
    this.loading = true;
    this.userSvc
      .deleteAccount(account.id)
      .then(() => {
        this.loading = false;
        this.loadConfig();
        this.usersData = [...this.usersData];
      })
      .catch((err) => {
        this.loading = false;
        console.error('Error deleting account', err);
      });
  }
}
