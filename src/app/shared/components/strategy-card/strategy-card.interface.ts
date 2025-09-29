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
}
