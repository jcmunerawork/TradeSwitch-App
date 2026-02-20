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
  /** Intervalos de actividad (backend); preferir sobre dateActive/dateInactive */
  timeline?: TimelineInterval[];
  /** @deprecated Usar timeline */
  dateActive?: string[];
  /** @deprecated Usar timeline */
  dateInactive?: string[];
}
