import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { OpenMakeup, type Category, type Finish } from 'open-makeup-sdk';
import type { MakeupLook } from '../../types/makeup';
import {
  MAKEUP_DEBUG,
  logApply,
  logInit,
  logLayerVisibility,
  logPatterns,
  logRenderCanvas,
  logSkip,
  probeMakeupAssets,
} from './debugOpenMakeup';

const SDK_ASSETS_BASE = 'https://cdn.jsdelivr.net/npm/open-makeup-sdk@0.1.0/assets';
const MEDIAPIPE_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619';

const SDK_CATEGORY: Record<string, Category> = {
  粉底: 'foundation',
  底妆: 'foundation',
  foundation: 'foundation',
  眼影: 'eyeshadow',
  eyeshadow: 'eyeshadow',
  腮红: 'blush',
  blush: 'blush',
  口红: 'lipstick',
  唇釉: 'lipstick',
  唇膏: 'lipstick',
  lipstick: 'lipstick',
  眼线: 'eyeline',
  eyeliner: 'eyeline',
  eyeline: 'eyeline',
  睫毛膏: 'mascara',
  mascara: 'mascara',
};

const FINISH_BY_CATEGORY: Partial<Record<Category, Finish>> = {
  foundation: 'matte',
  eyeshadow: 'shimmer',
  blush: 'matte',
  lipstick: 'glossy',
};

export function createOpenMakeup(video: HTMLVideoElement, renderCanvas: HTMLCanvasElement): OpenMakeup {
  const mk = new OpenMakeup({
    video,
    renderCanvas,
    assetsBaseUrl: SDK_ASSETS_BASE,
    mediapipeBaseUrl: MEDIAPIPE_BASE,
  });

  // UMD builds of the MediaPipe solutions attach their classes to window,
  // which is exactly where the SDK looks for them during init().
  const globals = window as unknown as {
    FaceMesh?: unknown;
    Camera?: unknown;
  };
  if (FaceMesh) globals.FaceMesh = FaceMesh;
  if (Camera) globals.Camera = Camera;
  if (!globals.FaceMesh || !globals.Camera) {
    throw new Error('MediaPipe FaceMesh / Camera 未加载，请检查依赖是否安装成功');
  }

  if (MAKEUP_DEBUG) {
    const engine = mk.engine as unknown as {
      video: HTMLVideoElement;
      renderCanvas: HTMLCanvasElement;
    };
    console.log('[OpenMakeupDebug] config', {
      assetsBaseUrl: SDK_ASSETS_BASE,
      mediapipeBaseUrl: MEDIAPIPE_BASE,
      videoBound: video === engine.video,
      canvasBound: renderCanvas === engine.renderCanvas,
    });
    void probeMakeupAssets(SDK_ASSETS_BASE);
    logRenderCanvas(renderCanvas, 'before-init');
    logInit(mk, 'before-init');
  }

  return mk;
}

/** 必须在 init 完整 resolve 之后才允许 apply。 */
export async function initOpenMakeup(mk: OpenMakeup, renderCanvas: HTMLCanvasElement): Promise<void> {
  if (MAKEUP_DEBUG) {
    await mk.init(instance => {
      logInit(instance, 'onReady');
      logPatterns(instance);
    });
    logInit(mk, 'after-init');
    logRenderCanvas(renderCanvas, 'after-init');
  } else {
    await mk.init();
  }
}

let applySequence = 0;

/** 先清空上一套妆容，再按产品类别与 HEX 色号逐层应用新方案。 */
export async function applyMakeupLook(mk: OpenMakeup, look: MakeupLook): Promise<void> {
  if (!mk.ready) {
    logSkip('mk.ready === false，init 尚未完成', { look: look.lookName, ready: mk.ready });
    return;
  }

  const token = ++applySequence;
  if (MAKEUP_DEBUG) {
    console.log('[OpenMakeupDebug] applyLook start', {
      look: look.lookName,
      style: look.style,
      products: look.products?.map(p => ({ category: p.category, hex: p.colorHex })),
    });
  }
  mk.clearAll();

  const applied = new Set<Category>();
  for (const product of look.products ?? []) {
    if (token !== applySequence) return;
    const category = SDK_CATEGORY[product.category] ?? SDK_CATEGORY[product.category.toLowerCase()];
    if (!category) {
      logSkip('未知产品类别', { category: product.category, name: product.name });
      continue;
    }
    if (applied.has(category)) continue;

    applied.add(category);
    const finish = FINISH_BY_CATEGORY[category];
    try {
      const result = await mk.apply(category, {
        color: product.colorHex,
        ...(finish ? { finish } : {}),
      });
      if (MAKEUP_DEBUG) {
        logApply(category, result);
        logLayerVisibility(mk, category);
      }
    } catch (error) {
      console.warn(`OpenMakeup: 应用 ${category} 失败`, error);
    }
  }
}

export function clearMakeup(mk: OpenMakeup): void {
  ++applySequence;
  if (MAKEUP_DEBUG) console.log('[OpenMakeupDebug] clearAll');
  mk.clearAll();
}
