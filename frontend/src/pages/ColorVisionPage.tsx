import React, { useState } from 'react';
import '../styles/colorVision.css';
import {
  SearchIcon,
  EyeIcon,
  ChatBubbleIcon,
  PaletteIcon,
  ArrowRightIcon,
} from '../components/common/Icons';
import { daltonizeHex, simulateCBHex } from '../lib/color/daltonize';
import { describeColor, translateColor } from '../lib/color/colorDescriptor';
import { scoreIshiharaAnswers } from '../lib/color/ishiharaScoring';
import { generateAccessiblePalette } from '../lib/color/palette';
import { ISHIHARA_PLATES } from '../data/ishiharaPlates';
import { useColorVision } from '../App';
import type {
  ColorBlindType,
  CBDetectionResult,
  ColorTranslation,
  PaletteColor,
  SenseKey,
} from '../types/colorVision';

const SENSES = [
  { key: 'normal', label: '正常视觉' },
  { key: 'protanopia', label: '红盲' },
  { key: 'deuteranopia', label: '绿盲' },
  { key: 'tritanopia', label: '蓝盲' },
] as const;

const CB_LABELS: Record<ColorBlindType, string> = {
  none: '正常视觉',
  protanopia: '红色盲 (Protanopia)',
  deuteranopia: '绿色盲 (Deuteranopia)',
  tritanopia: '蓝色盲 (Tritanopia)',
};

const MODE_LABELS: Record<ColorBlindType, string> = {
  none: '正常',
  protanopia: '红盲',
  deuteranopia: '绿盲',
  tritanopia: '蓝盲',
};

export default function ColorVisionPage() {
  const { state, update } = useColorVision();
  const [activeSection, setActiveSection] = useState<'quiz' | 'daltonize' | 'translate' | 'palette'>('quiz');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [cbDetection, setCbDetection] = useState<CBDetectionResult | null>(null);
  const [missingPlates, setMissingPlates] = useState<Record<number, boolean>>({});
  const [translateHex, setTranslateHex] = useState('#C44569');
  const [translation, setTranslation] = useState<ColorTranslation | null>(null);
  const [paletteData, setPaletteData] = useState<PaletteColor[]>([]);
  const [demoColors] = useState(['#C44569', '#D4A574', '#4A2C2A', '#E8A87C', '#804060', '#408060', '#F5D5B8', '#101010']);

  const renderColor = (hex: string) =>
    state.daltonizeEnabled ? daltonizeHex(hex, state.cbType) : hex;

  const handleQuizAnswer = (plateId: number, answer: number) => {
    setQuizAnswers(prev => ({ ...prev, [plateId]: answer }));
  };

  const handlePlateError = (plateId: number) => {
    setMissingPlates(prev => ({ ...prev, [plateId]: true }));
  };

  const handleDetectType = () => {
    const result = scoreIshiharaAnswers(ISHIHARA_PLATES, quizAnswers);
    setCbDetection(result);
    update({
      cbType: result.detected_type,
      daltonizeEnabled: result.detected_type !== 'none',
    });
  };

  const handleManualCBType = (cbType: ColorBlindType) => {
    update({ cbType, daltonizeEnabled: cbType !== 'none' });
  };

  const handleTranslateColor = () => {
    setTranslation(translateColor(translateHex));
  };

  const handleGeneratePalette = () => {
    setPaletteData(generateAccessiblePalette(state.cbType));
  };

  const sections = [
    { key: 'quiz', label: '色盲检测', Icon: SearchIcon },
    { key: 'daltonize', label: '色彩增强', Icon: EyeIcon },
    { key: 'translate', label: '色彩翻译', Icon: ChatBubbleIcon },
    { key: 'palette', label: '定制调色板', Icon: PaletteIcon },
  ] as const;

  const statusText = state.cbType === 'none'
    ? '当前状态：正常视觉'
    : `当前状态：${CB_LABELS[state.cbType]} · Daltonize ${state.daltonizeEnabled ? '已开启' : '关闭'}`;

  return (
    <div className="cv-page">
      <div className="cv-inner">
        <header className="cv-header">
          <div>
            <span className="cv-kicker">COLOR VISION · ACCESSIBLE BEAUTY</span>
            <h2 className="cv-title">色觉无障碍</h2>
            <p className="cv-subtitle">
              以不干扰色彩本身为前提，用科技补完每一种感知方式。
            </p>
          </div>
          <div className="cv-status">
            <span className={`cv-status-dot${state.daltonizeEnabled ? ' active' : ''}`} />
            {statusText}
            <span className="cv-status-tag">{state.cbType.toUpperCase()}</span>
          </div>
        </header>

        <div className="cv-segments" role="tablist" aria-label="色觉无障碍功能">
          {sections.map(({ key, label, Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeSection === key}
              className={`cv-segment${activeSection === key ? ' active' : ''}`}
              onClick={() => setActiveSection(key)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>

        {/* ── 色盲检测 ─────────────────────────────────────── */}
        {activeSection === 'quiz' && (
          <div className="cv-card">
            <div className="cv-section-head">
              <div>
                <div className="cv-eyebrow">ISHIHARA TEST</div>
                <h3 className="cv-card-title">色盲检测</h3>
                <p className="cv-desc">查看每张测试板，输入您看到的数字；如果看不到数字，请输入 0。</p>
              </div>
              <button
                className="cv-action"
                onClick={handleDetectType}
                disabled={Object.keys(quizAnswers).length === 0}
              >
                <SearchIcon />检测色盲类型
              </button>
            </div>

            <div className="cv-plate-grid">
              {ISHIHARA_PLATES.map(plate => (
                <div className="cv-plate-card" key={plate.id}>
                  <div className="cv-plate-figure">
                    {missingPlates[plate.id] ? (
                      <div className="cv-plate-missing">
                        缺少测试图
                        <span>请将真实图片放到 public/ishihara/plate-{String(plate.id).padStart(2, '0')}.png</span>
                      </div>
                    ) : (
                      <img
                        src={plate.image}
                        alt={`石原氏测试板 ${plate.id}`}
                        onError={() => handlePlateError(plate.id)}
                      />
                    )}
                  </div>
                  <div className="cv-plate-note">{plate.note}</div>
                  <div className="cv-answer-row">
                    <label className="cv-answer-label" htmlFor={`plate-${plate.id}`}>
                      您看到的数字
                    </label>
                    <input
                      id={`plate-${plate.id}`}
                      className="cv-answer-input"
                      type="number"
                      value={quizAnswers[plate.id] ?? ''}
                      onChange={e => handleQuizAnswer(plate.id, parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {cbDetection && (
              <div className={`cv-detection-result${cbDetection.detected_type === 'none' ? ' is-normal' : ' is-abnormal'}`}>
                <div className="cv-detection-icon"><EyeIcon /></div>
                <div className="cv-detection-main">
                  <div className="cv-detection-eyebrow">检测结果</div>
                  <div className="cv-detection-title">{cbDetection.result_label}</div>
                  <div className="cv-detection-meta">
                    严重程度 {cbDetection.severity} · 置信度 {(cbDetection.confidence * 100).toFixed(0)}% · 正常命中 {cbDetection.correct_count}/{cbDetection.answered_count}
                  </div>
                </div>
                {cbDetection.detected_type !== 'none' && (
                  <button
                    className="cv-action"
                    onClick={() => setActiveSection('daltonize')}
                  >
                    点击体验色彩增强与翻译
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 色彩增强 ─────────────────────────────────────── */}
        {activeSection === 'daltonize' && (
          <div className="cv-stack">
            <div className="cv-card">
              <div className="cv-section-head">
                <div>
                  <div className="cv-eyebrow">DALTONIZE ENGINE</div>
                  <h3 className="cv-card-title">色彩增强</h3>
                  <p className="cv-desc">选择一种色觉模式，对比原始色、模拟色与增强后的颜色。</p>
                </div>
              </div>
              <div className="cv-mode-row">
                {(['none', 'protanopia', 'deuteranopia', 'tritanopia'] as const).map(t => (
                  <button
                    key={t}
                    className={`cv-mode${state.cbType === t ? ' active' : ''}`}
                    onClick={() => handleManualCBType(t)}
                  >
                    {MODE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {state.cbType === 'none' && (
              <div className="cv-card cv-compare-empty">
                选择红盲 / 绿盲 / 蓝盲模式，查看「原始 → 模拟 → 增强」的逐色对比。
              </div>
            )}

            <div className="cv-compare-grid">
              {demoColors.map(hex => (
                <div className="cv-compare-card" key={hex}>
                  <div className="cv-compare-row">
                    <div className="cv-compare-item">
                      <span className="cv-compare-label">原始</span>
                      <span className="cv-compare-swatch" style={{ background: hex }} />
                    </div>
                    {state.cbType !== 'none' && (
                      <>
                        <ArrowRightIcon className="cv-compare-arrow" />
                        <div className="cv-compare-item">
                          <span className="cv-compare-label">模拟</span>
                          <span className="cv-compare-swatch" style={{ background: simulateCBHex(hex, state.cbType) }} />
                        </div>
                        <ArrowRightIcon className="cv-compare-arrow" />
                        <div className="cv-compare-item">
                          <span className="cv-compare-label">增强</span>
                          <span className="cv-compare-swatch" style={{ background: daltonizeHex(hex, state.cbType) }} />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="cv-compare-hex">{hex}</div>
                  {state.cbType !== 'none' && (
                    <div className="cv-compare-desc">{describeColor(hex, state.cbType)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 色彩翻译 ─────────────────────────────────────── */}
        {activeSection === 'translate' && (
          <div className="cv-stack">
            <div className="cv-card">
              <div className="cv-section-head">
                <div>
                  <div className="cv-eyebrow">MULTISENSORY DESCRIPTIONS</div>
                  <h3 className="cv-card-title">色彩翻译</h3>
                  <p className="cv-desc">输入任意 HEX 色值，计算亮度与色相，并生成四种色觉视角的文字描述。</p>
                </div>
                <button className="cv-action" onClick={handleTranslateColor}>
                  <ChatBubbleIcon />翻译颜色
                </button>
              </div>
              <div className="cv-translate-controls">
                <input
                  className="cv-color-picker"
                  type="color"
                  value={translateHex}
                  onChange={e => setTranslateHex(e.target.value.toUpperCase())}
                  aria-label="选择颜色"
                />
                <input
                  className="cv-hex-input"
                  type="text"
                  value={translateHex}
                  onChange={e => setTranslateHex(e.target.value.toUpperCase())}
                  placeholder="#C44569"
                  aria-label="HEX 色值"
                />
                <span className="cv-input-hint">支持 #RGB / #RRGGBB</span>
              </div>
            </div>

            {!translation ? (
              <div className="cv-card cv-compare-empty">输入或选择颜色后点击「翻译颜色」。</div>
            ) : (
              <div className="cv-stack">
                <div className="cv-card strong cv-story">
                  <span className="cv-story-text">色彩故事：{translation.story}</span>
                  <span className="cv-warmth">
                    {translation.metrics.warmth} · 亮度 {(translation.metrics.luminance * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="cv-translate-list">
                  <div className="cv-translate-card">
                    <span
                      className="cv-translate-swatch"
                      style={{ background: renderColor(translation.sourceHex) }}
                    />
                    <div className="cv-translate-body">
                      <div className="cv-translate-name">
                        {translation.metrics.name} · {translation.sourceHex}
                      </div>
                      <div className="cv-translate-meta">
                        色相 {translation.metrics.hue}° · 饱和度 {translation.metrics.saturation}% · 相对亮度 {translation.metrics.luminance}
                      </div>
                      <div className="cv-sense-list">
                        {SENSES.map(sense => (
                          <div className="cv-sense-row" key={sense.key}>
                            <span className={`cv-sense-dot ${sense.key}`} />
                            <span className="cv-sense-label">{sense.label}</span>
                            <span>{translation.descriptions[sense.key as SenseKey]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 定制调色板 ───────────────────────────────────── */}
        {activeSection === 'palette' && (
          <div className="cv-stack">
            <div className="cv-card">
              <div className="cv-section-head">
                <div>
                  <div className="cv-eyebrow">PERCEIVABLE PALETTE</div>
                  <h3 className="cv-card-title">定制调色板</h3>
                  <p className="cv-desc">根据当前色觉类型，生成一份更容易区分的专属色卡。</p>
                </div>
                <button className="cv-action" onClick={handleGeneratePalette}>
                  <PaletteIcon />生成调色板
                </button>
              </div>
            </div>

            {paletteData.length === 0 ? (
              <div className="cv-card cv-compare-empty">点击上方按钮，生成专属可感知调色板。</div>
            ) : (
              <div className="cv-palette-grid">
                {paletteData.map((p, i) => (
                  <div className="cv-palette-card" key={i}>
                    <span className="cv-palette-swatch" style={{ background: p.hex_color }} />
                    <div className="cv-palette-body">
                      <div className="cv-palette-name">{p.descriptive_name}</div>
                      <span className="cv-palette-perceive">{p.perceivable_as}</span>
                      <div className="cv-palette-meta">
                        HEX {p.hex_color} · Lab L {p.lab_values.L.toFixed(1)}
                      </div>
                      <div className="cv-palette-sim">
                        <span className="cv-palette-sim-dot" style={{ background: p.simulated_hex }} />
                        模拟色 {p.simulated_hex}
                      </div>
                      {(p.product_suggestions?.length ?? 0) > 0 && (
                        <div className="cv-palette-suggestions">
                          {p.product_suggestions.map((s, j) => (
                            <span className="cv-suggestion-chip" key={j}>{s.shade_name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
