export type StyleType = 'modern' | 'minimal' | 'traditional' | 'luxury';
export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface PlotInput {
  address: string;
  lat: number;
  lng: number;
  length_ft: number;
  width_ft: number;
  north_direction: CompassDirection;
  floors: number;
  budget_inr: number;
  bedrooms: number;
  bathrooms: number;
  kitchen_type: string;
  parking: boolean;
  garden: boolean;
  balcony: boolean;
  style: StyleType;
  vastu_preference: boolean;
}

export interface Plot extends PlotInput {
  id: string;
  created_at: string;
}

export interface Door {
  id: string;
  wall: 'N' | 'S' | 'E' | 'W'; // wall of the room it is on
  offset: number; // offset from start of wall (left to right for N/S, top to bottom for E/W)
}

export interface Window {
  id: string;
  wall: 'N' | 'S' | 'E' | 'W';
  offset: number;
  width: number;
}

export interface Room {
  id: string;
  name: string;
  x: number; // absolute ft coordinate in plot (starting from top-left offset)
  y: number; // absolute ft coordinate in plot (starting from top-left offset)
  width: number; // ft
  height: number; // ft
  doors: Door[];
  windows: Window[];
}

export interface FloorPlan {
  id: string;
  plot_id: string;
  floor_number: number;
  rooms: Room[];
  reasoning_notes: string;
  created_at: string;
}

export interface CostEstimateItem {
  id?: string;
  plot_id: string;
  category: 'structure' | 'finishing' | 'interior' | 'labor';
  line_item: string;
  quantity: number;
  unit: string;
  unit_cost_inr: number;
  total_cost_inr: number;
  source?: string;
}

export interface AdvisorMessage {
  id: string;
  plot_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
