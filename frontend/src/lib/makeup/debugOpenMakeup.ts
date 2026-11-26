import type { OpenMakeup } from 'open-makeup-sdk';

/** 排查阶段打开；确认无误后改成 false 即可关闭全部日志。 */
export const MAKEUP_DEBUG = true;

const TAG = '[OpenMakeupDebug]';

type InternalEngine = {
  faceModel?: unknown;
  scene?: { children?: unknown[] };
  videoTexture?: { image?: HTMLVideoElement };
  _ready?: boolean;
  foundationMesh?: unknown;
  foundationMat?: unknown;
  blushMesh?: unknown;
  blushMat?: unknown;
  lipsMesh?: unknown;
  lipsMat?: unknown;
  eyeShadowMesh?: unknown;
  eyeShadowMat?: unknown;
  eyeLineLeftNurbs?: unknown;
  eyeLineRightNurbs?: unknown;
  eyeLineMat?: unknown;
  mascaraLeftNurbs?: unknown;
  mascaraRightNurbs?: unknown;
  mascaraMat?: unknown;
};

type CanvasLike = HTMLCanvasElement & {
  getContext(contextId: 'webgl2' | 'webgl'): WebGLRenderingContext | WebGL2RenderingContext | null;
};

export async function probeMakeupAssets(assetsBaseUrl: string): Promise<void> {
  const base = assetsBaseUrl.replace(/\/+$/, '');
  const files = [
    'patterns/patterns.json',
    'models/face.glb',
    'shaders/lip/fragment.glsl',
    'shaders/lip/vertex.glsl',
    'shaders/foundation/fragment.glsl',
    'patterns/lipstick/6427.png',
  ];

  for (const file of files) {
    const url = `${base}/${file}`;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      console.log(TAG, 'asset', file, {
        ok: res.ok,
        status: res.status,
        type: res.headers.get('content-type'),
        length: res.headers.get('content-length'),
        url,
      });
    } catch (error) {
      console.error(TAG, 'asset FETCH FAILED', url, error);
    }
  }
}

export function logInit(mk: OpenMakeup, phase: string): void {
  const engine = mk.engine as unknown as InternalEngine;
  console.log(TAG, 'init', phase, {
    ready: mk.ready,
    engineReady: engine._ready,
    categories: mk.categories,
    faceModelLoaded: Boolean(engine.faceModel),
    sceneChildren: engine.scene?.children?.length ?? -1,
    layers: {
      foundation: Boolean(engine.foundationMesh && engine.foundationMat),
      blush: Boolean(engine.blushMesh && engine.blushMat),
      lipstick: Boolean(engine.lipsMesh && engine.lipsMat),
      eyeshadow: Boolean(engine.eyeShadowMesh && engine.eyeShadowMat),
      eyeline: Boolean(engine.eyeLineLeftNurbs && engine.eyeLineRightNurbs && engine.eyeLineMat),
      mascara: Boolean(engine.mascaraLeftNurbs && engine.mascaraRightNurbs && engine.mascaraMat),
    },
  });
}

export function logPatterns(mk: OpenMakeup): void {
  for (const category of mk.categories) {
    const patterns = mk.getPatterns(category);
    console.log(TAG, 'patterns', category, {
      count: patterns.length,
      firstThree: patterns.slice(0, 3),
    });
  }
}

export function logRenderCanvas(canvas: HTMLCanvasElement, phase: string): void {
  const rect = canvas.getBoundingClientRect();
  const parentRect = canvas.parentElement?.getBoundingClientRect();
  const css = getComputedStyle(canvas);
  const gl = (canvas as CanvasLike).getContext('webgl2') ?? (canvas as CanvasLike).getContext('webgl');
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const stack = document.elementsFromPoint?.(centerX, centerY) ?? [];

  console.log(TAG, 'canvas', phase, {
    rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    parent: parentRect ? { w: parentRect.width, h: parentRect.height } : null,
    buffer: { w: canvas.width, h: canvas.height },
    inlineStyle: canvas.style.cssText,
    computed: {
      display: css.display,
      visibility: css.visibility,
      opacity: css.opacity,
      zIndex: css.zIndex,
      transform: css.transform,
      pointerEvents: css.pointerEvents,
    },
    webgl: gl
      ? {
          lost: gl.isContextLost(),
          drawingBufferW: gl.drawingBufferWidth,
          drawingBufferH: gl.drawingBufferHeight,
        }
      : null,
    hitStackAtCenter: stack.slice(0, 5).map(el => `${el.tagName.toLowerCase()}.${String(el.className).trim()}`),
  });
}

export function logVideo(video: HTMLVideoElement, phase: string): void {
  console.log(TAG, 'video', phase, {
    readyState: video.readyState,
    paused: video.paused,
    videoW: video.videoWidth,
    videoH: video.videoHeight,
    hasSrcObject: Boolean(video.srcObject),
    rect: { w: video.getBoundingClientRect().width, h: video.getBoundingClientRect().height },
  });
}

export function logLayerVisibility(mk: OpenMakeup, category: string): void {
  const engine = mk.engine as unknown as InternalEngine & {
    eyeLineLeftNurbs?: { mesh?: { visible?: boolean } };
    eyeLineRightNurbs?: { mesh?: { visible?: boolean } };
    mascaraLeftNurbs?: { mesh?: { visible?: boolean } };
    mascaraRightNurbs?: { mesh?: { visible?: boolean } };
  };
  const visibility: Record<string, unknown> = {
    foundation: (engine.foundationMesh as { visible?: boolean } | undefined)?.visible,
    blush: (engine.blushMesh as { visible?: boolean } | undefined)?.visible,
    lipstick: (engine.lipsMesh as { visible?: boolean } | undefined)?.visible,
    eyeshadow: (engine.eyeShadowMesh as { visible?: boolean } | undefined)?.visible,
    eyeline: {
      left: engine.eyeLineLeftNurbs?.mesh?.visible,
      right: engine.eyeLineRightNurbs?.mesh?.visible,
    },
    mascara: {
      left: engine.mascaraLeftNurbs?.mesh?.visible,
      right: engine.mascaraRightNurbs?.mesh?.visible,
    },
  };
  console.log(TAG, 'layer visibility after apply', category, visibility);
}

export function logApply(category: string, result: unknown): void {
  console.log(TAG, 'apply result', category, result);
}

export function logSkip(reason: string, detail?: unknown): void {
  console.warn(TAG, 'SKIP APPLY', reason, detail);
}
