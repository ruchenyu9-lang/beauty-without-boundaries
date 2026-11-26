import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as api from '../api/client';
import '../styles/makeup.css';
import {
  CameraIcon,
  SparklesIcon,
  PaletteIcon,
  PlusIcon,
  CloseIcon,
  BoltIcon,
  EraserIcon,
} from '../components/common/Icons';
import { hexToRgb, rgbToLab, detectUndertone } from '../lib/color/labConversion';
import { daltonizeHex } from '../lib/color/daltonize';
import { useColorVision } from '../App';
import { MOCK_MAKEUP_LOOKS } from '../data/makeupLooks';
import type { MakeupLook, SkinTone } from '../types/makeup';
import type { OpenMakeup } from 'open-makeup-sdk';
import { applyMakeupLook, clearMakeup, createOpenMakeup, initOpenMakeup } from '../lib/makeup/openMakeupSdk';
import { MAKEUP_DEBUG, logVideo } from '../lib/makeup/debugOpenMakeup';

const BRAND_LABELS: Record<string, string> = {
  'Lancôme': '兰蔻',
  'YSL': 'YSL',
  'Armani': '阿玛尼',
  '3CE': '3CE',
  "L'Oréal Paris": '巴黎欧莱雅',
};

const CATEGORY_ORDER = ['粉底', '眼影', '腮红', '口红'];

const brandLabel = (brand: string) => BRAND_LABELS[brand] ?? brand;

/**
 * Smart Makeup Page — open-makeup-sdk 实时 AR 试妆
 *
 * SDK 内部使用 MediaPipe FaceMesh（468 点）+ Three.js GLSL Shader 完成
 * 视频背景、人脸贴合、羽化融合与动态换色；本项目只负责：
 * 1. 绑定 video / canvas 并初始化 OpenMakeup 实例
 * 2. 把妆容方案中的产品类别与 HEX 色号映射为 mk.apply() 调用
 * 3. 切换方案前调用 mk.clearAll() 清空上一套妆容
 *
 * <video> 仅作为帧源保持可见尺寸为 1px，SDK 会把视频与妆容一起渲染到
 * <canvas>；对 canvas 整体做 CSS scaleX(-1) 实现自拍镜像，画面与妆容同步。
 */

function clientSideScanFace(hex: string): SkinTone {
  const [L, a, b] = rgbToLab(...hexToRgb(hex));
  return { lab: { L: +L.toFixed(2), a: +a.toFixed(2), b: +b.toFixed(2) }, hex, undertone: detectUndertone(L, a, b), confidence: 0.85 };
}

export default function SmartMakeupPage() {
  const { state } = useColorVision();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const makeupRef = useRef<OpenMakeup | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'input' | 'generating' | 'preview'>('idle');
  const [skinTone, setSkinTone] = useState<SkinTone | null>(null);
  const [shadeInputs, setShadeInputs] = useState<string[]>(['']);
  const [matchedShades, setMatchedShades] = useState<any[]>([]);
  const [looks, setLooks] = useState<MakeupLook[]>([]);
  const [selectedLook, setSelectedLook] = useState<MakeupLook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renderColor = (hex: string) =>
    state.daltonizeEnabled ? daltonizeHex(hex, state.cbType) : hex;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlaying = () => {
      if (MAKEUP_DEBUG) logVideo(video, 'playing');
      setCameraReady(true);
    };
    video.addEventListener('playing', onPlaying);
    return () => {
      video.removeEventListener('playing', onPlaying);
      makeupRef.current?.dispose();
      makeupRef.current = null;
    };
  }, []);

  // ── Handlers (with client-side fallback) ───────────────────

  const handleStartCamera = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!makeupRef.current) {
        const mk = createOpenMakeup(videoRef.current!, canvasRef.current!);
        await initOpenMakeup(mk, canvasRef.current!);
        makeupRef.current = mk;
        if (MAKEUP_DEBUG) logVideo(videoRef.current!, 'after-init');
      } else {
        makeupRef.current.start();
      }
      setSdkReady(true);
      setPhase('scanning');
    } catch (e: any) {
      setError(e?.message || 'AR 妆容引擎启动失败');
    } finally {
      setLoading(false);
    }
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
    const mk = makeupRef.current;
    if (mk) void applyMakeupLook(mk, look);
  }, []);

  const handleClearMakeup = () => {
    setSelectedLook(null);
    const mk = makeupRef.current;
    if (mk) clearMakeup(mk);
  };

  const handleQuickPreview = () => {
    setSkinTone(clientSideScanFace('#D4A574'));
    setLooks(MOCK_MAKEUP_LOOKS);
    setPhase('preview');
    setSelectedLook(MOCK_MAKEUP_LOOKS[0]);
    const mk = makeupRef.current;
    if (mk) void applyMakeupLook(mk, MOCK_MAKEUP_LOOKS[0]);
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

  const undertoneLabel =
    skinTone?.undertone === 'warm' ? '暖调' :
    skinTone?.undertone === 'cool' ? '冷调' :
    skinTone?.undertone === 'neutral' ? '中性' :
    skinTone?.undertone || '待分析';

  return (
    <div className="makeup-page">
      <div className="makeup-content">
        <header className="makeup-header">
          <div>
            <span className="makeup-kicker">AI BEAUTY STUDIO · REAL-TIME</span>
            <h2 className="makeup-title">智能妆容生成</h2>
            <p className="makeup-subtitle">
              OpenMakeupSDK · MediaPipe 468 点实时追踪 → WebGL/GLSL 自然融合 → 实时换色
            </p>
          </div>
          <span className="makeup-header-badge"><SparklesIcon />科技妆容实验室</span>
        </header>

        <div className="makeup-steps">
          {phases.map((p, i) => (
            <span
              key={p.key}
              className={`makeup-step${i < phaseIndex ? ' done' : ''}${i === phaseIndex ? ' current' : ''}`}
            >
              {String(i + 1).padStart(2, '0')} · {p.label}
            </span>
          ))}
        </div>

        <div className="makeup-layout">
          <section className="makeup-visual">
            <div className={`makeup-stage${cameraReady ? ' is-live' : ''}`}>
              {!cameraReady && (
                <div className="makeup-stage-placeholder">
                  <div className="makeup-orb"><CameraIcon /></div>
                  <div className="makeup-placeholder-title">开启你的虚拟妆镜</div>
                  <p className="makeup-placeholder-desc">
                    启动摄像头后，AI 将实时追踪面部关键点，让每一款妆容都自然贴合你的轮廓。
                  </p>
                  <button
                    className="makeup-btn makeup-btn--primary makeup-btn--launch"
                    onClick={handleStartCamera}
                    disabled={loading}
                  >
                    <CameraIcon /> 启动摄像头
                  </button>
                </div>
              )}

              <video ref={videoRef} playsInline muted autoPlay className="makeup-video" />
              <canvas
                ref={canvasRef}
                className={`makeup-canvas${cameraReady ? '' : ' is-hidden'}`}
              />

              {cameraReady && (
                <div className="makeup-status-bar">
                  <span className="makeup-status-item">
                    <span className="makeup-dot makeup-dot--green" />CAM ONLINE
                  </span>
                  <span className="makeup-status-sep" />
                  <span className="makeup-status-item">
                    <span className={sdkReady ? 'makeup-dot makeup-dot--blue' : 'makeup-dot makeup-dot--muted'} />
                    {sdkReady ? 'FACEMESH 468' : 'ENGINE --'}
                  </span>
                  <span className="makeup-status-sep" />
                  <span className="makeup-status-item">{selectedLook ? selectedLook.lookName : 'LOOK NONE'}</span>
                </div>
              )}

              {selectedLook && (
                <div className="makeup-look-banner">
                  <span className="makeup-look-banner-label">当前妆效</span>
                  <strong>{selectedLook.lookName}</strong>
                  <span>
                    ({Array.from(new Set(selectedLook.products.map(p => brandLabel(p.brand)))).join(' + ')})
                  </span>
                </div>
              )}
            </div>

            <div className="makeup-actions">
              {cameraReady && (
                <button className="makeup-btn makeup-btn--primary" onClick={handleScanFace} disabled={loading}>
                  <SparklesIcon /> 提取肤色
                </button>
              )}
              {(phase === 'scanning' || phase === 'input' || phase === 'generating') && !loading && (
                <button className="makeup-btn makeup-btn--accent" onClick={handleQuickPreview}>
                  <BoltIcon /> 快速体验
                </button>
              )}
              {selectedLook && (
                <button className="makeup-btn" onClick={handleClearMakeup}>
                  <EraserIcon /> 清除妆容
                </button>
              )}
            </div>
          </section>

          <aside className="makeup-controls">
            {loading && <div className="makeup-loading">AI 正在计算...</div>}
            {error && <div className="makeup-error">{error}</div>}

            <div className="makeup-card">
              <h4 className="makeup-card-title">
                <PaletteIcon />肤色分析<span className="makeup-card-note">SKIN TONE</span>
              </h4>
              <div className="skin-swatch-wrap">
                <div
                  className={`skin-swatch${skinTone ? '' : ' is-empty'}`}
                  style={skinTone ? { background: renderColor(skinTone.hex) } : undefined}
                />
                <span className="skin-hex">
                  {skinTone ? renderColor(skinTone.hex).toUpperCase() : '— — — — — —'}
                </span>
                <span className="skin-undertone">{undertoneLabel}</span>
              </div>
            </div>

            {phase === 'input' && (
              <div className="makeup-card">
                <h4 className="makeup-card-title">
                  <PaletteIcon />输入已有色号<span className="makeup-card-note">SHADE ID</span>
                </h4>
                {shadeInputs.map((s, i) => (
                  <div key={i} className="makeup-input-row">
                    <input
                      className="makeup-input"
                      value={s}
                      onChange={e => {
                        const n = [...shadeInputs]; n[i] = e.target.value; setShadeInputs(n);
                      }}
                      placeholder="如 N4、220、C1"
                    />
                    {i > 0 && (
                      <button
                        className="makeup-mini-btn"
                        onClick={() => setShadeInputs(shadeInputs.filter((_, idx) => idx !== i))}
                        aria-label="移除色号"
                      >
                        <CloseIcon />
                      </button>
                    )}
                  </div>
                ))}
                <button className="makeup-add-btn" onClick={() => setShadeInputs([...shadeInputs, ''])}>
                  <PlusIcon /> 添加色号
                </button>
                <button
                  className="makeup-btn makeup-btn--primary makeup-btn--block"
                  onClick={handleMatchShades}
                  disabled={loading}
                >
                  匹配并生成
                </button>
              </div>
            )}

            {matchedShades.length > 0 && (
              <div className="makeup-card">
                <h4 className="makeup-card-title">
                  <SparklesIcon />已匹配色号<span className="makeup-card-note">{matchedShades.length} MATCHED</span>
                </h4>
                <div className="shade-grid">
                  {matchedShades.map((s: any, i: number) => (
                    <div key={i} className="shade-chip">
                      <div className="shade-chip-swatch" style={{ background: renderColor(s.hex_color) }} />
                      <div className="shade-chip-label">{s.shade_number}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {looks.length > 0 && (
              <div className="makeup-card">
                <h4 className="makeup-card-title">
                  <SparklesIcon />AI 妆容方案<span className="makeup-card-note">LOOKS</span>
                </h4>
                <div className="look-list">
                  {looks.map((look, i) => (
                    <div
                      key={i}
                      className={`look-card${selectedLook === look ? ' selected' : ''}`}
                      onClick={() => handleSelectLook(look)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') handleSelectLook(look);
                      }}
                    >
                      <div className="look-card-head">
                        <span className="look-name">{look.lookName}</span>
                        <span className="look-tag">{look.style} · {look.overall_intensity}</span>
                      </div>
                      <p className="look-desc">{look.description}</p>
                      <div className="look-palette">
                        {CATEGORY_ORDER.map(category => {
                          const product = (look.products ?? []).find(p => p.category === category);
                          if (!product) return null;
                          return (
                            <span
                              key={category}
                              className="palette-chip"
                              title={`${product.brand} ${product.name} ${product.shade}`}
                              style={{ background: renderColor(product.colorHex) }}
                            />
                          );
                        })}
                      </div>
                      <div className="look-products">
                        {(look.products ?? []).map((product, idx) => (
                          <div className="look-product" key={idx}>
                            <span
                              className="product-color-dot"
                              style={{ background: renderColor(product.colorHex) }}
                            />
                            <div className="look-product-info">
                              <span className="look-product-brand">{product.brand}</span>
                              <span className="look-product-name">{product.name}</span>
                              <span className="look-product-shade">{product.category} · {product.shade}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {selectedLook === look && <div className="look-live">实时预览中</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedLook && (
              <div className="makeup-card">
                <h4 className="makeup-card-title">
                  <PaletteIcon />{selectedLook.lookName} · 步骤<span className="makeup-card-note">STEPS</span>
                </h4>
                {selectedLook.steps.map((step, i) => (
                  <div key={i} className="step-row">
                    <span
                      className="step-swatch"
                      style={{ background: renderColor(step.hex_color || '#475569') }}
                    />
                    <div>
                      <div className="step-index">STEP {String(step.step_number).padStart(2, '0')}</div>
                      <div className="step-meta">
                        {step.product_type} · {step.region} · {step.technique} · {step.intensity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
