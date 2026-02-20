import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfigurationOverview } from '../models/strategy.model';

/**
 * Servicio que centraliza el estado de búsqueda y la lista filtrada de estrategias.
 * El componente padre actualiza la lista base con setStrategies() y el término de búsqueda
 * con setSearchTerm()/clearSearch(); la vista usa filteredStrategies$ (async pipe) y searchTerm$.
 */
@Injectable({
  providedIn: 'root',
})
export class StrategyFilterService {
  private readonly strategies$ = new BehaviorSubject<ConfigurationOverview[]>([]);
  private readonly searchTerm$ = new BehaviorSubject<string>('');

  /** Término de búsqueda actual (para binding en filtros). */
  readonly searchTerm: Observable<string> = this.searchTerm$.asObservable();

  /** Lista de estrategias filtrada por nombre según searchTerm. */
  readonly filteredStrategies$: Observable<ConfigurationOverview[]> = combineLatest([
    this.strategies$,
    this.searchTerm$,
  ]).pipe(
    map(([strategies, term]) => {
      const trimmed = (term ?? '').trim();
      if (!trimmed) return [...strategies];
      const lower = trimmed.toLowerCase();
      return strategies.filter(s => (s.name ?? '').toLowerCase().includes(lower));
    })
  );

  setStrategies(strategies: ConfigurationOverview[]): void {
    this.strategies$.next(strategies ?? []);
  }

  setSearchTerm(value: string): void {
    this.searchTerm$.next(value ?? '');
  }

  clearSearch(): void {
    this.searchTerm$.next('');
  }
}
