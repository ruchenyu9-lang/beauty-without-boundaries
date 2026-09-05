export interface AnalysisResult {
  detected_style: string;
  difficulty_level: string;
  suitable_skin_tones: string;
  detected_products: DetectedProduct[];
  color_palette: { hex: string; name: string }[];
  step_instructions: StepInstruction[];
}

export interface DetectedProduct {
  type: string;
  color_description: string;
  estimated_hex: string;
  region: string;
  finish: string;
  apparent_intensity: string;
}

export interface StepInstruction {
  step_number: number;
  action: string;
  product_type: string;
  color_reference: string;
  technique: string;
  tip: string;
  warning: string;
  duration_estimate: string;
}

export interface SubstituteResult {
  original_color: string;
  original_description: string;
  substitutes: SubstituteItem[];
}

export interface SubstituteItem {
  shade_id: number;
  shade_name: string;
  shade_number: string;
  price: number;
  hex_color: string;
  delta_e: number;
  brand: string;
  product_name: string;
  score: number;
}
