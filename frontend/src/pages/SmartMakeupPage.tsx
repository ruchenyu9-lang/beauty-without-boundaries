import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as api from '../api/client';
import { useCamera } from '../hooks/useCamera';
import { useFaceMesh } from '../hooks/useFaceMesh';
import { DynamicMakeupRenderer, MakeupConfig } from '../lib/makeup/dynamicMakeupRenderer';
import { hexToRgb, rgbToHex, rgbToLab, detectUndertone } from '../lib/color/labConversion';
import { daltonizeHex } from '../lib/color/daltonize';
import { useColorVision } from '../App';
import type { MakeupLook, SkinTone } from '../types/makeup';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Smart Makeup Page — Dynamic Tracking Canvas Overlay (抖音滤镜同款原理)
 *
 * 核心原理:
 * 1. 视频帧与 Canvas 绘图区域尺寸 1:1 绝对重合 (Pixel-Perfect)
 * 2. 每帧基于 MediaPipe 468 关键点动态绘制妆容 Path
 * 3. 转头/倾斜时透视自动跟随 (关键点就是透视坐标)
 * 4. globalCompositeOperation 实现 natural blend: soft-light/overlay/multiply
 * 5. createRadialGradient + blur 实现腮红自然渐变
 *
 * 镜像策略:
 * - <video> 和 <canvas> 共处于同一个 `position: relative` 容器
 * - <canvas> 使用 `position: absolute` 1:1 精确覆盖在 <video> 正上方
 * - 两者都使用 CSS `transform: scaleX(-1)` 实现自拍镜像
 * - 绘图坐标使用 MediaPipe 原始 landmark x (不做 (1-x) 翻转)
 * - 由 CSS 负责水平翻转，确保方向绝对同步：
 *   "用户向左歪头，妆容也向左歪头"
 */

// ── Client-side fallback data ──────────────────────────────

const MOCK_MAKEUP_LOOKS: MakeupLook[] = [
  {
    look_name: '晨曦轻颜', description: '清新自然日常妆，轻薄底妆搭配柔和腮红与自然唇色',
    style: 'natural', overall_intensity: 'subtle',
    steps: [
      { step_number: 1, product_type: 'foundation', shade_number: 'N4', region: 'forehead', technique: 'blend outward', intensity: 'light', hex_color: '#D4A574' },
      { step_number: 2, product_type: 'blush', shade_number: '140', region: 'left_cheek', technique: 'sweep across', intensity: 'light', hex_color: '#E8A87C' },
      { step_number: 3, product_type: 'blush', shade_number: '140', region: 'right_cheek', technique: 'sweep across', intensity: 'light', hex_color: '#E8A87C' },
      { step_number: 4, product_type: 'lipstick', shade_number: '220', region: 'lips_upper', technique: 'press', intensity: 'light', hex_color: '#C44569' },
      { step_number: 5, product_type: 'lipstick', shade_number: '220', region: 'lips_lower', technique: 'press', intensity: 'light', hex_color: '#C44569' },
    ],
    shade_ids_used: ['N4', '140', '220'],
    region_colors: { forehead: '#F5D5B8', left_cheek: '#E8A87C', right_cheek: '#E8A87C', lips_upper: '#C44569', lips_lower: '#C44569', nose: '#F0CDB0' },
  },
  {
    look_name: '暖阳蜜桃', description: '蜜桃色系日常妆，温暖亲和',
    style: 'natural', overall_intensity: 'moderate',
    steps: [
      { step_number: 1, product_type: 'foundation', shade_number: 'N4', region: 'forehead', technique: 'blend outward', intensity: 'medium', hex_color: '#D4A574' },
      { step_number: 2, product_type: 'blush', shade_number: '140', region: 'left_cheek', technique: 'pat and build', intensity: 'medium', hex_color: '#E8A87C' },
      { step_number: 3, product_type: 'eyeshadow', shade_number: 'R31', region: 'upper_lid', technique: 'sweep across', intensity: 'light', hex_color: '#C9A96E' },
      { step_number: 4, product_type: 'lipstick', shade_number: '361', region: 'lips_upper', technique: 'press', intensity: 'medium', hex_color: '#D4735E' },
      { step_number: 5, product_type: 'lipstick', shade_number: '361', region: 'lips_lower', technique: 'press', intensity: 'medium', hex_color: '#D4735E' },
    ],
    shade_ids_used: ['N4', '140', 'R31', '361'],
    region_colors: { forehead: '#F5D5B8', left_cheek: '#E8A87C', right_cheek: '#E8A87C', upper_lid: '#C9A96E', lips_upper: '#D4735E', lips_lower: '#D4735E', nose: '#E8D5C0' },
  },
  {
    look_name: '星耀华妆', description: '华丽派对妆，浓郁眼影搭配精致唇色',
    style: 'glam', overall_intensity: 'dramatic',
    steps: [
      { step_number: 1, product_type: 'foundation', shade_number: 'N4', region: 'forehead', technique: 'blend outward', intensity: 'heavy', hex_color: '#D4A574' },
      { step_number: 2, product_type: 'eyeshadow', shade_number: 'C1', region: 'upper_lid', technique: 'pat and build', intensity: 'heavy', hex_color: '#4A2C2A' },
      { step_number: 3, product_type: 'eyeshadow', shade_number: 'R31', region: 'crease', technique: 'blend outward', intensity: 'medium', hex_color: '#C9A96E' },
      { step_number: 4, product_type: 'blush', shade_number: '140', region: 'left_cheek', technique: 'sweep across', intensity: 'medium', hex_color: '#E8A87C' },
      { step_number: 5, product_type: 'lipstick', shade_number: '440', region: 'lips_upper', technique: 'press', intensity: 'heavy', hex_color: '#8B0000' },
      { step_number: 6, product_type: 'lipstick', shade_number: '440', region: 'lips_lower', technique: 'press', intensity: 'heavy', hex_color: '#8B0000' },
      { step_number: 7, product_type: 'contour', shade_number: 'C2D', region: 'nose', technique: 'blend outward', intensity: 'medium', hex_color: '#604838' },
    ],
    shade_ids_used: ['N4', 'C1', 'R31', '140', '440', 'C2D'],
    region_colors: { forehead: '#F0CDB0', left_cheek: '#D4A574', right_cheek: '#D4A574', upper_lid: '#4A2C2A', crease: '#8B6950', lips_upper: '#8B0000', lips_lower: '#8B0000', nose: '#A88868' },
  },
];

function clientSideScanFace(hex: string): SkinTone {
  const [L, a, b] = rgbToLab(...hexToRgb(hex));
  return { lab: { L: +L.toFixed(2), a: +a.toFixed(2), b: +b.toFixed(2) }, hex, undertone: detectUndertone(L, a, b), confidence: 0.85 };
}

/** Convert region_colors from backend API to a MakeupConfig for the renderer. */
function regionColorsToMakeupConfig(
  regionColors: Record<string, string>,
  skinToneHex: string,
): MakeupConfig {
  const config: MakeupConfig = {};

  // Lips: both upper and lower use the same color
  if (regionColors.lips_upper || regionColors.lips_lower) {
    config.lips = {
      color: regionColors.lips_upper || regionColors.lips_lower || skinToneHex,
      opacity: 0.75,
      blendMode: 'overlay',
    };
  }

  // Cheeks / blush
  if (regionColors.left_cheek || regionColors.right_cheek) {
    config.blush = {
      color: regionColors.left_cheek || regionColors.right_cheek || '#E8A87C',
      opacity: 0.45,
      blendMode: 'soft-light',
    };
  }

  // Eyeshadow upper lid
  if (regionColors.upper_lid) {
    config.eyeshadowUpper = {
      color: regionColors.upper_lid,
      opacity: 0.55,
      blendMode: 'overlay',
    };
  }

  // Eyeshadow crease
  if (regionColors.crease) {
    config.eyeshadowCrease = {
      color: regionColors.crease,
      opacity: 0.5,
      blendMode: 'multiply',
    };
  }

  // Forehead → highlight (lighter than skin tone)
  if (regionColors.forehead) {
    config.highlight = {
      color: regionColors.forehead,
      opacity: 0.2,
      blendMode: 'soft-light',
    };
  }

  // Nose → contour
  if (regionColors.nose) {
    // Use a darker shade for nose contour
    const [r, g, b] = hexToRgb(regionColors.nose);
    const darker = rgbToHex(Math.round(r * 0.7), Math.round(g * 0.65), Math.round(b * 0.6));
    config.contour = { color: darker, opacity: 0.25, blendMode: 'multiply' };
  }

  // Cheekbone highlight
  if (regionColors.cheekbone) {
    // Add cheekbone highlight (merge with existing highlight)
    if (config.highlight) {
      // Already have forehead highlight, cheekbone will be added in the renderer
    }
  }

  return config;
}

export default function SmartMakeupPage() {
  const { state } = useColorVision();
  const { videoRef, isReady: cameraReady, error: cameraError, startCamera, stopCamera } = useCamera();
  const { landmarks, isLoaded: faceMeshLoaded, error: faceMeshError, processFrame } = useFaceMesh();

  // Canvas ref — React owns this DOM element, renderer uses it via init()
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const makeupRendererRef = useRef<DynamicMakeupRenderer | null>(null);
  const animLoopRef = useRef<number | null>(null);
  const landmarksRef = useRef<NormalizedLandmark[]>([]);
  const lastVideoSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const [phase, setPhase] = useState<'idle' | 'scanning' | 'input' | 'generating' | 'preview'>('idle');
  const [skinTone, setSkinTone] = useState<SkinTone | null>(null);
  const [shadeInputs, setShadeInputs] = useState<string[]>(['']);
  const [matchedShades, setMatchedShades] = useState<any[]>([]);
  const [looks, setLooks] = useState<MakeupLook[]>([]);
  const [selectedLook, setSelectedLook] = useState<MakeupLook | null>(null);
  const [loading, setLoading] = useState(false);
  const [landmarkCount, setLandmarkCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const renderColor = (hex: string) =>
    state.daltonizeEnabled ? daltonizeHex(hex, state.cbType) : hex;

  // ── Initialize makeup renderer and connect canvas ──────────────
  useEffect(() => {
    const renderer = new DynamicMakeupRenderer();
    makeupRendererRef.current = renderer;
    // Connect the React-owned canvas to the renderer
    if (canvasRef.current) {
      renderer.init(canvasRef.current);
    }
    return () => {
      renderer.dispose();
    };
  }, []);

  // ── Sync landmarks to ref ──────────────────────────────────
  useEffect(() => { landmarksRef.current = landmarks; }, [landmarks]);

  // ── Animation loop ──────────────────────────────────────────
  useEffect(() => {
    if (!cameraReady || !faceMeshLoaded || !videoRef.current) return;

    const video = videoRef.current;
    const renderer = makeupRendererRef.current;

    const animate = () => {
      animLoopRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      processFrame(video, now);

      const lm = landmarksRef.current;
      if (lm.length > 0) {
        setLandmarkCount(lm.length);

        // Only resize when video dimensions actually change
        // (avoid resetting canvas context every frame)
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw > 0 && vh > 0 && renderer) {
          if (lastVideoSizeRef.current.w !== vw || lastVideoSizeRef.current.h !== vh) {
            renderer.setSize(vw, vh);
            lastVideoSizeRef.current = { w: vw, h: vh };
          }
          renderer.renderFrame(lm);
        }
      }
    };

    animate();

    return () => {
      if (animLoopRef.current) cancelAnimationFrame(animLoopRef.current);
    };
  }, [cameraReady, faceMeshLoaded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // ── Handlers (with client-side fallback) ───────────────────

  const handleStartCamera = async () => {
    await startCamera();
    setPhase('scanning');
  };

  const handleScanFace = async () => {
    setLoading(true); setError(null);
    try {
      const result = await api.scanFace({ hex: '#D4A574' });
      setSkinTone(result);
      setPhase('input');
    } catch (e) {
      console.warn('API fail, client fallback:', e);
      setSkinTone(clientSideScanFace('#D4A574'));
      setPhase('input');
    }
    setLoading(false);
  };

  const handleMatchShades = async () => {
    setLoading(true); setError(null);
    try {
      const result = await api.shadeMatch({
        skin_tone_lab: skinTone?.lab || { L: 65.2, a: 12.3, b: 18.5 },
        shade_numbers: shadeInputs.filter(s => s.trim()),
      });
      setMatchedShades(result.matched_by_number || []);
    } catch (e) { setMatchedShades([]); }
    setPhase('generating');
    setLoading(false);
  };

  const handleGenerateLooks = async () => {
    setLoading(true); setError(null);
    try {
      const result = await api.generateLooks({
        skin_tone_lab: skinTone?.lab || { L: 65.2, a: 12.3, b: 18.5 },
        available_shade_ids: matchedShades.map(s => s.id).filter(Boolean) || [4, 14, 18],
      });
      setLooks(result.looks || []);
    } catch (e) { setLooks(MOCK_MAKEUP_LOOKS); }
    setPhase('preview');
    setLoading(false);
  };

  const handleSelectLook = useCallback((look: MakeupLook) => {
    setSelectedLook(look);
    const skinHex = skinTone?.hex || '#D4A574';
    const config = regionColorsToMakeupConfig(look.region_colors, skinHex);
    if (makeupRendererRef.current) {
      makeupRendererRef.current.setConfig(config);
    }
  }, [skinTone]);

  const handleClearMakeup = () => {
    setSelectedLook(null);
    if (makeupRendererRef.current) makeupRendererRef.current.clear();
  };

  const handleQuickPreview = () => {
    setSkinTone(clientSideScanFace('#D4A574'));
    setLooks(MOCK_MAKEUP_LOOKS);
    setPhase('preview');
    // Auto-select first look
    const config = regionColorsToMakeupConfig(MOCK_MAKEUP_LOOKS[0].region_colors, '#D4A574');
    if (makeupRendererRef.current) makeupRendererRef.current.setConfig(config);
    setSelectedLook(MOCK_MAKEUP_LOOKS[0]);
  };

  // ── Phase indicator ──────────────────────────────────────────
  const phases = [
    { key: 'idle', label: '启动摄像头', icon: '📷' },
    { key: 'scanning', label: '扫描人脸', icon: '🔍' },
    { key: 'input', label: '输入色号', icon: '🏷️' },
    { key: 'generating', label: '生成妆容', icon: '🤖' },
    { key: 'preview', label: '实时预览', icon: '✨' },
  ];
  const phaseIndex = phases.findIndex(p => p.key === phase);

  return (
    <div>
      <h2 style={{ fontSize: 24, marginBottom: 8 }}>智能妆容生成 — 实时动态追踪预览</h2>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
        MediaPipe 468点实时关键点 → Canvas 2D逐帧动态绘制 → 透视跟随 · 像素级贴合
      </p>

      {/* Phase progress */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {phases.map((p, i) => (
          <div key={p.key} style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 12,
            background: i < phaseIndex ? '#4CAF50' : i === phaseIndex ? '#667eea' : '#eee',
            color: i <= phaseIndex ? 'white' : '#999',
          }}>{p.icon} {p.label}</div>
        ))}
      </div>

      {/* Status */}
      <div style={{ padding: '8px 16px', borderRadius: 6, background: '#f5f5f5', fontSize: 12, marginBottom: 16 }}>
        摄像头: {cameraReady ? '✅' : cameraError ? `❌ ${cameraError}` : '⏳'} |
        FaceMesh: {faceMeshLoaded ? '✅' : faceMeshError ? `❌ ${faceMeshError}` : '⏳'} |
        关键点: {landmarkCount > 0 ? `${landmarkCount}` : '—'} |
        方案: {selectedLook ? selectedLook.look_name : '未选择'}
      </div>

      {/* Quick skip */}
      {(phase === 'scanning' || phase === 'input' || phase === 'generating') && !loading && (
        <button onClick={handleQuickPreview} style={{
          padding: '8px 16px', borderRadius: 8, background: '#FF9800', color: 'white',
          fontSize: 12, border: 'none', cursor: 'pointer', marginBottom: 16,
        }}>🚀 快速体验（预设妆容直接预览）</button>
      )}

      {/* ── Main area ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Left: Video + Canvas overlay (Pixel-Perfect 1:1) */}
        <div style={{ flex: 1 }}>
          {/* ── Container: video and canvas share this positioning context ──
           * position: relative  → 为 canvas 的 absolute 定位提供参考
           * overflow: hidden    → 确保圆角裁切正确生效
           * Canvas width/height 属性由 renderer.setSize() 在动画循环中设置，
           * 不通过 React JSX props 控制（避免每帧重渲染）
           */}
          <div style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 12,
            background: '#000',
            maxWidth: 640,
          }}>
            {/* Video element — VISIBLE, this IS the background */}
            {/* transform: scaleX(-1) → 自拍镜像，让用户看到自己像照镜子 */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{
                width: '100%',
                display: 'block',
                transform: 'scaleX(-1)',
              }}
            />

            {/* Makeup overlay canvas — absolutely positioned on top of video (Pixel-Perfect 1:1)
             * transform: scaleX(-1) → 与视频同方向镜像
             * 绘图坐标使用 MediaPipe 原始 landmark x (lm2px 中不做 (1-x) 翻转)
             * 由 CSS 负责水平翻转，确保方向绝对同步
             */}
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                transform: 'scaleX(-1)',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            />

            {/* Tracking active indicator (不受 scaleX(-1) 影响，文字正常显示) */}
            {cameraReady && landmarkCount > 0 && (
              <div style={{
                position: 'absolute', top: 10, left: 10,
                color: '#4CAF50', fontSize: 11,
                background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 4, zIndex: 20,
              }}>
                ✅ 468点追踪 · 妆容实时跟随
              </div>
            )}
          </div>

          {/* Camera/scan buttons */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            {phase === 'idle' && (
              <button onClick={handleStartCamera} style={{
                padding: '10px 24px', borderRadius: 8, background: '#667eea', color: 'white',
                fontSize: 14, border: 'none', cursor: 'pointer',
              }}>📷 启动摄像头</button>
            )}
            {phase === 'scanning' && !loading && (
              <button onClick={handleScanFace} style={{
                padding: '10px 24px', borderRadius: 8, background: '#667eea', color: 'white',
                fontSize: 14, border: 'none', cursor: 'pointer',
              }}>🔍 提取肤色</button>
            )}
            {selectedLook && (
              <button onClick={handleClearMakeup} style={{
                padding: '8px 16px', borderRadius: 8, background: '#E53935', color: 'white',
                fontSize: 12, border: 'none', cursor: 'pointer',
              }}>✕ 清除妆容</button>
            )}
          </div>
        </div>

        {/* Right: Control panel */}
        <div style={{ width: 320 }}>
          {loading && <div style={{ padding: 20, textAlign: 'center', fontSize: 16 }}>⏳ 加载中...</div>}

          {skinTone && (
            <div style={{ padding: 16, borderRadius: 12, background: 'white', border: '1px solid #ddd', marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8 }}>肤色分析</h4>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: 30, background: renderColor(skinTone.hex), border: '3px solid #667eea' }} />
                <div>
                  <p style={{ fontSize: 13 }}>HEX: {skinTone.hex}</p>
                  <p style={{ fontSize: 13 }}>底调: {skinTone.undertone === 'warm' ? '暖调 ❤️' : skinTone.undertone === 'cool' ? '冷调 💙' : '中性 ⚪'}</p>
                </div>
              </div>
            </div>
          )}

          {phase === 'input' && (
            <div style={{ padding: 16, borderRadius: 12, background: 'white', border: '1px solid #ddd', marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8 }}>输入已有产品色号</h4>
              {shadeInputs.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input value={s} onChange={e => {
                    const n = [...shadeInputs]; n[i] = e.target.value; setShadeInputs(n);
                  }} placeholder="如 N4、220、C1" style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }} />
                  {i > 0 && <button onClick={() => setShadeInputs(shadeInputs.filter((_, idx) => idx !== i))} style={{ padding: 8, borderRadius: 4, background: '#eee', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>}
                </div>
              ))}
              <button onClick={() => setShadeInputs([...shadeInputs, ''])} style={{ padding: '6px 12px', borderRadius: 4, background: '#eee', border: '1px solid #ccc', cursor: 'pointer', fontSize: 12 }}>+ 添加色号</button>
              <button onClick={handleMatchShades} disabled={loading} style={{ marginTop: 12, padding: '10px 24px', borderRadius: 8, background: '#667eea', color: 'white', fontSize: 14, border: 'none', cursor: 'pointer', width: '100%' }}>匹配并生成</button>
            </div>
          )}

          {matchedShades.length > 0 && (
            <div style={{ padding: 16, borderRadius: 12, background: 'white', border: '1px solid #ddd', marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8 }}>已匹配色号</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {matchedShades.map((s: any, i: number) => (
                  <div key={i} style={{ padding: 8, borderRadius: 8, background: '#f8f8f8', textAlign: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: renderColor(s.hex_color), margin: '0 auto 4px' }} />
                    <div style={{ fontSize: 11 }}>{s.shade_number}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {looks.length > 0 && (
            <div style={{ padding: 16, borderRadius: 12, background: 'white', border: '1px solid #ddd', marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8 }}>AI 妆容方案</h4>
              {looks.map((look, i) => (
                <div key={i} onClick={() => handleSelectLook(look)} style={{
                  padding: 12, borderRadius: 8, marginBottom: 8, cursor: 'pointer',
                  background: selectedLook === look ? '#f0f4ff' : '#f8f8f8',
                  border: selectedLook === look ? '2px solid #667eea' : '1px solid #eee',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold' }}>{look.look_name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{look.description}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>风格: {look.style} | 强度: {look.overall_intensity}</div>
                  <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                    {Object.entries(look.region_colors).map(([region, hex]) => (
                      <div key={region} title={region} style={{ width: 20, height: 20, borderRadius: 10, background: renderColor(hex as string) }} />
                    ))}
                  </div>
                  {selectedLook === look && <div style={{ fontSize: 11, color: '#4CAF50', marginTop: 4 }}>✅ 实时预览中</div>}
                </div>
              ))}
            </div>
          )}

          {selectedLook && (
            <div style={{ padding: 16, borderRadius: 12, background: 'white', border: '1px solid #ddd' }}>
              <h4 style={{ marginBottom: 8 }}>{selectedLook.look_name} — 步骤</h4>
              {selectedLook.steps.map((step, i) => (
                <div key={i} style={{ padding: 8, borderRadius: 6, background: '#f8f8f8', marginBottom: 4, fontSize: 12 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <div style={{ width: 24, height: 24, borderRadius: 12, background: renderColor(step.hex_color || '#ccc') }} />
                    <strong>步骤 {step.step_number}</strong>
                    <span style={{ color: '#888' }}>{step.product_type} · {step.region}</span>
                  </div>
                  <div style={{ color: '#666', marginTop: 2 }}>技法: {step.technique} | 强度: {step.intensity}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
