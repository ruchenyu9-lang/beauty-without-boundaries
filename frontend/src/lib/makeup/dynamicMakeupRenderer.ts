/**
 * Dynamic Makeup Renderer — 妆容逐帧 Canvas 2D 绘制引擎
 *
 * 原理：抖音/滤镜同款——每一帧基于 MediaPipe 468 关键点实时动态绘制妆容 Path，
 * Canvas 尺寸与视频帧 1:1 绝对重合（Pixel-Perfect Overlay），无坐标偏移。
 *
 * 核心技术:
 * - 妆容 Path 基于**当前帧**关键点坐标动态生成 → 转头/倾斜时透视自动跟随
 * - globalCompositeOperation 实现自然叠加: soft-light / overlay / multiply
 * - createRadialGradient + ctx.filter = 'blur(...)' 实现腮红渐变
 * - 视频帧与 Canvas 尺寸绝对 1:1，像素级贴合
 *
 * 镜像策略:
 * - 前置摄像头视频使用 CSS `transform: scaleX(-1)` 实现自拍镜像
 * - Canvas 同样使用 CSS `scaleX(-1)` 镜像，与视频方向一致
 * - 绘图坐标使用 MediaPipe 原始 landmark x（不做 (1-x) 翻转），
 *   由 CSS 负责水平翻转，确保"用户向左歪头，妆容也向左歪头"方向同步
 */

import { NormalizedLandmark } from '@mediapipe/tasks-vision';

// ── Makeup region color configuration ────────────────────────

export interface MakeupConfig {
  lips?: { color: string; opacity: number; blendMode: 'overlay' | 'soft-light' | 'normal' };
  blush?: { color: string; opacity: number; blendMode: 'soft-light' };
  eyeshadowUpper?: { color: string; opacity: number; blendMode: 'overlay' | 'soft-light' };
  eyeshadowCrease?: { color: string; opacity: number; blendMode: 'multiply' };
  eyebrow?: { color: string; opacity: number; blendMode: 'soft-light' };
  contour?: { color: string; opacity: number; blendMode: 'multiply' };
  highlight?: { color: string; opacity: number; blendMode: 'soft-light' };
}

// ── Landmark index groups ────────────────────────────────────

// Lips outer ring (perimeter path)
const LIPS_OUTER = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
];

// Lips upper inner line (Cupid's bow)
const LIPS_UPPER_INNER = [78, 191, 80, 81, 82, 13];

// Lips lower inner line
const LIPS_LOWER_INNER = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

// Left upper eyelid outline
const LEFT_UPPER_LID = [33, 24, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7, 33];

// Right upper eyelid outline
const RIGHT_UPPER_LID = [263, 254, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 388, 249, 263];

// Left eye crease (折痕线)
const LEFT_CREASE = [70, 63, 105, 66, 107, 55, 65, 52, 53, 56];

// Right eye crease
const RIGHT_CREASE = [300, 293, 334, 296, 336, 285, 295, 282, 283, 286];

// Left eyebrow
const LEFT_EYEBROW = [46, 53, 52, 65, 55, 107, 66, 105, 63, 70];

// Right eyebrow
const RIGHT_EYEBROW = [276, 283, 282, 295, 285, 336, 296, 334, 293, 300];

// Left cheekbone (for blush center + spread)
const LEFT_CHEEK = [116, 117, 118, 119, 120, 121, 128, 188, 205, 206, 207, 215, 216, 34, 35, 36, 124, 125, 126, 127];

// Right cheekbone
const RIGHT_CHEEK = [345, 346, 347, 348, 349, 357, 412, 425, 426, 427, 435, 436, 264, 265, 266, 353, 354, 355, 356];

// Nose bridge (for contour)
const NOSE_BRIDGE = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2];

// Nose wings (for contour shading)
const LEFT_NOSE_WING = [98, 97, 327, 139, 51, 131, 49, 102, 103, 104, 108, 69];
const RIGHT_NOSE_WING = [278, 277, 328, 281, 280, 361, 279, 330, 331, 332, 333, 299];

// Forehead highlight region
const FOREHEAD = [10, 151, 108, 109, 337, 338, 67, 69, 104, 297, 299, 333, 9, 8, 7, 6, 21, 71, 68];

// ── Core Renderer ────────────────────────────────────────────

export class DynamicMakeupRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private width: number = 0;
  private height: number = 0;
  private config: MakeupConfig | null = null;
  // Separate canvas for blend mode compositing (internal, not in DOM)
  private blendCanvas: HTMLCanvasElement;
  private blendCtx: CanvasRenderingContext2D;

  constructor() {
    this.blendCanvas = document.createElement('canvas');
    this.blendCtx = this.blendCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  /**
   * Initialize the renderer with a canvas element provided by React.
   * This must be called before any rendering can occur.
   */
  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    // Apply previously set dimensions if setSize was called before init
    if (this.width > 0 && this.height > 0) {
      canvas.width = this.width;
      canvas.height = this.height;
    }
  }

  /**
   * Resize canvas to match video dimensions exactly (1:1 pixel mapping).
   * Only resizes when dimensions actually change to avoid resetting the
   * canvas context every frame.
   */
  setSize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.blendCanvas.width = width;
    this.blendCanvas.height = height;
  }

  /** Update makeup configuration. */
  setConfig(config: MakeupConfig): void {
    this.config = config;
  }

  /**
   * Render one frame: draw all makeup on canvas based on current landmarks.
   * Called every animation frame — landmarks are ALWAYS the current-frame values,
   * so makeup follows head turns and perspective naturally.
   */
  renderFrame(landmarks: NormalizedLandmark[]): void {
    if (!this.config || !this.ctx || this.width === 0) return;

    const ctx = this.ctx;

    // Clear entire canvas
    ctx.clearRect(0, 0, this.width, this.height);

    // ── Render each makeup layer ──────────────────────────────
    // Order matters: contour first (multiply darkens), then blush/eyeshadow,
    // then highlight, then lips last (most visible).

    if (this.config.contour) this.drawContour(landmarks, this.config.contour);
    if (this.config.eyeshadowCrease) this.drawCrease(landmarks, this.config.eyeshadowCrease);
    if (this.config.eyeshadowUpper) this.drawEyeshadow(landmarks, this.config.eyeshadowUpper);
    if (this.config.eyebrow) this.drawEyebrow(landmarks, this.config.eyebrow);
    if (this.config.blush) this.drawBlush(landmarks, this.config.blush);
    if (this.config.highlight) this.drawHighlight(landmarks, this.config.highlight);
    if (this.config.lips) this.drawLips(landmarks, this.config.lips);
  }

  // ── Helper: landmark → pixel coordinate ──────────────────
  //
  // 镜像策略: 视频和 Canvas 都使用 CSS `transform: scaleX(-1)` 实现自拍镜像。
  // 因此绘图坐标直接使用 MediaPipe 原始 landmark x 值（不做 (1-x) 翻转），
  // 让 CSS 负责水平翻转，确保妆容方向与镜像视频完全同步：
  //   landmark x=0 (camera-left = user-right face) → pixel 0 → CSS scaleX(-1) → display right
  //   与视频一致: camera-left → CSS scaleX(-1) → display right ✓

  private lm2px(landmarks: NormalizedLandmark[], idx: number): [number, number] {
    const lm = landmarks[idx];
    // Use raw landmark coordinates — CSS scaleX(-1) handles the horizontal mirror
    return [lm.x * this.width, lm.y * this.height];
  }

  // ── Helper: draw closed path from landmark indices ──────

  private tracePath(
    ctx: CanvasRenderingContext2D,
    landmarks: NormalizedLandmark[],
    indices: number[],
  ): void {
    ctx.beginPath();
    const [x0, y0] = this.lm2px(landmarks, indices[0]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < indices.length; i++) {
      const [x, y] = this.lm2px(landmarks, indices[i]);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // ── Helper: draw smooth curve path from landmark indices ──

  private traceSmoothPath(
    ctx: CanvasRenderingContext2D,
    landmarks: NormalizedLandmark[],
    indices: number[],
  ): void {
    if (indices.length < 3) return;
    ctx.beginPath();
    const points = indices.map(i => this.lm2px(landmarks, i));

    // Use quadratic bezier for smooth curves through all points
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i][0] + points[i + 1][0]) / 2;
      const yc = (points[i][1] + points[i + 1][1]) / 2;
      ctx.quadraticCurveTo(points[i][0], points[i][1], xc, yc);
    }
    // Last point
    const last = points[points.length - 1];
    ctx.quadraticCurveTo(points[points.length - 2][0], points[points.length - 2][1], last[0], last[1]);
    ctx.closePath();
  }

  // ── Helper: apply blend mode draw ────────────────────────
  // For blend modes like soft-light/multiply/overlay, we draw on
  // a separate canvas first, then composite onto the main canvas.
  // This ensures the blend mode applies correctly against the
  // existing makeup layers (not just transparent background).

  private drawWithBlendMode(
    drawFn: (ctx: CanvasRenderingContext2D) => void,
    blendMode: GlobalCompositeOperation,
    opacity: number,
  ): void {
    if (!this.ctx) return;

    if (blendMode === 'source-over') {
      // Normal drawing — just draw directly with opacity
      this.ctx.save();
      this.ctx.globalAlpha = opacity;
      drawFn(this.ctx);
      this.ctx.restore();
      return;
    }

    // For blend modes: draw on separate canvas, then composite
    this.blendCtx.clearRect(0, 0, this.width, this.height);
    this.blendCtx.save();
    this.blendCtx.globalAlpha = opacity;
    drawFn(this.blendCtx);
    this.blendCtx.restore();

    // Composite onto main canvas with blend mode
    this.ctx.save();
    this.ctx.globalCompositeOperation = blendMode;
    this.ctx.drawImage(this.blendCanvas, 0, 0);
    this.ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════
  // ── Makeup Drawing Functions ────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  /** ── LIPS ──────────────────────────────────────────────── */
  private drawLips(landmarks: NormalizedLandmark[], cfg: { color: string; opacity: number; blendMode: 'overlay' | 'soft-light' | 'normal' }): void {
    const blendMode: GlobalCompositeOperation = cfg.blendMode === 'normal' ? 'source-over' : cfg.blendMode;

    this.drawWithBlendMode((ctx) => {
      // Draw outer lip shape with smooth curves
      this.traceSmoothPath(ctx, landmarks, LIPS_OUTER);
      ctx.fillStyle = cfg.color;
      ctx.fill();

      // Feather edges with subtle blur
      ctx.save();
      ctx.filter = 'blur(3px)';
      this.traceSmoothPath(ctx, landmarks, LIPS_OUTER);
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.restore();
    }, blendMode, cfg.opacity);
  }

  /** ── BLUSH ─────────────────────────────────────────────── */
  private drawBlush(landmarks: NormalizedLandmark[], cfg: { color: string; opacity: number; blendMode: 'soft-light' }): void {
    // Left cheek blush: radial gradient centered on cheekbone
    this.drawWithBlendMode((ctx) => {
      // Left cheek center point
      const [cxL, cyL] = this.lm2px(landmarks, 121); // cheekbone center
      // Radius: distance from center to cheek edge
      const [edgeLx, edgeLy] = this.lm2px(landmarks, 116);
      const radiusL = Math.sqrt((cxL - edgeLx) ** 2 + (cyL - edgeLy) ** 2) * 1.8;

      const gradL = ctx.createRadialGradient(cxL, cyL, 0, cxL, cyL, radiusL);
      gradL.addColorStop(0, cfg.color);
      gradL.addColorStop(0.6, cfg.color);
      gradL.addColorStop(1, 'rgba(0,0,0,0)'); // fade to transparent at edges

      ctx.filter = 'blur(12px)';
      ctx.beginPath();
      ctx.arc(cxL, cyL, radiusL, 0, Math.PI * 2);
      ctx.fillStyle = gradL;
      ctx.fill();
      ctx.filter = 'none';

      // Right cheek blush (same technique)
      const [cxR, cyR] = this.lm2px(landmarks, 351);
      const [edgeRx, edgeRy] = this.lm2px(landmarks, 345);
      const radiusR = Math.sqrt((cxR - edgeRx) ** 2 + (cyR - edgeRy) ** 2) * 1.8;

      const gradR = ctx.createRadialGradient(cxR, cyR, 0, cxR, cyR, radiusR);
      gradR.addColorStop(0, cfg.color);
      gradR.addColorStop(0.6, cfg.color);
      gradR.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.filter = 'blur(12px)';
      ctx.beginPath();
      ctx.arc(cxR, cyR, radiusR, 0, Math.PI * 2);
      ctx.fillStyle = gradR;
      ctx.fill();
      ctx.filter = 'none';
    }, 'soft-light', cfg.opacity);
  }

  /** ── EYESHADOW (Upper lid) ──────────────────────────────── */
  private drawEyeshadow(landmarks: NormalizedLandmark[], cfg: { color: string; opacity: number; blendMode: 'overlay' | 'soft-light' }): void {
    this.drawWithBlendMode((ctx) => {
      ctx.filter = 'blur(6px)';

      // Left upper eyelid
      this.traceSmoothPath(ctx, landmarks, LEFT_UPPER_LID);
      ctx.fillStyle = cfg.color;
      ctx.fill();

      // Right upper eyelid
      this.traceSmoothPath(ctx, landmarks, RIGHT_UPPER_LID);
      ctx.fillStyle = cfg.color;
      ctx.fill();

      ctx.filter = 'none';
    }, cfg.blendMode, cfg.opacity);
  }

  /** ── EYESHADOW CREASE ─────────────────────────────────── */
  private drawCrease(landmarks: NormalizedLandmark[], cfg: { color: string; opacity: number; blendMode: 'multiply' }): void {
    this.drawWithBlendMode((ctx) => {
      ctx.filter = 'blur(4px)';
      ctx.lineWidth = Math.max(3, this.width * 0.006);

      // Left crease line
      this.traceSmoothPath(ctx, landmarks, LEFT_CREASE);
      ctx.strokeStyle = cfg.color;
      ctx.stroke();

      // Right crease line
      this.traceSmoothPath(ctx, landmarks, RIGHT_CREASE);
      ctx.strokeStyle = cfg.color;
      ctx.stroke();

      ctx.filter = 'none';
    }, 'multiply', cfg.opacity);
  }

  /** ── EYEBROW ───────────────────────────────────────────── */
  private drawEyebrow(landmarks: NormalizedLandmark[], cfg: { color: string; opacity: number; blendMode: 'soft-light' }): void {
    this.drawWithBlendMode((ctx) => {
      ctx.filter = 'blur(4px)';
      ctx.lineWidth = Math.max(4, this.width * 0.008);

      // Left eyebrow
      this.traceSmoothPath(ctx, landmarks, LEFT_EYEBROW);
      ctx.strokeStyle = cfg.color;
      ctx.stroke();

      // Right eyebrow
      this.traceSmoothPath(ctx, landmarks, RIGHT_EYEBROW);
      ctx.strokeStyle = cfg.color;
      ctx.stroke();

      ctx.filter = 'none';
    }, 'soft-light', cfg.opacity);
  }

  /** ── CONTOUR (Nose shadow + jaw shadow) ───────────────── */
  private drawContour(landmarks: NormalizedLandmark[], cfg: { color: string; opacity: number; blendMode: 'multiply' }): void {
    this.drawWithBlendMode((ctx) => {
      ctx.filter = 'blur(8px)';

      // Left nose wing shadow
      this.traceSmoothPath(ctx, landmarks, LEFT_NOSE_WING);
      ctx.fillStyle = cfg.color;
      ctx.fill();

      // Right nose wing shadow
      this.traceSmoothPath(ctx, landmarks, RIGHT_NOSE_WING);
      ctx.fillStyle = cfg.color;
      ctx.fill();

      // Nose bridge line (thin shadow line along the bridge)
      ctx.lineWidth = Math.max(2, this.width * 0.004);
      ctx.beginPath();
      const pts = NOSE_BRIDGE.map(i => this.lm2px(landmarks, i));
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.strokeStyle = cfg.color;
      ctx.stroke();

      ctx.filter = 'none';
    }, 'multiply', cfg.opacity);
  }

  /** ── HIGHLIGHT ────────────────────────────────────────── */
  private drawHighlight(landmarks: NormalizedLandmark[], cfg: { color: string; opacity: number; blendMode: 'soft-light' }): void {
    this.drawWithBlendMode((ctx) => {
      ctx.filter = 'blur(10px)';

      // Forehead highlight (broad area)
      this.traceSmoothPath(ctx, landmarks, FOREHEAD);
      ctx.fillStyle = cfg.color;
      ctx.fill();

      // Nose bridge highlight
      ctx.lineWidth = Math.max(3, this.width * 0.005);
      ctx.beginPath();
      const pts = NOSE_BRIDGE.map(i => this.lm2px(landmarks, i));
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.strokeStyle = cfg.color;
      ctx.stroke();

      // Cheekbone highlights (small bright spots)
      const [cxL, cyL] = this.lm2px(landmarks, 121);
      const [cxR, cyR] = this.lm2px(landmarks, 351);
      const r = Math.max(10, this.width * 0.03);

      const gradL = ctx.createRadialGradient(cxL, cyL, 0, cxL, cyL, r);
      gradL.addColorStop(0, cfg.color);
      gradL.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cxL, cyL, r, 0, Math.PI * 2);
      ctx.fillStyle = gradL;
      ctx.fill();

      const gradR = ctx.createRadialGradient(cxR, cyR, 0, cxR, cyR, r);
      gradR.addColorStop(0, cfg.color);
      gradR.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cxR, cyR, r, 0, Math.PI * 2);
      ctx.fillStyle = gradR;
      ctx.fill();

      ctx.filter = 'none';
    }, 'soft-light', cfg.opacity);
  }

  /** Clear all makeup (reset canvas). */
  clear(): void {
    if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height);
    this.config = null;
  }

  /** Release references (canvas DOM element is owned by React). */
  dispose(): void {
    this.canvas = null;
    this.ctx = null;
    this.config = null;
  }
}
