export interface Location {
  lat: number;
  lng: number;
}

export interface TideData {
  high: string;
  low: string;
}

export interface DataPoint {
  lat: number;
  lng: number;
  quantity: number;
  ui_icon: string;
}

export interface SinglePointData {
  date: string;
  species: string;
  quantity: number;
  location: Location;
  tide: TideData;
  hatchery: string;
  release_type: string;
  ui_icon: string;
}

export interface MapOverlayData {
  date: string;
  species: string;
  points: DataPoint[];
  tide: TideData;
  notes: string;
}

export interface SpeciesBreakdown {
  [species: string]: number;
}

export interface TrendDataPoint {
  date: string;
  total_quantity: number;
  species_breakdown: SpeciesBreakdown;
  ui_icon: string;
}

export interface TrendAnalytics {
  trend_period: string;
  trend_data: TrendDataPoint[];
  predicted_next_day: number;
}

export interface FilterSuggestion {
  available_species: string[];
  available_hatcheries: string[];
  available_dates: string[];
  suggested_pattern_analysis: string[];
}

export type KiroResponse = SinglePointData | MapOverlayData | TrendAnalytics | FilterSuggestion;
