/**
 * 标准色盲模拟 + Daltonize 增强算法
 *
 * 模拟矩阵：Machado, Oliveira & Fernandes (2009)，severity = 1.0，
 * 在 linear RGB 空间运算后再做 sRGB gamma 还原。
 * 增强算法：经典 Daltonize error diffusion（Brettel / Viénot / Mollon），
 * 把原色与模拟色之间的误差按通道偏移回原色，拉开色盲视角下的可辨差异。
 */

import type { ColorBlindType } from '../../types/colorVision';

const MACHADO_2009: Record<Exclude<ColorBlindType, 'none'>, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.011820, 0.042940, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.303900],
  ],
};

const DALTONIZE_SHIFT: Record<Exclude<ColorBlindType, 'none'>, number[][]> = {
  protanopia: [
    [0, 0, 0],
    [0.7, 1, 0],
    [0.3, 0, 1],
  ],
  deuteranopia: [
    [0, 0, 0],
    [1, 0.7, 0],
    [0, 0.3, 1],
  ],
  tritanopia: [
    [1, 0.7, 0],
    [0, 0, 0],
    [0, 0.3, 1],
  ],
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  const c = clamp01(channel);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

function mat3MulVec3(mat: number[][], vec: number[]): number[] {
  return [
    mat[0][0] * vec[0] + mat[0][1] * vec[1] + mat[0][2] * vec[2],
    mat[1][0] * vec[0] + mat[1][1] * vec[1] + mat[1][2] * vec[2],
    mat[2][0] * vec[0] + mat[2][1] * vec[1] + mat[2][2] * vec[2],
  ];
}

function toLinearRgb(r: number, g: number, b: number): number[] {
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

function toSrgbRgb(linear: number[]): [number, number, number] {
  return [
    clamp255(linearToSrgb(linear[0]) * 255),
    clamp255(linearToSrgb(linear[1]) * 255),
    clamp255(linearToSrgb(linear[2]) * 255),
  ];
}

/** 模拟色盲患者看到的像素颜色。none 原样返回。 */
export function simulateCBPixel(
  r: number, g: number, b: number, cbType: ColorBlindType,
): [number, number, number] {
  if (cbType === 'none') return [clamp255(r), clamp255(g), clamp255(b)];
  const linear = toLinearRgb(r, g, b);
  return toSrgbRgb(mat3MulVec3(MACHADO_2009[cbType], linear));
}

/** Daltonize：把模拟误差偏移回原色，提升该色觉类型下的可辨识度。 */
export function daltonizePixel(
  r: number, g: number, b: number, cbType: ColorBlindType,
): [number, number, number] {
  if (cbType === 'none') return [clamp255(r), clamp255(g), clamp255(b)];
  const linear = toLinearRgb(r, g, b);
  const simulated = mat3MulVec3(MACHADO_2009[cbType], linear);
  const error = [
    linear[0] - simulated[0],
    linear[1] - simulated[1],
    linear[2] - simulated[2],
  ];
  const shift = mat3MulVec3(DALTONIZE_SHIFT[cbType], error);
  return toSrgbRgb([
    clamp01(linear[0] + shift[0]),
    clamp01(linear[1] + shift[1]),
    clamp01(linear[2] + shift[2]),
  ]);
}

/** 对整帧 ImageData 做 Daltonize 增强。 */
export function daltonizeImageData(
  imageData: ImageData, cbType: ColorBlindType,
): ImageData {
  const result = new ImageData(imageData.width, imageData.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const [dr, dg, db] = daltonizePixel(
      imageData.data[i], imageData.data[i + 1], imageData.data[i + 2], cbType,
    );
    result.data[i] = dr;
    result.data[i + 1] = dg;
    result.data[i + 2] = db;
    result.data[i + 3] = imageData.data[i + 3];
  }
  return result;
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const normalized = clean.length === 3
    ? clean.split('').map(ch => ch + ch).join('')
    : clean;
  return [
    parseInt(normalized.slice(0, 2), 16) || 0,
    parseInt(normalized.slice(2, 4), 16) || 0,
    parseInt(normalized.slice(4, 6), 16) || 0,
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => clamp255(v).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/** 主 API：模拟指定色觉类型看到的 HEX 颜色。 */
export function simulateColorBlindness(hex: string, type: ColorBlindType): string {
  const [r, g, b] = parseHex(hex);
  return rgbToHex(...simulateCBPixel(r, g, b, type));
}

/** 主 API：对 HEX 颜色做 Daltonize 增强。 */
export function daltonizeColor(hex: string, type: ColorBlindType): string {
  const [r, g, b] = parseHex(hex);
  return rgbToHex(...daltonizePixel(r, g, b, type));
}

// 兼容既有调用点
export const simulateCBHex = simulateColorBlindness;
export const daltonizeHex = daltonizeColor;
