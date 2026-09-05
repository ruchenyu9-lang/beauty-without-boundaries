/**
 * Daltonize color enhancement algorithm (Brettel/Viénot/Mollon 1997).
 * Client-side implementation matching server-side color_vision_service.py.
 */

import type { ColorBlindType } from '../../types/colorVision';

const CB_MATRICES: Record<string, {
  simulate: number[][];
  shift: number[][];
}> = {
  protanopia: {
    simulate: [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
    shift: [[0, 0, 0], [0.700, 1, 0], [0.300, 0, 1]],
  },
  deuteranopia: {
    simulate: [[0.625, 0.375, 0], [0.700, 0.300, 0], [0, 0.300, 0.700]],
    shift: [[0, 0, 0], [1, 0.700, 0], [0, 0.300, 1]],
  },
  tritanopia: {
    simulate: [[0.950, 0.050, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]],
    shift: [[1, 0.700, 0], [0, 0, 0], [0, 0.300, 1]],
  },
};

function mat3MulVec3(mat: number[][], vec: number[]): number[] {
  return [
    mat[0][0] * vec[0] + mat[0][1] * vec[1] + mat[0][2] * vec[2],
    mat[1][0] * vec[0] + mat[1][1] * vec[1] + mat[1][2] * vec[2],
    mat[2][0] * vec[0] + mat[2][1] * vec[1] + mat[2][2] * vec[2],
  ];
}

/** Apply Daltonize correction to a single RGB pixel. */
export function daltonizePixel(
  r: number, g: number, b: number, cbType: ColorBlindType,
): [number, number, number] {
  const matrices = CB_MATRICES[cbType] || CB_MATRICES.deuteranopia;
  const rgbN = [r / 255, g / 255, b / 255];
  const simulated = mat3MulVec3(matrices.simulate, rgbN);
  const error = [rgbN[0] - simulated[0], rgbN[1] - simulated[1], rgbN[2] - simulated[2]];
  const shifted = mat3MulVec3(matrices.shift, error);
  return [
    Math.round(Math.max(0, Math.min(255, (rgbN[0] + shifted[0]) * 255))),
    Math.round(Math.max(0, Math.min(255, (rgbN[1] + shifted[1]) * 255))),
    Math.round(Math.max(0, Math.min(255, (rgbN[2] + shifted[2]) * 255))),
  ];
}

/** Simulate how a CB person sees a pixel (no correction). */
export function simulateCBPixel(
  r: number, g: number, b: number, cbType: ColorBlindType,
): [number, number, number] {
  const matrices = CB_MATRICES[cbType] || CB_MATRICES.deuteranopia;
  const rgbN = [r / 255, g / 255, b / 255];
  const simulated = mat3MulVec3(matrices.simulate, rgbN);
  return [
    Math.round(simulated[0] * 255),
    Math.round(simulated[1] * 255),
    Math.round(simulated[2] * 255),
  ];
}

/** Apply Daltonize to full ImageData (for canvas rendering). */
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

/** Convert hex color with Daltonize. */
export function daltonizeHex(hex: string, cbType: ColorBlindType): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const [dr, dg, db] = daltonizePixel(r, g, b, cbType);
  return '#' + [dr, dg, db].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Simulate hex color with CB. */
export function simulateCBHex(hex: string, cbType: ColorBlindType): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const [sr, sg, sb] = simulateCBPixel(r, g, b, cbType);
  return '#' + [sr, sg, sb].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('').toUpperCase();
}
