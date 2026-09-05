/**
 * Generate human-readable color descriptions for color-blind users.
 */

import { rgbToLab, labToRgb, hexToRgb } from './labConversion';
import { simulateCBPixel } from './daltonize';
import type { ColorBlindType } from '../../types/colorVision';

export function describeColor(
  hex: string, cbType: ColorBlindType = 'none',
): string {
  const [r, g, b] = hexToRgb(hex);
  const [L, a, bv] = rgbToLab(r, g, b);

  // Lightness
  const light = L > 80 ? '极浅' : L > 60 ? '中浅' : L > 40 ? '中等' : L > 20 ? '深色' : '极深';

  // Warmth
  let warmth: string;
  if (a > 15 && bv > 20) warmth = '暖调，玫瑰金色底调';
  else if (a > 10) warmth = '暖调，粉红色调';
  else if (bv > 20) warmth = '暖调，金色调';
  else if (a < -5 && bv < -5) warmth = '冷调，蓝绿色调';
  else if (bv < -10) warmth = '冷调，蓝色底调';
  else warmth = '中性调';

  const normalDesc = `${light} ${warmth}`;

  if (cbType === 'none') return normalDesc;

  // Describe how CB user perceives it
  const [sr, sg, sb] = simulateCBPixel(r, g, b, cbType);
  const [sL, sa, sbv] = rgbToLab(sr, sg, sb);
  const sLight = sL > 80 ? '极浅' : sL > 60 ? '中浅' : sL > 40 ? '中等' : sL > 20 ? '深色' : '极深';
  const sWarmth = sbv > 20 ? '偏暖金色调' : sbv < -10 ? '偏冷蓝色调' : '偏中性灰色调';
  return `${normalDesc}。${cbType === 'protanopia' ? '红盲' : cbType === 'deuteranopia' ? '绿盲' : '蓝盲'}用户感知为：${sLight} ${sWarmth}`;
}
