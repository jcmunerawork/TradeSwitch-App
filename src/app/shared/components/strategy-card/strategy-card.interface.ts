import { TimelineInterval } from "@features/strategy/models/strategy.model";

/**
 * Interface for strategy card display data.
 *
 * @interface StrategyCardData
 */
export interface StrategyCardData {
  id: string;
  name: string;
  status: boolean;
  lastModified: string;
  rules: number;
  days_active: number;
  winRate: number;
  isFavorite?: boolean;
  created_at: any;
  updated_at: any;
  userId: string;
  configurationId: string;
  /** Activity intervals (from backend); prefer over dateActive/dateInactive */
  timeline?: TimelineInterval[];
  /** @deprecated Use timeline */
  dateActive?: string[];
  /** @deprecated Use timeline */
  dateInactive?: string[];
}
