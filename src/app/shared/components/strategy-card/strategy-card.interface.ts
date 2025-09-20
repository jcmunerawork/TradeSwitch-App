export interface StrategyCardData {
  id: string;
  name: string;
  status: 'Active' | 'Inactive' | 'Draft';
  lastModified: string;
  rules: number;
  timesApplied: number;
  winRate: number;
  icon?: string;
  isFavorite?: boolean;
}
