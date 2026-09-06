/**
 * In-browser mock of the FastAPI backend — static demo mode for GitHub Pages.
 *
 * Faithful 1:1 port of the Python backend (routers + services + mock AI data):
 * every response reproduces what backend/app would return, because the backend
 * itself serves pre-generated mock data and deterministic color math
 * (CIEDE2000, Lab conversion, Daltonize) — all of which already exist
 * client-side in src/lib/color. Requests are intercepted at the axios
 * adapter layer, so no service worker or network is involved.
 *
 * Enabled by building with VITE_USE_MOCK_API=true (see deploy-pages.yml).
 */

import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  deltaE2000, classifyMatch, hexToLab, labToHex,
  detectUndertone, rgbToLab, labToRgb, rgbToHex, hexToRgb,
} from '../lib/color/labConversion';
import { daltonizePixel, simulateCBPixel } from '../lib/color/daltonize';
import type { ColorBlindType } from '../types/colorVision';
import { productsDb, shadesDb } from '../data/seedData';

// ── Helpers ──────────────────────────────────────────────────────────

type Lab = [number, number, number];

/** Match Python round(x, 2) for display values. */
const round2 = (x: number): number => Math.round(x * 100) / 100;
const asCBType = (t: unknown): ColorBlindType => (t as ColorBlindType) || 'deuteranopia';
const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ── Mock AI data (ported verbatim from backend/app/services/claude_service.py) ──

const MOCK_MAKEUP_LOOKS: Record<string, any[]> = {
  natural: [
    {
      look_name: '晨曦轻颜',
      description: '一款清新自然的日常妆容，适合上班或休闲场合。轻薄底妆搭配柔和腮红与自然唇色。',
      style: 'natural',
      steps: [
        { step_number: 1, product_type: 'foundation', shade_number: 'N4', region: 'forehead', technique: 'blend outward', intensity: 'light' },
        { step_number: 2, product_type: 'foundation', shade_number: 'N4', region: 'nose', technique: 'press', intensity: 'light' },
        { step_number: 3, product_type: 'foundation', shade_number: 'N4', region: 'left_cheek', technique: 'blend outward', intensity: 'light' },
        { step_number: 4, product_type: 'foundation', shade_number: 'N4', region: 'right_cheek', technique: 'blend outward', intensity: 'light' },
        { step_number: 5, product_type: 'blush', shade_number: '140', region: 'left_cheek', technique: 'sweep across', intensity: 'light' },
        { step_number: 6, product_type: 'blush', shade_number: '140', region: 'right_cheek', technique: 'sweep across', intensity: 'light' },
        { step_number: 7, product_type: 'lipstick', shade_number: '220', region: 'lips_upper', technique: 'press', intensity: 'light' },
        { step_number: 8, product_type: 'lipstick', shade_number: '220', region: 'lips_lower', technique: 'press', intensity: 'light' },
      ],
      shade_ids_used: ['N4', '140', '220'],
      region_colors: {
        forehead: '#F5D5B8', nose: '#F0CDB0', left_cheek: '#E8A87C',
        right_cheek: '#E8A87C', lips_upper: '#C44569', lips_lower: '#C44569',
      },
      overall_intensity: 'subtle',
    },
    {
      look_name: '暖阳蜜桃',
      description: '蜜桃色系日常妆，温暖亲和，适合约会和社交场合。重点在腮红与唇色的搭配。',
      style: 'natural',
      steps: [
        { step_number: 1, product_type: 'foundation', shade_number: 'N4', region: 'forehead', technique: 'blend outward', intensity: 'medium' },
        { step_number: 2, product_type: 'foundation', shade_number: 'N4', region: 'left_cheek', technique: 'blend outward', intensity: 'medium' },
        { step_number: 3, product_type: 'foundation', shade_number: 'N4', region: 'right_cheek', technique: 'blend outward', intensity: 'medium' },
        { step_number: 4, product_type: 'blush', shade_number: '140', region: 'left_cheek', technique: 'pat and build', intensity: 'medium' },
        { step_number: 5, product_type: 'blush', shade_number: '140', region: 'right_cheek', technique: 'pat and build', intensity: 'medium' },
        { step_number: 6, product_type: 'eyeshadow', shade_number: 'R31', region: 'upper_lid', technique: 'sweep across', intensity: 'light' },
        { step_number: 7, product_type: 'lipstick', shade_number: '361', region: 'lips_upper', technique: 'press', intensity: 'medium' },
        { step_number: 8, product_type: 'lipstick', shade_number: '361', region: 'lips_lower', technique: 'press', intensity: 'medium' },
      ],
      shade_ids_used: ['N4', '140', 'R31', '361'],
      region_colors: {
        forehead: '#F5D5B8', nose: '#E8D5C0', left_cheek: '#E8A87C',
        right_cheek: '#E8A87C', upper_lid: '#C9A96E', lips_upper: '#D4735E', lips_lower: '#D4735E',
      },
      overall_intensity: 'moderate',
    },
  ],
  glam: [
    {
      look_name: '星耀华妆',
      description: '华丽闪耀的派对妆容，浓郁眼影搭配精致唇色，适合晚宴和庆典场合。',
      style: 'glam',
      steps: [
        { step_number: 1, product_type: 'foundation', shade_number: 'N4', region: 'forehead', technique: 'blend outward', intensity: 'heavy' },
        { step_number: 2, product_type: 'foundation', shade_number: 'N4', region: 'left_cheek', technique: 'blend outward', intensity: 'heavy' },
        { step_number: 3, product_type: 'foundation', shade_number: 'N4', region: 'right_cheek', technique: 'blend outward', intensity: 'heavy' },
        { step_number: 4, product_type: 'eyeshadow', shade_number: 'C1', region: 'upper_lid', technique: 'pat and build', intensity: 'heavy' },
        { step_number: 5, product_type: 'eyeshadow', shade_number: 'R31', region: 'crease', technique: 'blend outward', intensity: 'medium' },
        { step_number: 6, product_type: 'eyeshadow', shade_number: 'C1', region: 'lower_lid', technique: 'sweep across', intensity: 'light' },
        { step_number: 7, product_type: 'blush', shade_number: '140', region: 'left_cheek', technique: 'sweep across', intensity: 'medium' },
        { step_number: 8, product_type: 'blush', shade_number: '140', region: 'right_cheek', technique: 'sweep across', intensity: 'medium' },
        { step_number: 9, product_type: 'lipstick', shade_number: '440', region: 'lips_upper', technique: 'press', intensity: 'heavy' },
        { step_number: 10, product_type: 'lipstick', shade_number: '440', region: 'lips_lower', technique: 'press', intensity: 'heavy' },
      ],
      shade_ids_used: ['N4', 'C1', 'R31', '140', '440'],
      region_colors: {
        forehead: '#F0CDB0', left_cheek: '#D4A574', right_cheek: '#D4A574',
        upper_lid: '#4A2C2A', lower_lid: '#6B4430', crease: '#8B6950',
        lips_upper: '#8B0000', lips_lower: '#8B0000',
      },
      overall_intensity: 'dramatic',
    },
  ],
  professional: [
    {
      look_name: '雅韵职妆',
      description: '专业干练的职场妆容，清爽底妆搭配自然眉形与低饱和唇色。',
      style: 'professional',
      steps: [
        { step_number: 1, product_type: 'foundation', shade_number: 'N4', region: 'forehead', technique: 'blend outward', intensity: 'light' },
        { step_number: 2, product_type: 'foundation', shade_number: 'N4', region: 'left_cheek', technique: 'blend outward', intensity: 'light' },
        { step_number: 3, product_type: 'foundation', shade_number: 'N4', region: 'right_cheek', technique: 'blend outward', intensity: 'light' },
        { step_number: 4, product_type: 'blush', shade_number: '140', region: 'left_cheek', technique: 'sweep across', intensity: 'light' },
        { step_number: 5, product_type: 'blush', shade_number: '140', region: 'right_cheek', technique: 'sweep across', intensity: 'light' },
        { step_number: 6, product_type: 'lipstick', shade_number: '220', region: 'lips_upper', technique: 'press', intensity: 'light' },
        { step_number: 7, product_type: 'lipstick', shade_number: '220', region: 'lips_lower', technique: 'press', intensity: 'light' },
      ],
      shade_ids_used: ['N4', '140', '220'],
      region_colors: {
        forehead: '#F5D5B8', left_cheek: '#E8C8A8', right_cheek: '#E8C8A8',
        lips_upper: '#C44569', lips_lower: '#C44569',
      },
      overall_intensity: 'subtle',
    },
  ],
};

const MOCK_ANALYSIS_RESULT = {
  detected_style: '韩式玻璃肌肤',
  difficulty_level: 'intermediate',
  suitable_skin_tones: '适合所有肤色，尤其适合偏暖肤色',
  detected_products: [
    { type: 'foundation', color_description: '暖米色轻薄底妆', estimated_hex: '#F5D5B8', region: 'full_face', finish: 'dewy', apparent_intensity: 'light' },
    { type: 'eyeshadow', color_description: '柔和棕色眼影', estimated_hex: '#C9A96E', region: 'upper_lid', finish: 'satin', apparent_intensity: 'medium' },
    { type: 'blush', color_description: '蜜桃色腮红', estimated_hex: '#E8A87C', region: 'cheek', finish: 'matte', apparent_intensity: 'medium' },
    { type: 'lipstick', color_description: '温柔玫瑰粉唇色', estimated_hex: '#D4735E', region: 'lip', finish: 'glossy', apparent_intensity: 'medium' },
  ],
  color_palette: [
    { hex: '#F5D5B8', name: '暖米色' },
    { hex: '#C9A96E', name: '柔和棕' },
    { hex: '#E8A87C', name: '蜜桃色' },
    { hex: '#D4735E', name: '玫瑰粉' },
    { hex: '#E0C8B0', name: '奶油白' },
  ],
  step_instructions: [
    { step_number: 1, action: '涂抹轻薄底妆于全脸', product_type: 'foundation', color_reference: '暖米色', technique: 'blend outward', tip: '少量多次，用海绵按压更贴合', warning: '不要一次涂太厚，会显得假面', duration_estimate: '2-3分钟' },
    { step_number: 2, action: '棕色眼影扫在上眼睑', product_type: 'eyeshadow', color_reference: '柔和棕', technique: 'sweep across', tip: '从内眼角向外眼角渐变', warning: '下眼睑不要涂太重', duration_estimate: '3-4分钟' },
    { step_number: 3, action: '蜜桃色腮红扫在颧骨', product_type: 'blush', color_reference: '蜜桃色', technique: 'sweep across', tip: '微笑时颧骨最高点为起点', warning: '腮红量要少，慢慢叠加', duration_estimate: '1-2分钟' },
    { step_number: 4, action: '玫瑰粉唇色涂抹双唇', product_type: 'lipstick', color_reference: '玫瑰粉', technique: 'press', tip: '先用唇刷勾勒唇形再填充', warning: '唇线不要超出自然唇缘', duration_estimate: '2-3分钟' },
  ],
};

const MOCK_COLOR_IDENTIFICATION = {
  identified_colors: [
    { region: '整体', hex_color: '#C44569', lab_values: { L: 42.5, a: 28.3, b: 14.7 }, descriptive_name: '温暖珊瑚粉色，类似成熟蜜桃的柔和质感', perceivable_descriptions: { protanopia: '中性金棕色，缺少玫瑰暖意', deuteranopia: '偏深的金棕色调', tritanopia: '温暖珊瑚粉色（可正常感知）', normal: '温暖珊瑚粉色，类似成熟蜜桃' }, undertone_classification: 'warm', finish_type: 'satin' },
    { region: '底部', hex_color: '#8B4513', lab_values: { L: 35.2, a: 18.5, b: 22.3 }, descriptive_name: '深棕色，类似烤焦糖的醇厚质感', perceivable_descriptions: { protanopia: '偏灰暗的棕色调', deuteranopia: '偏暖的棕色调', tritanopia: '深棕色（可正常感知）', normal: '深棕色，类似烤焦糖' }, undertone_classification: 'warm', finish_type: 'matte' },
  ],
  overall_color_story: '温暖秋季色调组合，以珊瑚粉和深棕为主色',
  warmth_level: 'warm',
};

// ── Ishihara plates (ported from backend/app/services/color_vision_service.py) ──

const ISHIHARA_PLATES = [
  { plate_id: 1, correct_answer: 12, protanopia_sees: 6, deuteranopia_sees: 6, tritanopia_sees: 12 },
  { plate_id: 2, correct_answer: 8, protanopia_sees: 3, deuteranopia_sees: 3, tritanopia_sees: 8 },
  { plate_id: 3, correct_answer: 29, protanopia_sees: 70, deuteranopia_sees: 7, tritanopia_sees: 29 },
  { plate_id: 4, correct_answer: 5, protanopia_sees: 2, deuteranopia_sees: 2, tritanopia_sees: 5 },
  { plate_id: 5, correct_answer: 3, protanopia_sees: 5, deuteranopia_sees: 5, tritanopia_sees: 3 },
  { plate_id: 6, correct_answer: 15, protanopia_sees: 17, deuteranopia_sees: 17, tritanopia_sees: 15 },
];

// ── Face region → landmark mapping (ported from backend/app/routers/makeup.py) ──

const REGION_LANDMARK_MAP: Record<string, number[]> = {
  forehead: [10, 151, 108, 109, 337, 338, 67, 69, 104, 297, 299, 333],
  nose: [1, 2, 3, 4, 5, 6, 19, 20, 94, 141, 168],
  left_cheek: [116, 117, 118, 119, 120, 121, 122, 123, 187, 205, 206, 207],
  right_cheek: [345, 346, 347, 348, 349, 350, 351, 352, 411, 425, 426, 427],
  upper_lid: [159, 160, 161, 162, 31, 223, 224, 225, 113, 386, 387, 388, 389, 263, 443, 444, 445, 342],
  lower_lid: [144, 145, 146, 147, 111, 24, 23, 22, 26, 373, 374, 375, 376, 340, 254, 253, 252, 256],
  crease: [70, 63, 105, 66, 107, 55, 65, 52, 53, 56, 300, 293, 334, 296, 336, 285, 295, 282, 283, 286],
  lips_upper: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
  lips_lower: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
  chin: [152, 377, 148, 376, 379, 373, 374, 150],
  cheekbone: [116, 117, 345, 346, 347, 411],
};

const REGION_OPACITY: Record<string, number> = {
  forehead: 0.3, nose: 0.3, left_cheek: 0.4, right_cheek: 0.4,
  upper_lid: 0.6, lower_lid: 0.5, crease: 0.6,
  lips_upper: 0.85, lips_lower: 0.85,
  chin: 0.3, cheekbone: 0.4,
};

// ── Ported services ──────────────────────────────────────────────────

/** backend: services/makeup_generator.py extract_skin_tone_from_image */
function extractSkinToneFromImage(rgb: [number, number, number]) {
  const [L, a, b] = rgbToLab(rgb[0], rgb[1], rgb[2]);
  return {
    lab: { L: round2(L), a: round2(a), b: round2(b) },
    hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
    undertone: detectUndertone(L, a, b),
    confidence: 0.85,
  };
}

/** backend: services/makeup_generator.py shade_match */
function shadeMatchService(userShadeLab: Lab, productTypeFilter?: string): any[] {
  const results: any[] = [];
  for (const shade of shadesDb) {
    // NOTE: faithful port — shade records carry no product_type field, so a
    // product_type_filter skips every shade, exactly like the Python backend.
    if (productTypeFilter && shade.product_type !== productTypeFilter) continue;
    const shadeLab: Lab = [shade.lab_l, shade.lab_a, shade.lab_b];
    const dE = deltaE2000(userShadeLab, shadeLab);
    results.push({
      shade_id: shade.id,
      product_id: shade.product_id ?? 0,
      shade_name: shade.shade_name,
      shade_number: shade.shade_number,
      delta_e: round2(dE),
      hex_color: shade.hex_color,
      match_quality: classifyMatch(dE),
    });
  }
  results.sort((x, y) => x.delta_e - y.delta_e);
  return results.slice(0, 5);
}

/** backend: services/claude_service.py generate_makeup_looks (mock — style-independent) */
function generateMakeupLooksService(): { looks: any[] } {
  const resultLooks: any[] = [];
  for (const s of ['natural', 'glam', 'professional']) {
    const styleLooks = MOCK_MAKEUP_LOOKS[s] || [];
    if (styleLooks.length) resultLooks.push(styleLooks[0]);
  }
  return { looks: resultLooks.slice(0, 3) };
}

/** backend: services/image_analyzer.py find_affordable_substitutes */
function findAffordableSubstitutes(detectedProducts: any[], maxPrice: number): any[] {
  const substitutes: any[] = [];
  for (const product of detectedProducts) {
    const detectedLab = hexToLab(product.estimated_hex);
    const candidates: any[] = [];
    for (const shade of shadesDb) {
      const shadeLab: Lab = [shade.lab_l, shade.lab_a, shade.lab_b];
      const dE = deltaE2000(detectedLab, shadeLab);
      if (dE <= 5.0) {
        const prodInfo = productsDb.find(p => p.id === shade.product_id);
        if (prodInfo && prodInfo.product_type === product.type) {
          const colorScore = Math.max(0, 1 - dE / 5);
          const priceScore = Math.max(0, 1 - prodInfo.price / maxPrice);
          const lorealBonus = prodInfo.is_loreal ? 0.2 : 0;
          const totalScore = colorScore * 0.6 + priceScore * 0.3 + lorealBonus;
          candidates.push({
            shade_id: shade.id,
            product_id: shade.product_id ?? 0,
            shade_name: shade.shade_name,
            shade_number: shade.shade_number,
            price: prodInfo.price,
            hex_color: shade.hex_color,
            delta_e: round2(dE),
            brand: prodInfo.brand,
            product_name: prodInfo.product_name,
            score: Math.round(totalScore * 1000) / 1000,
          });
        }
      }
    }
    candidates.sort((x, y) => y.score - x.score);
    substitutes.push({
      original_color: product.estimated_hex,
      original_description: product.color_description,
      substitutes: candidates.slice(0, 5),
    });
  }
  return substitutes;
}

/** backend: services/color_vision_service.py detect_color_blind_type */
function detectColorBlindType(quizAnswers: any[]) {
  const scores: Record<string, number> = { protanopia: 0, deuteranopia: 0, tritanopia: 0, normal: 0 };
  for (const answer of quizAnswers) {
    const plate = ISHIHARA_PLATES.find(p => p.plate_id === answer.plate_id);
    if (!plate) continue;
    const selected = answer.selected_number ?? 0;
    if (selected === plate.correct_answer) {
      scores.normal += 2;
    } else if (selected === plate.protanopia_sees) {
      scores.protanopia += 2;
      scores.deuteranopia += 1;
    } else if (selected === plate.deuteranopia_sees) {
      scores.deuteranopia += 2;
      scores.protanopia += 1;
    } else if (selected === plate.tritanopia_sees) {
      scores.tritanopia += 2;
    }
  }

  // Python max() keeps the first key with the highest value (dict order) — replicate.
  let bestType = 'protanopia';
  let bestVal = -Infinity;
  for (const k of Object.keys(scores)) {
    if (scores[k] > bestVal) { bestVal = scores[k]; bestType = k; }
  }

  const total = quizAnswers.length * 2;
  const confidence = total > 0 ? Math.min(1, bestVal / total) : 0;

  let severity: string;
  if (scores.normal > total * 0.6) severity = 'none';
  else if (scores[bestType] > total * 0.7) severity = 'strong';
  else if (scores[bestType] > total * 0.4) severity = 'moderate';
  else severity = 'mild';

  return {
    detected_type: severity === 'none' ? 'normal' : bestType,
    severity,
    confidence: round2(confidence),
    score_breakdown: scores,
  };
}

/** backend: services/color_vision_service.py simulate_cb_lab */
function simulateCBLab(lab: Lab, cbType: ColorBlindType): Lab {
  const rgb = labToRgb(lab[0], lab[1], lab[2]);
  const sim = simulateCBPixel(rgb[0], rgb[1], rgb[2], cbType);
  return rgbToLab(sim[0], sim[1], sim[2]);
}

/** backend: services/color_vision_service.py generate_color_description */
function generateColorDescription(lab: Lab): string {
  const [L, a, b] = lab;
  const light = L > 80 ? '极浅/苍白' : L > 60 ? '中浅' : L > 40 ? '中等' : L > 20 ? '深色/浓郁' : '极深';

  let warmth: string;
  if (a > 15 && b > 20) warmth = '暖色调，带有玫瑰金色底调';
  else if (a > 10) warmth = '暖色调，带有粉红色调';
  else if (b > 20) warmth = '暖色调，带有金色调';
  else if (a < -5 && b < -5) warmth = '冷色调，带有蓝绿色调';
  else if (b < -10) warmth = '冷色调，带有蓝色底调';
  else if (a < -5) warmth = '冷色调，带有绿色底调';
  else warmth = '中性色调';

  return `${light} ${warmth}`;
}

/** backend: services/color_vision_service.py generate_custom_palette */
function generateCustomPalette(cbTypeStr: string, skinToneLab: any): any[] {
  const cbType = asCBType(cbTypeStr);
  const baseColors: Lab[] = [];

  if (cbTypeStr === 'protanopia' || cbTypeStr === 'deuteranopia') {
    // User perceives L* (lightness) and b* (blue-yellow) well
    for (let L = 20; L < 90; L += 10) {
      for (let b = -40; b < 60; b += 10) {
        const a = (skinToneLab?.a ?? 12) * 0.5; // anchor near skin
        baseColors.push([L, a, b]);
      }
    }
  } else if (cbTypeStr === 'tritanopia') {
    // User perceives L* and a* (red-green) well
    for (let L = 20; L < 90; L += 10) {
      for (let a = -30; a < 50; a += 10) {
        const b = (skinToneLab?.b ?? 18) * 0.5; // anchor near skin
        baseColors.push([L, a, b]);
      }
    }
  } else {
    // Normal vision: full color range
    for (let L = 20; L < 90; L += 15) {
      for (let a = -30; a < 50; a += 15) {
        for (let b = -40; b < 60; b += 15) {
          baseColors.push([L, a, b]);
        }
      }
    }
  }

  // Filter: remove colors that look identical to this CB type
  const filtered: Lab[] = [];
  for (const color of baseColors) {
    const simulated = simulateCBLab(color, cbType);
    let isUnique = true;
    for (const existing of filtered) {
      const existingSim = simulateCBLab(existing, cbType);
      if (deltaE2000(simulated, existingSim) < 3.0) { isUnique = false; break; }
    }
    if (isUnique) filtered.push(color);
  }

  // Map to descriptive names and product suggestions
  const palette: any[] = [];
  for (const labColor of filtered.slice(0, 20)) {
    const hexColor = labToHex(labColor[0], labColor[1], labColor[2]);
    const simulatedLab = simulateCBLab(labColor, cbType);
    const simulatedHex = labToHex(simulatedLab[0], simulatedLab[1], simulatedLab[2]);
    const desc = generateColorDescription(labColor);
    const perceivableDesc = generateColorDescription(simulatedLab);

    const suggestions: any[] = [];
    for (const shade of shadesDb.slice(0, 5)) {
      const shadeLab: Lab = [shade.lab_l, shade.lab_a, shade.lab_b];
      const dE = deltaE2000(labColor, shadeLab);
      if (dE <= 5) {
        suggestions.push({ shade_name: shade.shade_name, hex: shade.hex_color, delta_e: round2(dE) });
      }
    }

    palette.push({
      hex_color: hexColor,
      lab_values: {
        L: Math.round(labColor[0] * 10) / 10,
        a: Math.round(labColor[1] * 10) / 10,
        b: Math.round(labColor[2] * 10) / 10,
      },
      descriptive_name: desc,
      perceivable_as: `您将感知此色为：${perceivableDesc}`,
      simulated_hex: simulatedHex,
      product_suggestions: suggestions.slice(0, 3),
    });
  }

  palette.sort((p, q) => p.lab_values.L - q.lab_values.L);
  return palette;
}

// ── Route handlers (ported from backend/app/routers/*) ────────────────

type Params = Record<string, any>;
type Body = Record<string, any>;

/** Handle one mocked API request. Exported for the smoke test. */
export function handleMockRoute(method: string, rawPath: string, params: Params, body: Body): any {
  const path = rawPath.split('?')[0].replace(/\/+$/, '');
  const key = `${method.toLowerCase()} ${path}`;

  switch (key) {
    // ── health ──
    case 'get /api/health':
      return { status: 'ok', service: 'Beauty Without Boundaries (美妆无界)', version: '1.0.0' };

    // ── products ──
    case 'get /api/products': {
      let products: any[] = productsDb;
      if (params.product_type) products = products.filter(p => p.product_type === params.product_type);
      return { products, total: products.length };
    }
    case 'get /api/products/types':
      return { types: [...new Set(productsDb.map(p => p.product_type))].sort() };
    case 'get /api/products/brands':
      return { brands: [...new Set(productsDb.map(p => p.brand))].sort() };
    case 'get /api/products/shades': {
      let shades: any[] = shadesDb;
      if (params.product_id) shades = shades.filter(s => s.product_id === Number(params.product_id));
      if (params.product_type) {
        const matchingIds = new Set(productsDb.filter(p => p.product_type === params.product_type).map(p => p.id));
        shades = shades.filter(s => matchingIds.has(s.product_id));
      }
      const result = shades.map(s => {
        const entry: any = { ...s };
        const p = productsDb.find(prod => prod.id === s.product_id);
        if (p) {
          entry.brand = p.brand;
          entry.product_name = p.product_name;
          entry.product_type = p.product_type;
          entry.price = p.price;
          entry.is_loreal = p.is_loreal;
        }
        return entry;
      });
      return { shades: result, total: result.length };
    }
    case 'get /api/products/search-shade': {
      const q = String(params.q ?? '').toLowerCase();
      const limit = Number(params.limit ?? 10);
      const matches: any[] = [];
      for (const s of shadesDb) {
        if (s.shade_number.toLowerCase().includes(q) || s.shade_name.toLowerCase().includes(q)) {
          const entry: any = { ...s };
          const p = productsDb.find(prod => prod.id === s.product_id);
          if (p) {
            entry.brand = p.brand;
            entry.product_name = p.product_name;
            entry.product_type = p.product_type;
            entry.price = p.price;
          }
          matches.push(entry);
        }
      }
      return { matches: matches.slice(0, limit) };
    }

    // ── makeup ──
    case 'post /api/makeup/scan-face': {
      let rgb: [number, number, number];
      if (body.hex) {
        rgb = hexToRgb(String(body.hex).replace(/^#/, ''));
      } else if (body.r !== undefined) {
        rgb = [body.r, body.g, body.b];
      } else {
        rgb = [212, 165, 116]; // default: medium warm skin tone
      }
      return extractSkinToneFromImage(rgb);
    }
    case 'post /api/makeup/shade-match': {
      const skinToneLab = body.skin_tone_lab || { L: 65.2, a: 12.3, b: 18.5 };
      const shadeNumbers: string[] = body.shade_numbers || [];
      const productTypeFilter = body.product_type_filter;

      const userShadeLab: Lab = [skinToneLab.L, skinToneLab.a, skinToneLab.b];

      const matchedByNumber: any[] = [];
      for (const sn of shadeNumbers) {
        for (const s of shadesDb) {
          if (s.shade_number.toLowerCase() === sn.toLowerCase()) {
            const entry: any = { ...s };
            const p = productsDb.find(prod => prod.id === s.product_id);
            if (p) {
              entry.brand = p.brand;
              entry.product_name = p.product_name;
              entry.product_type = p.product_type;
              entry.price = p.price;
            }
            matchedByNumber.push(entry);
          }
        }
      }

      const colorMatches = shadeMatchService(userShadeLab, productTypeFilter);
      for (const m of colorMatches) {
        const p = productsDb.find(prod => prod.id === (m.product_id || 0));
        if (p) {
          m.brand = p.brand;
          m.product_name = p.product_name;
          m.product_type = p.product_type;
          m.price = p.price;
        }
      }

      return { matched_by_number: matchedByNumber, color_matches: colorMatches };
    }
    case 'post /api/makeup/generate-looks': {
      // skin_tone_lab / available_shade_ids / style / occasion / language are
      // accepted (as in the backend) but the mock generator ignores them.
      const result = generateMakeupLooksService();
      for (const look of result.looks || []) {
        const enrichedSteps: any[] = [];
        for (const step of look.steps || []) {
          const stepEntry: any = { ...step };
          const s = shadesDb.find(sh => sh.shade_number === step.shade_number);
          if (s) {
            stepEntry.hex_color = s.hex_color;
            stepEntry.shade_name = s.shade_name;
            const p = productsDb.find(prod => prod.id === s.product_id);
            if (p) {
              stepEntry.brand = p.brand;
              stepEntry.product_name = p.product_name;
            }
          }
          enrichedSteps.push(stepEntry);
        }
        look.steps = enrichedSteps;
      }
      return result;
    }
    case 'post /api/makeup/render-overlay-data': {
      const regionColors: Record<string, string> = body.region_colors || {};
      const overlayMap: Record<string, any> = {};
      for (const [region, colorHex] of Object.entries(regionColors)) {
        const regionKey = region.toLowerCase().replace(/ /g, '_');
        if (regionKey in REGION_LANDMARK_MAP) {
          overlayMap[regionKey] = {
            landmarks: REGION_LANDMARK_MAP[regionKey],
            color: colorHex,
            opacity: REGION_OPACITY[regionKey] ?? 0.5,
          };
        }
      }
      return { overlay_map: overlayMap };
    }

    // ── analysis ──
    case 'post /api/analysis/analyze-image':
      return deepClone(MOCK_ANALYSIS_RESULT);
    case 'post /api/analysis/find-substitutes': {
      const detectedProducts: any[] = body.detected_products || [];
      const maxPrice = body.max_price ?? 200.0;
      return { substitutes: findAffordableSubstitutes(detectedProducts, maxPrice) };
    }
    case 'post /api/analysis/generate-instructions':
      return { steps: deepClone(MOCK_ANALYSIS_RESULT.step_instructions) };

    // ── color vision ──
    case 'post /api/color-vision/daltonize-image': {
      const pixels: number[][] = body.pixels || [];
      const cbType = body.cb_type || 'deuteranopia';
      const cb = asCBType(cbType);
      const daltonized = pixels.map(p => {
        const [r, g, b] = daltonizePixel(p[0], p[1], p[2], cb);
        return [r, g, b];
      });
      return { daltonized_pixels: daltonized, cb_type: cbType };
    }
    case 'post /api/color-vision/daltonize-single': {
      const hexColor: string = body.hex_color || '#C44569';
      const cbType = body.cb_type || 'deuteranopia';
      const [r, g, b] = hexToRgb(hexColor);
      const [dr, dg, db] = daltonizePixel(r, g, b, asCBType(cbType));
      return {
        original_hex: hexColor,
        daltonized_hex: rgbToHex(dr, dg, db),
        cb_type: cbType,
      };
    }
    case 'post /api/color-vision/identify-product-color':
      return deepClone(MOCK_COLOR_IDENTIFICATION);
    case 'post /api/color-vision/detect-type':
      return detectColorBlindType(body.quiz_answers || []);
    case 'get /api/color-vision/ishihara-plates':
      return { plates: deepClone(ISHIHARA_PLATES), total: ISHIHARA_PLATES.length };
    case 'post /api/color-vision/generate-palette': {
      const cbType = body.cb_type || 'deuteranopia';
      const skinToneLab = body.skin_tone_lab || { L: 65.2, a: 12.3, b: 18.5 };
      return { palette: generateCustomPalette(cbType, skinToneLab), cb_type: cbType };
    }

    default:
      throw new Error(`[mockServer] No handler for ${method.toUpperCase()} ${path}`);
  }
}

// ── Axios adapter ────────────────────────────────────────────────────

/**
 * Axios adapter that resolves every /api request against handleMockRoute,
 * mimicking a real HTTP round-trip (including a little latency so loading
 * states behave like the real backend).
 */
export const mockAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const method = (config.method || 'get').toLowerCase();
  const fullPath = `${config.baseURL || ''}${config.url || ''}`;

  const params = (config.params || {}) as Params;
  let body: Body = {};
  if (typeof config.data === 'string' && config.data) {
    try { body = JSON.parse(config.data); } catch { body = {}; }
  } else if (config.data && typeof config.data === 'object') {
    body = config.data as Body;
  }

  await new Promise(resolve => setTimeout(resolve, 150));

  const data = handleMockRoute(method, fullPath, params, body);

  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  } as AxiosResponse;
};
