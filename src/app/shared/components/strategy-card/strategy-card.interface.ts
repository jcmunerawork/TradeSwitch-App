/**
 * Interface for strategy card display data.
 *
 * This interface defines the data structure used by StrategyCardComponent
 * to display strategy information in card format.
 *
 * @interface StrategyCardData
 */
export interface StrategyCardData {
  id: string;
  name: string;
  status: boolean; // true/false como en Firebase
  lastModified: string;
  rules: number; // Se calculará dinámicamente
  days_active: number; // Viene de Firebase
  winRate: number; // Se calculará dinámicamente
  isFavorite?: boolean;
  created_at: any; // Timestamp de Firebase
  updated_at: any; // Timestamp de Firebase
  userId: string;
  configurationId: string;
  dateActive?: string[]; // ISO 8601 strings - Array de fechas cuando se activó la estrategia
  dateInactive?: string[]; // ISO 8601 strings - Array de fechas cuando se desactivó la estrategia
}
