/**
 * 多感官色彩翻译：基于 HSL + WCAG 相对亮度生成自然语言描述，
 * 并叠加标准色盲模拟结果，输出每种色觉视角下的额外说明。
 */

import { simulateColorBlindness } from './daltonize';
import type { ColorBlindType, ColorMetrics, ColorTranslation, SenseKey } from '../../types/colorVision';

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (delta > 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === rn) h = ((gn - bn) / delta + (gn < bn ? 6 : 0));
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const linear = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function hueName(h: number, s: number, l: number): string {
  if (s < 10) {
    if (l > 88) return '雾白色';
    if (l > 65) return '浅灰色';
    if (l > 35) return '中灰色';
    return '炭黑色';
  }
  if (h < 12 || h >= 345) return l < 40 ? '深酒红' : '珊瑚粉';
  if (h < 35) return l < 40 ? '焦糖棕' : '暖橘色';
  if (h < 65) return l < 40 ? '橄榄棕' : '奶油黄';
  if (h < 95) return l < 40 ? '苔绿色' : '嫩草绿';
  if (h < 155) return l < 40 ? '墨绿色' : '薄荷绿';
  if (h < 195) return l < 40 ? '深海青' : '湖蓝色';
  if (h < 250) return l < 40 ? '藏蓝色' : '天空蓝';
  if (h < 290) return l < 40 ? '深紫色' : '薰衣草紫';
  return l < 40 ? '梅子紫' : '玫瑰粉';
}

function lightnessWord(l: number): string {
  if (l > 82) return '极浅';
  if (l > 62) return '偏浅';
  if (l > 40) return '中等';
  if (l > 22) return '偏深';
  return '极深';
}

/** 获取颜色度量：亮度、色相、饱和度与自然语言名。 */
export function getColorMetrics(hex: string): ColorMetrics {
  const [r, g, b] = parseHex(hex);
  const [hue, saturation, lightness] = rgbToHsl(r, g, b);
  const luminance = relativeLuminance(r, g, b);
  const warmth: ColorMetrics['warmth'] =
    (hue < 70 || hue >= 330) && saturation > 12 ? '暖调' :
    hue >= 170 && hue <= 260 && saturation > 12 ? '冷调' : '中性调';
  const undertone =
    hue < 35 || hue >= 330 ? '红橙底调' :
    hue < 70 ? '金黄底调' :
    hue < 170 ? '绿调' :
    hue < 260 ? '蓝青底调' : '紫粉底调';

  return {
    hex: hex.toUpperCase(),
    luminance: Math.round(luminance * 1000) / 1000,
    hue,
    saturation,
    lightness,
    name: hueName(hue, saturation, lightness),
    undertone,
    warmth,
  };
}

function perceive(hex: string, type: ColorBlindType): string {
  const simulated = simulateColorBlindness(hex, type);
  const metrics = getColorMetrics(simulated);
  return `${metrics.name}（亮度 ${(metrics.luminance * 100).toFixed(0)}%，偏${metrics.undertone}）`;
}

const SENSE_LABELS: Record<SenseKey, string> = {
  normal: '原始色',
  protanopia: '红盲视角',
  deuteranopia: '绿盲视角',
  tritanopia: '蓝盲视角',
};

/** 生成完整色彩翻译：原始色 + 三种色盲视角描述。 */
export function translateColor(hex: string): ColorTranslation {
  const metrics = getColorMetrics(hex);
  const descriptions: Record<SenseKey, string> = {
    normal: `${SENSE_LABELS.normal}：${lightnessWord(metrics.lightness)}${metrics.warmth}${metrics.name}，色相 ${metrics.hue}°，饱和度 ${metrics.saturation}%。`,
    protanopia: `${SENSE_LABELS.protanopia}：${perceive(hex, 'protanopia')}。`,
    deuteranopia: `${SENSE_LABELS.deuteranopia}：${perceive(hex, 'deuteranopia')}。`,
    tritanopia: `${SENSE_LABELS.tritanopia}：${perceive(hex, 'tritanopia')}。`,
  };

  return {
    sourceHex: metrics.hex,
    metrics,
    descriptions,
    story: `${metrics.warmth}${metrics.name}，${lightnessWord(metrics.lightness)}亮度，${metrics.undertone}。${descriptions.protanopia} ${descriptions.deuteranopia}`,
  };
}

/** 兼容旧调用：单色 + 指定类型的简短描述。 */
export function describeColor(hex: string, cbType: ColorBlindType = 'none'): string {
  const translation = translateColor(hex);
  return cbType === 'none'
    ? translation.descriptions.normal
    : translation.descriptions[cbType];
}
