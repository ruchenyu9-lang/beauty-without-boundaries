export interface SkinTone {
  lab: { L: number; a: number; b: number };
  hex: string;
  undertone: string;
  confidence: number;
}

export interface ShadeMatch {
  shade_id: number;
  product_id: number;
  shade_name: string;
  shade_number: string;
  delta_e: number;
  hex_color: string;
  match_quality: string;
  brand?: string;
  product_name?: string;
  product_type?: string;
  price?: number;
}

export interface MakeupStep {
  step_number: number;
  product_type: string;
  shade_number: string;
  region: string;
  technique: string;
  intensity: string;
  hex_color?: string;
  shade_name?: string;
  brand?: string;
  product_name?: string;
}

export interface MakeupProduct {
  brand: string;
  category: string;
  name: string;
  shade: string;
  colorHex: string;
}

export interface ProductMakeupLook {
  lookName: string;
  style: string;
  products: MakeupProduct[];
}

export interface MakeupLook {
  lookName: string;
  look_name: string;
  description: string;
  style: string;
  products: MakeupProduct[];
  steps: MakeupStep[];
  shade_ids_used: string[];
  region_colors: Record<string, string>;
  overall_intensity: string;
}

export interface OverlayRegion {
  landmarks: number[];
  color: string;
  opacity: number;
}

export interface OverlayMap {
  [region: string]: OverlayRegion;
}
