import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

// Update the import to match the actual file and exported guard name
import { authGuard } from './auth-guard-guard';
describe('AuthGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => authGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});

