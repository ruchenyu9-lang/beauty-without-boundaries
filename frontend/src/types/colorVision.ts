export type ColorBlindType = 'protanopia' | 'deuteranopia' | 'tritanopia' | 'none';

export interface IshiharaPlate {
  plate_id: number;
  correct_answer: number;
  protanopia_sees: number;
  deuteranopia_sees: number;
  tritanopia_sees: number;
}

export interface CBDetectionResult {
  detected_type: ColorBlindType;
  severity: string;
  confidence: number;
  score_breakdown: Record<string, number>;
}

export interface PaletteColor {
  hex_color: string;
  lab_values: { L: number; a: number; b: number };
  descriptive_name: string;
  perceivable_as: string;
  simulated_hex: string;
  product_suggestions: { shade_name: string; hex: string; delta_e: number }[];
}
