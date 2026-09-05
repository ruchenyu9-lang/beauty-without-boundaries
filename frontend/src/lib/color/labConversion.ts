/**
 * RGB ↔ Lab color space conversion + CIEDE2000 deltaE (client-side).
 * Matches the server-side color_math.py implementation exactly.
 */

// ── sRGB gamma ──────────────────────────────────────────────

function linearize(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

function compress(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

// ── Constants ────────────────────────────────────────────────

const XN = 0.95047, YN = 1.0, ZN = 1.08883;

function labF(t: number): number {
  return t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116;
}

function labFInv(t: number): number {
  return t > 0.206893 ? t ** 3 : (t - 16 / 116) / 7.787;
}

// ── RGB → Lab ────────────────────────────────────────────────

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const rl = linearize(r), gl = linearize(g), bl = linearize(b);
  const X = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
  const Y = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl;
  const Z = 0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl;
  const fx = labF(X / XN), fy = labF(Y / YN), fz = labF(Z / ZN);
  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bv = 200 * (fy - fz);
  return [L, a, bv];
}

// ── Lab → RGB ────────────────────────────────────────────────

export function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
  const X = XN * labFInv(fx), Y = YN * labFInv(fy), Z = ZN * labFInv(fz);
  const rl = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  const gl = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
  const bl = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
  const r = compress(rl), g = compress(gl), bv = compress(bl);
  return [
    Math.round(Math.max(0, Math.min(255, r * 255))),
    Math.round(Math.max(0, Math.min(255, g * 255))),
    Math.round(Math.max(0, Math.min(255, bv * 255))),
  ];
}

// ── Hex helpers ──────────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function hexToLab(hex: string): [number, number, number] {
  return rgbToLab(...hexToRgb(hex));
}

export function labToHex(L: number, a: number, b: number): string {
  return rgbToHex(...labToRgb(L, a, b));
}

// ── Undertone ────────────────────────────────────────────────

export function detectUndertone(L: number, a: number, b: number): string {
  if (a > 5 && b > 15) return 'warm';
  if (a < -2 && b < 5) return 'cool';
  return 'neutral';
}

// ── CIEDE2000 ────────────────────────────────────────────────

export function deltaE2000(
  lab1: [number, number, number],
  lab2: [number, number, number],
): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const C1ab = Math.sqrt(a1 * a1 + b1 * b1);
  const C2ab = Math.sqrt(a2 * a2 + b2 * b2);
  const CabAvg = (C1ab + C2ab) / 2;
  const CabAvg7 = CabAvg ** 7;
  const G = 0.5 * (1 - Math.sqrt(CabAvg7 / (CabAvg7 + 25 ** 7)));

  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const hAngle = (a: number, b: number) => {
    if (a === 0 && b === 0) return 0;
    let h = (Math.atan2(b, a) * 180) / Math.PI;
    if (h < 0) h += 360;
    return h;
  };
  const h1p = hAngle(a1p, b1), h2p = hAngle(a2p, b2);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * Math.PI / 180);

  const LAvg = (L1 + L2) / 2;
  const CpAvg = (C1p + C2p) / 2;

  let hpAvg: number;
  if (C1p * C2p === 0) hpAvg = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hpAvg = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hpAvg = (h1p + h2p + 360) / 2;
  else hpAvg = (h1p + h2p - 360) / 2;

  const T = 1
    - 0.17 * Math.cos((hpAvg - 30) * Math.PI / 180)
    + 0.24 * Math.cos(2 * hpAvg * Math.PI / 180)
    + 0.32 * Math.cos((3 * hpAvg + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * hpAvg - 63) * Math.PI / 180);

  const SL = 1 + 0.015 * (LAvg - 50) ** 2 / Math.sqrt(20 + (LAvg - 50) ** 2);
  const SC = 1 + 0.045 * CpAvg;
  const SH = 1 + 0.015 * CpAvg * T;

  const CpAvg7 = CpAvg ** 7;
  const RT = -2
    * Math.sin((30 + Math.exp(-Math.pow((hpAvg - 275) / 25, 2))) * Math.PI / 180)
    * Math.sqrt(CpAvg7 / (CpAvg7 + 25 ** 7));

  return Math.sqrt(
    (dLp / SL) ** 2
    + (dCp / SC) ** 2
    + (dHp / SH) ** 2
    + RT * (dCp / SC) * (dHp / SH),
  );
}

export function classifyMatch(dE: number): string {
  if (dE <= 1) return 'perfect';
  if (dE <= 2) return 'excellent';
  if (dE <= 3) return 'good';
  if (dE <= 5) return 'acceptable';
  return 'different';
}
