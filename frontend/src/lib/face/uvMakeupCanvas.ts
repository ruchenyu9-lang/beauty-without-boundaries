/**
 * UV Makeup Canvas — synthesizes a 2D makeup texture on a standard face UV map.
 *
 * Reference: Procreate Face Paint uses a UV texture approach where makeup colors
 * are painted onto UV coordinate regions, then the texture is mapped onto the 3D mesh.
 *
 * This module:
 * 1. Creates an offscreen 2D Canvas (512×512) as the UV texture
 * 2. Defines UV region polygons for lips, cheeks, eyelids, etc.
 * 3. Fills each region with the makeup color at the specified opacity
 * 4. Applies Gaussian blur (feathering) for smooth edges
 * 5. Composites with blend modes (soft-light / multiply) for realistic makeup look
 */

// ── UV Region Definitions ──────────────────────────────────────
// Each region is defined as a polygon in UV space (0-1 normalized).
// These map to the canonical MediaPipe face UV coordinates.
// The UV map is a frontal face projection.

interface UVRegion {
  name: string;
  polygons: number[][];  // Array of [u, v] points forming closed polygons
  defaultOpacity: number;
  blendMode: 'soft-light' | 'multiply' | 'overlay' | 'normal';
}

export const UV_MAKEUP_REGIONS: Record<string, UVRegion> = {
  lips_upper: {
    name: '上唇',
    // Upper lip UV polygon (approximate mapping to canonical face UV)
    polygons: [
      [0.42, 0.72], [0.45, 0.70], [0.48, 0.69], [0.50, 0.685], [0.52, 0.69],
      [0.55, 0.70], [0.58, 0.72], [0.55, 0.74], [0.52, 0.75],
      [0.50, 0.755], [0.48, 0.75], [0.45, 0.74], [0.42, 0.72],
    ],
    defaultOpacity: 0.85,
    blendMode: 'normal',
  },
  lips_lower: {
    name: '下唇',
    polygons: [
      [0.42, 0.76], [0.45, 0.755], [0.48, 0.76], [0.50, 0.762],
      [0.52, 0.76], [0.55, 0.755], [0.58, 0.76],
      [0.55, 0.80], [0.52, 0.81], [0.50, 0.82],
      [0.48, 0.81], [0.45, 0.80], [0.42, 0.76],
    ],
    defaultOpacity: 0.85,
    blendMode: 'normal',
  },
  left_cheek: {
    name: '左脸颊',
    polygons: [
      [0.22, 0.60], [0.25, 0.58], [0.30, 0.56], [0.35, 0.57],
      [0.37, 0.60], [0.36, 0.64], [0.35, 0.68],
      [0.30, 0.70], [0.25, 0.68], [0.22, 0.65], [0.22, 0.60],
    ],
    defaultOpacity: 0.4,
    blendMode: 'soft-light',
  },
  right_cheek: {
    name: '右脸颊',
    polygons: [
      [0.63, 0.60], [0.65, 0.57], [0.70, 0.56], [0.75, 0.58],
      [0.78, 0.60], [0.78, 0.65], [0.75, 0.68],
      [0.70, 0.70], [0.65, 0.68], [0.63, 0.64], [0.63, 0.60],
    ],
    defaultOpacity: 0.4,
    blendMode: 'soft-light',
  },
  upper_lid_left: {
    name: '左上眼睑',
    polygons: [
      [0.30, 0.48], [0.33, 0.46], [0.36, 0.45], [0.39, 0.46],
      [0.41, 0.48], [0.39, 0.49], [0.36, 0.50],
      [0.33, 0.50], [0.30, 0.49], [0.30, 0.48],
    ],
    defaultOpacity: 0.6,
    blendMode: 'overlay',
  },
  upper_lid_right: {
    name: '右上眼睑',
    polygons: [
      [0.59, 0.48], [0.61, 0.46], [0.64, 0.45], [0.67, 0.46],
      [0.70, 0.48], [0.70, 0.49], [0.67, 0.50],
      [0.64, 0.50], [0.61, 0.49], [0.59, 0.49], [0.59, 0.48],
    ],
    defaultOpacity: 0.6,
    blendMode: 'overlay',
  },
  crease_left: {
    name: '左眼折痕',
    polygons: [
      [0.30, 0.44], [0.33, 0.42], [0.36, 0.41], [0.39, 0.42],
      [0.41, 0.44], [0.39, 0.445], [0.36, 0.45],
      [0.33, 0.445], [0.30, 0.445], [0.30, 0.44],
    ],
    defaultOpacity: 0.6,
    blendMode: 'multiply',
  },
  crease_right: {
    name: '右眼折痕',
    polygons: [
      [0.59, 0.44], [0.61, 0.42], [0.64, 0.41], [0.67, 0.42],
      [0.70, 0.44], [0.70, 0.445], [0.67, 0.45],
      [0.64, 0.445], [0.61, 0.445], [0.59, 0.445], [0.59, 0.44],
    ],
    defaultOpacity: 0.6,
    blendMode: 'multiply',
  },
  forehead: {
    name: '额头',
    polygons: [
      [0.30, 0.28], [0.35, 0.26], [0.40, 0.25], [0.45, 0.24],
      [0.50, 0.24], [0.55, 0.24], [0.60, 0.25],
      [0.65, 0.26], [0.70, 0.28], [0.65, 0.30],
      [0.60, 0.32], [0.55, 0.33], [0.50, 0.34],
      [0.45, 0.33], [0.40, 0.32], [0.35, 0.30], [0.30, 0.28],
    ],
    defaultOpacity: 0.3,
    blendMode: 'soft-light',
  },
  nose: {
    name: '鼻部',
    polygons: [
      [0.47, 0.45], [0.485, 0.42], [0.50, 0.40], [0.515, 0.42],
      [0.53, 0.45], [0.52, 0.50], [0.51, 0.54],
      [0.50, 0.56], [0.49, 0.54], [0.48, 0.50], [0.47, 0.45],
    ],
    defaultOpacity: 0.3,
    blendMode: 'soft-light',
  },
  chin: {
    name: '下巴',
    polygons: [
      [0.40, 0.83], [0.45, 0.82], [0.50, 0.84], [0.55, 0.82],
      [0.60, 0.83], [0.55, 0.88], [0.50, 0.90],
      [0.45, 0.88], [0.40, 0.83],
    ],
    defaultOpacity: 0.3,
    blendMode: 'soft-light',
  },
  cheekbone_left: {
    name: '左颧骨',
    polygons: [
      [0.24, 0.55], [0.28, 0.53], [0.32, 0.52], [0.35, 0.54],
      [0.36, 0.57], [0.34, 0.59], [0.30, 0.58],
      [0.26, 0.57], [0.24, 0.55],
    ],
    defaultOpacity: 0.4,
    blendMode: 'soft-light',
  },
  cheekbone_right: {
    name: '右颧骨',
    polygons: [
      [0.64, 0.55], [0.65, 0.54], [0.68, 0.52], [0.72, 0.53],
      [0.76, 0.55], [0.76, 0.57], [0.72, 0.58],
      [0.68, 0.59], [0.66, 0.57], [0.64, 0.55],
    ],
    defaultOpacity: 0.4,
    blendMode: 'soft-light',
  },
};

// ── UV Makeup Canvas Renderer ──────────────────────────────────

const UV_CANVAS_SIZE = 512;

export class UvMakeupCanvas {
  private canvas: OffscreenCanvas | HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size: number = UV_CANVAS_SIZE;
  // Separate canvas for blending (compositing)
  private blendCanvas: OffscreenCanvas | HTMLCanvasElement;
  private blendCtx: CanvasRenderingContext2D;
  private baseCanvas: OffscreenCanvas | HTMLCanvasElement;
  private baseCtx: CanvasRenderingContext2D;

  constructor() {
    // Try OffscreenCanvas first, fallback to regular Canvas
    try {
      this.canvas = new OffscreenCanvas(this.size, this.size);
      this.blendCanvas = new OffscreenCanvas(this.size, this.size);
      this.baseCanvas = new OffscreenCanvas(this.size, this.size);
    } catch {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.size;
      this.canvas.height = this.size;
      this.blendCanvas = document.createElement('canvas');
      this.blendCanvas.width = this.size;
      this.blendCanvas.height = this.size;
      this.baseCanvas = document.createElement('canvas');
      this.baseCanvas.width = this.size;
      this.baseCanvas.height = this.size;
    }

    // Canvas union type returns a union 2D context; both support the drawing ops used here.
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.blendCtx = this.blendCanvas.getContext('2d') as CanvasRenderingContext2D;
    this.baseCtx = this.baseCanvas.getContext('2d') as CanvasRenderingContext2D;
    this.clear();
  }

  /** Clear the UV canvas (transparent). */
  clear() {
    this.ctx.clearRect(0, 0, this.size, this.size);
    this.blendCtx.clearRect(0, 0, this.size, this.size);
    this.baseCtx.clearRect(0, 0, this.size, this.size);
  }

  /**
   * Apply makeup colors to UV regions.
   * region_colors: { "lips_upper": "#C44569", "left_cheek": "#E8A87C", ... }
   * customOpacity: optional overrides per region
   */
  applyMakeup(
    regionColors: Record<string, string>,
    customOpacity?: Record<string, number>,
  ): void {
    this.clear();

    // Phase 1: Draw each region's raw color on base canvas (for blending)
    for (const [regionKey, color] of Object.entries(regionColors)) {
      const region = UV_MAKEUP_REGIONS[regionKey];
      if (!region) continue;

      const opacity = customOpacity?.[regionKey] ?? region.defaultOpacity;

      // Draw polygon fill
      this.baseCtx.save();
      this.baseCtx.globalAlpha = opacity;
      this.baseCtx.fillStyle = color;
      this.baseCtx.beginPath();
      const pts = region.polygons;
      this.baseCtx.moveTo(pts[0][0] * this.size, pts[0][1] * this.size);
      for (let i = 1; i < pts.length; i++) {
        this.baseCtx.lineTo(pts[i][0] * this.size, pts[i][1] * this.size);
      }
      this.baseCtx.closePath();
      this.baseCtx.fill();
      this.baseCtx.restore();
    }

    // Phase 2: Apply Gaussian blur for feathering (smooth edges)
    // Use filter property for blur (supported in modern browsers)
    this.ctx.save();
    this.ctx.filter = 'blur(8px)';  // Feather radius: 8px at 512×512
    this.ctx.drawImage(this.baseCanvas as any, 0, 0);
    this.ctx.restore();

    // Phase 3: Composite with blend modes
    // For "normal" blend regions (lips), keep as-is
    // For "soft-light" / "multiply" / "overlay" regions, composite separately

    // Draw normal-blend regions directly (lips — opaque, direct color)
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'source-over';
    for (const [regionKey, color] of Object.entries(regionColors)) {
      const region = UV_MAKEUP_REGIONS[regionKey];
      if (!region || region.blendMode !== 'normal') continue;

      const opacity = customOpacity?.[regionKey] ?? region.defaultOpacity;
      this.ctx.globalAlpha = opacity;
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      const pts = region.polygons;
      this.ctx.moveTo(pts[0][0] * this.size, pts[0][1] * this.size);
      for (let i = 1; i < pts.length; i++) {
        this.ctx.lineTo(pts[i][0] * this.size, pts[i][1] * this.size);
      }
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.restore();

    // Draw blend-mode regions (soft-light for cheeks/forehead/nose, overlay/multiply for eyelids)
    const blendModeMap: Record<string, GlobalCompositeOperation> = {
      'soft-light': 'soft-light',
      'multiply': 'multiply',
      'overlay': 'overlay',
    };

    // Process each non-normal region on blend canvas first
    for (const [regionKey, color] of Object.entries(regionColors)) {
      const region = UV_MAKEUP_REGIONS[regionKey];
      if (!region || region.blendMode === 'normal') continue;

      const opacity = customOpacity?.[regionKey] ?? region.defaultOpacity;
      const compositeOp = blendModeMap[region.blendMode] || 'soft-light';

      // Draw region on blend canvas with blur
      this.blendCtx.clearRect(0, 0, this.size, this.size);
      this.blendCtx.save();
      this.blendCtx.globalAlpha = opacity * 2; // Boost for blend modes (they darken)
      this.blendCtx.fillStyle = color;
      this.blendCtx.filter = 'blur(6px)';
      this.blendCtx.beginPath();
      const pts = region.polygons;
      this.blendCtx.moveTo(pts[0][0] * this.size, pts[0][1] * this.size);
      for (let i = 1; i < pts.length; i++) {
        this.blendCtx.lineTo(pts[i][0] * this.size, pts[i][1] * this.size);
      }
      this.blendCtx.closePath();
      this.blendCtx.fill();
      this.blendCtx.restore();

      // Composite blend canvas onto main canvas with the blend mode
      this.ctx.save();
      this.ctx.globalCompositeOperation = compositeOp;
      this.ctx.drawImage(this.blendCanvas as any, 0, 0);
      this.ctx.restore();
    }

    // Phase 4: Final — soft glow pass to unify the makeup look
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.globalAlpha = 0.05; // Very subtle final glow
    this.ctx.filter = 'blur(12px)';
    this.ctx.drawImage(this.canvas as any, 0, 0);
    this.ctx.restore();
  }

  /** Get the resulting canvas as an ImageBitmap or HTMLCanvasElement. */
  getResultCanvas(): HTMLCanvasElement | OffscreenCanvas {
    return this.canvas;
  }

  /** Convert the canvas to a Three.js-compatible texture source. */
  toTextureSource(): HTMLCanvasElement {
    // Three.js texture needs HTMLCanvasElement (not OffscreenCanvas in some versions)
    if (this.canvas instanceof HTMLCanvasElement) {
      return this.canvas;
    }
    // Convert OffscreenCanvas to HTMLCanvasElement by drawing onto a regular canvas
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = this.size;
    resultCanvas.height = this.size;
    const resultCtx = resultCanvas.getContext('2d')!;
    resultCtx.drawImage(this.canvas as any, 0, 0);
    return resultCanvas;
  }
}
