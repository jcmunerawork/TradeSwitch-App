import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { selectUser } from '../../auth/store/user.selectios';
import { AuthService } from '../../auth/service/authService';
import { AccountData } from '../../auth/models/userModel';

/**
 * Carga inicial de usuario y cuentas para la página de estrategias.
 */
@Injectable({
  providedIn: 'root',
})
export class StrategyPageInitService {
  constructor(
    private store: Store,
    private authService: AuthService
  ) {}

  async loadUser(): Promise<{ user: any }> {
    const state = await firstValueFrom(this.store.select(selectUser));
    return { user: state?.user ?? null };
  }

  async loadAccounts(userId: string | null): Promise<AccountData[]> {
    if (!userId) return [];
    try {
      return await this.authService.getUserAccounts(userId) ?? [];
    } catch (error) {// 
      return [];
    }
  }
}
