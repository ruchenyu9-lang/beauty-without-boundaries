/**
 * 可感知调色板生成：
 * 先用 Daltonize 处理候选色，再在该色觉类型的模拟空间（Lab）里做最远点采样，
 * 选出 10 个在目标色觉用户眼中差异最大的颜色。
 */

import type { ColorBlindType, PaletteColor } from '../../types/colorVision';
import { daltonizeColor, simulateColorBlindness } from './daltonize';
import { getColorMetrics } from './colorDescriptor';
import { hexToLab } from './labConversion';

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;
  let rgb: number[];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return '#' + rgb
    .map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function labDistance(a: number[], b: number[]): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
  );
}

interface Candidate {
  hex: string;
  simulated: string;
  lab: number[];
}

export function generateAccessiblePalette(cbType: ColorBlindType): PaletteColor[] {
  const effectiveType = cbType === 'none' ? 'deuteranopia' : cbType;
  const hues = [0, 22, 45, 78, 115, 155, 195, 235, 275, 315, 345];
  const lightnesses = [30, 45, 60, 76];
  const saturations = [55, 80, 95];

  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  for (const h of hues) {
    for (const l of lightnesses) {
      for (const s of saturations) {
        const seed = hslToHex(h, s, l);
        const hex = daltonizeColor(seed, effectiveType);
        if (seen.has(hex)) continue;
        seen.add(hex);
        const simulated = simulateColorBlindness(hex, effectiveType);
        candidates.push({ hex, simulated, lab: hexToLab(simulated) });
      }
    }
  }

  const selected: Candidate[] = [];
  const first = candidates[0];
  if (first) selected.push(first);

  while (selected.length < 10 && selected.length < candidates.length) {
    let best: Candidate | null = null;
    let bestMin = -1;

    for (const candidate of candidates) {
      if (selected.includes(candidate)) continue;
      const minDistance = Math.min(
        ...selected.map(chosen => labDistance(chosen.lab, candidate.lab)),
      );
      if (minDistance > bestMin) {
        bestMin = minDistance;
        best = candidate;
      }
    }

    if (!best) break;
    selected.push(best);
  }

  return selected.map(item => {
    const metrics = getColorMetrics(item.hex);
    const simulatedMetrics = getColorMetrics(item.simulated);
    return {
      hex_color: item.hex,
      lab_values: (() => {
        const [L, a, b] = hexToLab(item.hex);
        return { L, a, b };
      })(),
      descriptive_name: metrics.name,
      perceivable_as: `${cbType === 'none' ? '通用' : `${metrics.name} →`} ${simulatedMetrics.name}`,
      simulated_hex: item.simulated,
      product_suggestions: [{
        shade_name: `${metrics.name}推荐色`,
        hex: item.hex,
        delta_e: 0,
      }],
    };
  });
}
