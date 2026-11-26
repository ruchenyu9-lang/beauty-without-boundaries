import type { AnalysisResult, DetectedProduct, StepInstruction, SubstituteResult } from '../../types/api';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface ExtractedColors {
  foundation: Rgb;
  eyeshadow: Rgb;
  blush: Rgb;
  lips: Rgb;
  highlight: Rgb;
  overall: Rgb;
}

const CANVAS_SIZE = 200;
const PREVIEW_SIZE = 200;
const FALLBACK_PIXEL: Rgb = { r: 212, g: 165, b: 116 };

/** getImageData 失败时的蜜桃色兜底，保证分析流程一定完成。 */
export const PEACH_FALLBACK_COLORS: ExtractedColors = {
  foundation: { r: 245, g: 213, b: 184 },
  eyeshadow: { r: 201, g: 169, b: 110 },
  blush: { r: 232, g: 168, b: 124 },
  lips: { r: 212, g: 115, b: 94 },
  highlight: { r: 240, g: 216, b: 192 },
  overall: { r: 230, g: 180, b: 150 },
};

/** 过滤过白/过黑/透明像素后，对矩形区域求平均 RGB。 */
function averageRegion(
  imageData: ImageData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Rgb {
  const { width, height, data } = imageData;
  const startX = Math.max(0, Math.floor(x0 * width));
  const endX = Math.min(width, Math.ceil(x1 * width));
  const startY = Math.max(0, Math.floor(y0 * height));
  const endY = Math.min(height, Math.ceil(y1 * height));

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const i = (y * width + x) * 4;
      const pr = data[i];
      const pg = data[i + 1];
      const pb = data[i + 2];
      const pa = data[i + 3];
      const brightness = (pr + pg + pb) / 3;
      const spread = Math.max(pr, pg, pb) - Math.min(pr, pg, pb);

      if (pa < 128 || brightness < 28 || brightness > 242 || spread < 5) continue;

      r += pr;
      g += pg;
      b += pb;
      count += 1;
    }
  }

  if (count === 0) return { ...FALLBACK_PIXEL };
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  };
}

export function rgbToHex(color?: Rgb): string {
  if (!color) return '#D4A574';
  const { r, g, b } = color;
  return `#${[r, g, b]
    .map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

function blendRgb(a: Rgb, b: Rgb): Rgb {
  return {
    r: Math.round((a.r + b.r) / 2),
    g: Math.round((a.g + b.g) / 2),
    b: Math.round((a.b + b.b) / 2),
  };
}

/** 从 ImageData 中提取各区域颜色。 */
function extractColorsFromImageData(imageData: ImageData): ExtractedColors {
  const leftCheek = averageRegion(imageData, 0.14, 0.45, 0.34, 0.65);
  const rightCheek = averageRegion(imageData, 0.66, 0.45, 0.86, 0.65);

  return {
    lips: averageRegion(imageData, 0.38, 0.58, 0.62, 0.78),
    eyeshadow: averageRegion(imageData, 0.30, 0.30, 0.70, 0.45),
    blush: blendRgb(leftCheek, rightCheek),
    foundation: averageRegion(imageData, 0.22, 0.22, 0.78, 0.78),
    highlight: averageRegion(imageData, 0.36, 0.14, 0.64, 0.28),
    overall: averageRegion(imageData, 0, 0, 1, 1),
  };
}

/**
 * 上传文件先经 URL.createObjectURL(file) 加载，再用 Canvas 缩到 200x200。
 * 预览和后续像素读取都使用这张小图，避免大图解码/取色阻塞主线程。
 * 全程不转 Base64。
 */
export function createDownscaledImageUrl(file: File, size = PREVIEW_SIZE): Promise<string> {
  return new Promise(resolve => {
    const originalUrl = URL.createObjectURL(file);
    let settled = false;
    const finish = (url: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(url);
    };
    const timer = window.setTimeout(() => {
      console.warn('[ImageAnalysis] 缩略图生成超时，使用原图 URL');
      finish(originalUrl);
    }, 2000);

    const image = new Image();
    image.decoding = 'async';

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(originalUrl);
          return;
        }

        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(image, 0, 0, size, size);
        canvas.toBlob(blob => {
          if (blob) {
            URL.revokeObjectURL(originalUrl);
            finish(URL.createObjectURL(blob));
          } else {
            finish(originalUrl);
          }
        }, 'image/jpeg', 0.9);
      } catch (error) {
        console.warn('[ImageAnalysis] 缩略图生成失败，使用原图 URL', error);
        finish(originalUrl);
      }
    };

    image.onerror = error => {
      console.warn('[ImageAnalysis] 原图加载失败，使用原图 URL', error);
      finish(originalUrl);
    };

    image.src = originalUrl;
  });
}

/**
 * 图片一律由 URL.createObjectURL(file) 生成并传入 src（不使用 Base64）。
 * 所有 Canvas 绘制与 getImageData 都放在 img.onload 内执行；任何异常都回退蜜桃色，
 * 绝不向页面抛出“解析失败”。
 */
export function extractColorsFromImageUrl(
  src: string,
  canvas: HTMLCanvasElement,
): Promise<ExtractedColors> {
  return new Promise(resolve => {
    let settled = false;
    let timer: number | undefined;
    const finish = (colors: ExtractedColors) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(colors);
    };

    timer = window.setTimeout(() => {
      console.warn('[ImageAnalysis] 图片解析超时，使用兜底色');
      finish(PEACH_FALLBACK_COLORS);
    }, 5000);

    const image = new Image();
    image.crossOrigin = 'Anonymous';
    image.decoding = 'async';

    image.onload = () => {
      try {
        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          console.warn('[ImageAnalysis] Canvas 2D 不可用，使用兜底色');
          finish(PEACH_FALLBACK_COLORS);
          return;
        }

        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        // 先把整张图绘制到 200x200 画布，再读像素，避免大图 getImageData 卡顿。
        console.log('[ImageAnalysis] canvas downscaled to 200x200 before getImageData');
        ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        finish(extractColorsFromImageData(imageData));
      } catch (error) {
        console.warn('[ImageAnalysis] getImageData 异常，使用兜底色', error);
        finish(PEACH_FALLBACK_COLORS);
      }
    };

    image.onerror = error => {
      console.warn('[ImageAnalysis] 图片加载失败，使用兜底色', error);
      finish(PEACH_FALLBACK_COLORS);
    };

    image.src = src;
  });
}

function judgeStyle(colors: ExtractedColors): {
  detected_style: string;
  difficulty_level: string;
  suitable_skin_tones: string;
} {
  const { r, g, b } = colors.lips;
  const overallBrightness = (colors.overall.r + colors.overall.g + colors.overall.b) / 3;
  const redDominance = r - Math.max(g, b);

  if (redDominance > 45) {
    return {
      detected_style: '复古红唇妆 · Vintage Red',
      difficulty_level: 'advanced',
      suitable_skin_tones: '冷调与中性肤色更出彩',
    };
  }
  if (overallBrightness < 108) {
    return {
      detected_style: '欧美轻混血 · Smoky',
      difficulty_level: 'intermediate',
      suitable_skin_tones: '适合偏白或小麦肤色',
    };
  }
  return {
    detected_style: '元气蜜桃妆 · Peach Glow',
    difficulty_level: 'easy',
    suitable_skin_tones: '适合大多数肤色，尤其暖调',
  };
}

const PRODUCT_TEMPLATES = [
  { key: 'foundation', brand: 'Lancôme', name: '兰蔻持妆粉底液', shade: 'PO-01', region: 'full_face', finish: 'dewy', intensity: 'light' },
  { key: 'eyeshadow', brand: 'YSL', name: '圣罗兰四色眼影盘', shade: '#02 玫瑰色', region: 'upper_lid', finish: 'satin', intensity: 'medium' },
  { key: 'blush', brand: '3CE', name: '3CE 单色腮红', shade: 'Rose Beige', region: 'cheek', finish: 'matte', intensity: 'medium' },
  { key: 'lips', brand: 'Armani', name: '阿玛尼红管唇釉', shade: '#405 浆果红', region: 'lip', finish: 'glossy', intensity: 'medium' },
] as const;

type ColorKey = keyof ExtractedColors;

const PALETTE_LABELS: { key: ColorKey; name: string }[] = [
  { key: 'foundation', name: '底妆色' },
  { key: 'eyeshadow', name: '眼影色' },
  { key: 'blush', name: '腮红色' },
  { key: 'lips', name: '唇色' },
  { key: 'highlight', name: '提亮色' },
];

const buildSteps = (colors: ExtractedColors): StepInstruction[] => [
  { step_number: 1, action: `以 ${rgbToHex(colors.foundation)} 打造均匀底妆`, product_type: 'foundation', color_reference: rgbToHex(colors.foundation), technique: 'blend outward', tip: '少量多次，用海绵按压更贴合', warning: '不要一次涂太厚，会显得假面', duration_estimate: '2-3分钟' },
  { step_number: 2, action: `将 ${rgbToHex(colors.eyeshadow)} 扫在上眼睑`, product_type: 'eyeshadow', color_reference: rgbToHex(colors.eyeshadow), technique: 'sweep across', tip: '从内眼角向外眼角渐变', warning: '下眼睑不要涂太重', duration_estimate: '3-4分钟' },
  { step_number: 3, action: `以 ${rgbToHex(colors.blush)} 点染颧骨`, product_type: 'blush', color_reference: rgbToHex(colors.blush), technique: 'sweep across', tip: '微笑时颧骨最高点为起点', warning: '腮红量要少，慢慢叠加', duration_estimate: '1-2分钟' },
  { step_number: 4, action: `用 ${rgbToHex(colors.lips)} 填充双唇`, product_type: 'lipstick', color_reference: rgbToHex(colors.lips), technique: 'press', tip: '先用唇刷勾勒唇形再填充', warning: '唇线不要超出自然唇缘', duration_estimate: '2-3分钟' },
];

/** 根据真实像素颜色生成完整分析结果。 */
export function buildAnalysisResult(colors: ExtractedColors): AnalysisResult {
  const style = judgeStyle(colors);
  const detected_products: DetectedProduct[] = PRODUCT_TEMPLATES.map(template => {
    const hex = rgbToHex(colors[template.key as ColorKey]);
    return {
      type: template.name,
      brand: template.brand,
      product_name: template.name,
      shade: template.shade,
      color_description: `实测色 ${hex}`,
      estimated_hex: hex,
      region: template.region,
      finish: template.finish,
      apparent_intensity: template.intensity,
    };
  });

  return {
    ...style,
    detected_products,
    color_palette: PALETTE_LABELS.map(item => ({
      name: item.name,
      hex: rgbToHex(colors[item.key]),
    })),
    step_instructions: buildSteps(colors),
  };
}

/** 本地色卡目录，按 RGB 距离给出最接近的平替，不依赖后端。 */
const LOCAL_SHADE_CATALOG = [
  { shade_id: 2, shade_name: '2D Light', shade_number: '2D', price: 129, hex_color: '#F5D5B8', brand: "L'Oréal Paris", product_name: 'True Match 真匹配粉底液', product_type: 'foundation' },
  { shade_id: 3, shade_name: '3D Light Medium', shade_number: '3D', price: 129, hex_color: '#E8C8A8', brand: "L'Oréal Paris", product_name: 'True Match 真匹配粉底液', product_type: 'foundation' },
  { shade_id: 5, shade_name: 'Colour Riche 绚亮眼影盘', shade_number: 'BR', price: 119, hex_color: '#C9A96E', brand: "L'Oréal Paris", product_name: 'Colour Riche 绚亮眼影盘', product_type: 'eyeshadow' },
  { shade_id: 25, shade_name: 'Little Book of Eye Shadow', shade_number: 'BR', price: 39, hex_color: '#D4A574', brand: 'e.l.f.', product_name: 'Little Book of Eye Shadow', product_type: 'eyeshadow' },
  { shade_id: 14, shade_name: 'Soft Peach 柔蜜桃', shade_number: '140', price: 99, hex_color: '#E8A87C', brand: "L'Oréal Paris", product_name: 'Blush Minerals 矿物腮红', product_type: 'blush' },
  { shade_id: 15, shade_name: 'Rosy Coral 珊瑚玫瑰', shade_number: '180', price: 99, hex_color: '#D4735E', brand: "L'Oréal Paris", product_name: 'Blush Minerals 矿物腮红', product_type: 'blush' },
  { shade_id: 18, shade_name: '220 Rose 玫瑰', shade_number: '220', price: 109, hex_color: '#C44569', brand: "L'Oréal Paris", product_name: 'Color Riche 绚亮唇膏', product_type: 'lipstick' },
  { shade_id: 19, shade_name: '361 Sunset Rose 日落玫瑰', shade_number: '361', price: 109, hex_color: '#D4735E', brand: "L'Oréal Paris", product_name: 'Color Riche 绚亮唇膏', product_type: 'lipstick' },
];

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

export function buildSubstitutes(colors: ExtractedColors): SubstituteResult[] {
  const colorByType: Record<string, Rgb> = {
    foundation: colors.foundation,
    eyeshadow: colors.eyeshadow,
    blush: colors.blush,
    lips: colors.lips,
  };

  return PRODUCT_TEMPLATES.map(template => {
    const source = colorByType[template.key];
    const catalogType = template.key === 'lips' ? 'lipstick' : template.key;
    const matches = LOCAL_SHADE_CATALOG
      .filter(item => item.product_type === catalogType)
      .map(item => {
        const distance = rgbDistance(source, hexToRgb(item.hex_color));
        return {
          ...item,
          delta_e: Math.round((distance / 3) * 100) / 100,
          score: Math.max(0, Math.round((1 - distance / 180) * 1000) / 1000),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return {
      original_color: rgbToHex(source),
      original_description: `${template.brand} ${template.name} 实测色`,
      substitutes: matches,
    };
  });
}
