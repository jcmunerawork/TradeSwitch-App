import { ReportState } from '../features/report/models/report.model';
import { StrategyState } from '../features/strategy/models/strategy.model';

export interface AppState {
  strategy: StrategyState;
  report: ReportState;
}
