import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfigurationOverview } from '../models/strategy.model';

/**
 * Service that centralizes search state and the filtered strategy list.
 * Parent component updates the base list with setStrategies() and search term with
 * setSearchTerm()/clearSearch(); view uses filteredStrategies$ (async pipe) and searchTerm$.
 */
@Injectable({
  providedIn: 'root',
})
export class StrategyFilterService {
  private readonly strategies$ = new BehaviorSubject<ConfigurationOverview[]>([]);
  private readonly searchTerm$ = new BehaviorSubject<string>('');

  /** Current search term (for binding in filters). */
  readonly searchTerm: Observable<string> = this.searchTerm$.asObservable();

  /** Strategy list filtered by name according to searchTerm. */
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
