export type ColorBlindType = 'protanopia' | 'deuteranopia' | 'tritanopia' | 'none';
export type SenseKey = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export interface IshiharaPlate {
  id: number;
  /** 放在 public/ishihara 下的真实测试板图片路径 */
  image: string;
  /** 正常视觉读数 */
  normal: string;
  /** 红绿色盲/色弱常见读数，0 表示看不到 */
  redGreenBlind: string;
  note: string;
}

export interface CBDetectionResult {
  detected_type: ColorBlindType;
  /** 面向用户展示的结果文案，例如「红绿色盲/色弱」 */
  result_label: string;
  severity: string;
  confidence: number;
  score_breakdown: Record<ColorBlindType, number>;
  correct_count: number;
  answered_count: number;
}

export interface ColorMetrics {
  hex: string;
  luminance: number;
  hue: number;
  saturation: number;
  lightness: number;
  name: string;
  undertone: string;
  warmth: '暖调' | '冷调' | '中性调';
}

export interface ColorTranslation {
  sourceHex: string;
  metrics: ColorMetrics;
  descriptions: Record<SenseKey, string>;
  story: string;
}

export interface PaletteColor {
  hex_color: string;
  lab_values: { L: number; a: number; b: number };
  descriptive_name: string;
  perceivable_as: string;
  simulated_hex: string;
  product_suggestions: { shade_name: string; hex: string; delta_e: number }[];
}
