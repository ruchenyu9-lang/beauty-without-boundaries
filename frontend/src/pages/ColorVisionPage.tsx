import React, { useState } from 'react';
import * as api from '../api/client';
import { daltonizeHex, simulateCBHex } from '../lib/color/daltonize';
import { describeColor } from '../lib/color/colorDescriptor';
import { hexToRgb } from '../lib/color/labConversion';
import { useColorVision } from '../App';
import type { ColorBlindType, IshiharaPlate, CBDetectionResult, PaletteColor } from '../types/colorVision';

export default function ColorVisionPage() {
  const { state, update } = useColorVision();
  const [activeSection, setActiveSection] = useState<'quiz' | 'daltonize' | 'translate' | 'palette'>('quiz');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [plates, setPlates] = useState<IshiharaPlate[]>([]);
  const [cbDetection, setCbDetection] = useState<CBDetectionResult | null>(null);
  const [colorIdentification, setColorIdentification] = useState<any>(null);
  const [paletteData, setPaletteData] = useState<PaletteColor[]>([]);
  const [loading, setLoading] = useState(false);
  const [demoColors] = useState(['#C44569', '#D4A574', '#4A2C2A', '#E8A87C', '#804060', '#408060', '#F5D5B8', '#101010']);

  const renderColor = (hex: string) =>
    state.daltonizeEnabled ? daltonizeHex(hex, state.cbType) : hex;

  // ── Load Ishihara plates ───────────────────────────────────
  React.useEffect(() => {
    api.getIshiharaPlates().then(r => setPlates(r.plates || [])).catch(console.error);
  }, []);

  // ── Quiz ───────────────────────────────────────────────────
  const handleQuizAnswer = (plateId: number, answer: number) => {
    setQuizAnswers(prev => ({ ...prev, [plateId]: answer }));
  };

  const handleDetectType = async () => {
    setLoading(true);
    try {
      const answers = Object.entries(quizAnswers).map(([pid, num]) => ({
        plate_id: parseInt(pid), selected_number: num,
      }));
      const result = await api.detectCBType(answers);
      setCbDetection(result);
      if (result.detected_type !== 'none') {
        update({ cbType: result.detected_type as ColorBlindType, daltonizeEnabled: true });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // ── Daltonize demo ─────────────────────────────────────────
  const handleManualCBType = (cbType: ColorBlindType) => {
    update({ cbType, daltonizeEnabled: cbType !== 'none' });
  };

  // ── Color translation ──────────────────────────────────────
  const handleIdentifyColor = async () => {
    setLoading(true);
    try {
      const result = await api.identifyProductColor('zh');
      setColorIdentification(result);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // ── Palette ────────────────────────────────────────────────
  const handleGeneratePalette = async () => {
    setLoading(true);
    try {
      const result = await api.generatePalette(state.cbType === 'none' ? 'deuteranopia' : state.cbType);
      setPaletteData(result.palette || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // ── Ishihara SVG plate generator ───────────────────────────
  const generateIshiharaSVG = (plate: IshiharaPlate, size: number = 180) => {
    const colors = [
      '#E87060', '#D08850', '#C49060', '#B07848',
      '#80A0C0', '#6090B0', '#4080A0',
    ];
    const dots: string[] = [];
    const answerColor = '#E87060'; // warm dots (seen by normal)
    const bgColors = ['#6090B0', '#80A0C0']; // cool dots (confusing for CB)
    const numStr = String(plate.correct_answer);
    // Simplified: draw random dots with some forming the number pattern
    for (let i = 0; i < 80; i++) {
      const cx = size / 2 + (Math.random() - 0.5) * (size - 30);
      const cy = size / 2 + (Math.random() - 0.5) * (size - 30);
      const r = 6 + Math.random() * 6;
      // Check if this dot should be "answer" colored (simplified)
      const angle = Math.atan2(cy - size / 2, cx - size / 2);
      const dist = Math.sqrt((cx - size / 2) ** 2 + (cy - size / 2) ** 2);
      const isInNumber = dist < size / 2 - 10 && Math.abs(angle) < Math.PI * 0.8;
      const color = isInNumber && Math.random() > 0.4 ? answerColor : bgColors[Math.floor(Math.random() * bgColors.length)];
      dots.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />`);
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 5}" fill="#f8f8f8" stroke="#ccc"/>${dots.join('')}</svg>`;
  };

  const sections = [
    { key: 'quiz', label: '色盲检测', icon: '🔍' },
    { key: 'daltonize', label: '色彩增强', icon: '👁️' },
    { key: 'translate', label: '色彩翻译', icon: '🗣️' },
    { key: 'palette', label: '定制调色板', icon: '🎨' },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 24, marginBottom: 16 }}>色觉无障碍</h2>

      {/* Current CB type indicator */}
      <div style={{
        padding: '8px 16px', borderRadius: 8, marginBottom: 16,
        background: state.daltonizeEnabled ? '#FFF3E0' : '#E8F5E9',
        fontSize: 13,
      }}>
        当前状态: {state.cbType === 'none' ? '正常视觉' :
          `${state.cbType === 'protanopia' ? '红色盲' : state.cbType === 'deuteranopia' ? '绿色盲' : '蓝色盲'} ${state.daltonizeEnabled ? '(Daltonize 已开启)' : '(Daltonize 关闭)'}`}
      </div>

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {sections.map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key as any)} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13,
            background: activeSection === s.key ? '#4A2C2A' : '#eee',
            color: activeSection === s.key ? 'white' : '#888', border: 'none', cursor: 'pointer',
          }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Quiz section */}
      {activeSection === 'quiz' && (
        <div>
          <h3 style={{ marginBottom: 12 }}>Ishihara 色盲检测测试</h3>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
            查看每张测试板，输入您看到的数字。如果您看不到数字，输入 0。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {plates.map(plate => (
              <div key={plate.plate_id} style={{ textAlign: 'center', padding: 12, borderRadius: 8, background: 'white', border: '1px solid #eee' }}>
                <div dangerouslySetInnerHTML={{ __html: generateIshiharaSVG(plate) }} />
                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 12 }}>您看到的数字: </label>
                  <input
                    type="number"
                    value={quizAnswers[plate.plate_id] || ''}
                    onChange={e => handleQuizAnswer(plate.plate_id, parseInt(e.target.value) || 0)}
                    style={{ padding: 4, width: 60, borderRadius: 4, border: '1px solid #ccc', textAlign: 'center' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <button onClick={handleDetectType} disabled={loading || Object.keys(quizAnswers).length === 0} style={{
            marginTop: 16, padding: '12px 24px', borderRadius: 8, background: '#4A2C2A', color: 'white',
            fontSize: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '⏳ 分析中...' : '检测色盲类型'}
          </button>
          {cbDetection && (
            <div style={{ padding: 16, borderRadius: 12, background: '#fff3e0', marginTop: 16 }}>
              <h3>检测结果</h3>
              <p>类型: {cbDetection.detected_type === 'none' ? '正常视觉' :
                cbDetection.detected_type === 'protanopia' ? '红色盲 (Protanopia)' :
                cbDetection.detected_type === 'deuteranopia' ? '绿色盲 (Deuteranopia)' : '蓝色盲 (Tritanopia)'}</p>
              <p>严重程度: {cbDetection.severity}</p>
              <p>置信度: {cbDetection.confidence}</p>
            </div>
          )}
        </div>
      )}

      {/* Daltonize section */}
      {activeSection === 'daltonize' && (
        <div>
          <h3 style={{ marginBottom: 12 }}>Daltonize 色彩增强</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['none', 'protanopia', 'deuteranopia', 'tritanopia'] as const).map(t => (
              <button key={t} onClick={() => handleManualCBType(t)} style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 12,
                background: state.cbType === t ? '#4A2C2A' : '#eee',
                color: state.cbType === t ? 'white' : '#888', border: 'none', cursor: 'pointer',
              }}>
                {t === 'none' ? '正常' : t === 'protanopia' ? '红盲' : t === 'deuteranopia' ? '绿盲' : '蓝盲'}
              </button>
            ))}
          </div>

          <h4 style={{ marginBottom: 8 }}>色彩对比：原始 / 模拟 / 增强</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {demoColors.map(hex => (
              <div key={hex} style={{ padding: 8, borderRadius: 8, background: 'white', border: '1px solid #eee', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: hex }} title="原始" />
                  {state.cbType !== 'none' && (
                    <>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: simulateCBHex(hex, state.cbType) }} title="模拟" />
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: daltonizeHex(hex, state.cbType) }} title="增强" />
                    </>
                  )}
                </div>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  {hex} {state.cbType !== 'none' && `→ ${describeColor(hex, state.cbType)}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Color translation section */}
      {activeSection === 'translate' && (
        <div>
          <h3 style={{ marginBottom: 12 }}>色彩翻译：扫描产品 → 多感官描述</h3>
          <button onClick={handleIdentifyColor} disabled={loading} style={{
            padding: '12px 24px', borderRadius: 8, background: '#4A2C2A', color: 'white',
            fontSize: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '⏳ 分析中...' : '扫描产品色彩（Mock）'}
          </button>

          {colorIdentification && (
            <div style={{ marginTop: 16 }}>
              <div style={{ padding: 12, borderRadius: 8, background: '#f8f8f8', marginBottom: 8 }}>
                <strong>色彩故事: {colorIdentification.overall_color_story}</strong>
                <span style={{ marginLeft: 8, fontSize: 12 }}>暖度: {colorIdentification.warmth_level}</span>
              </div>
              {colorIdentification.identified_colors.map((c: any, i: number) => (
                <div key={i} style={{ padding: 16, borderRadius: 12, background: 'white', border: '1px solid #eee', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 60, height: 60, borderRadius: 12, background: renderColor(c.hex_color) }} />
                    <div>
                      <h4>{c.descriptive_name}</h4>
                      <p style={{ fontSize: 12, color: '#888' }}>{c.hex_color} · 底调: {c.undertone_classification}</p>
                      {c.perceivable_descriptions && (
                        <div style={{ fontSize: 12, marginTop: 8 }}>
                          <p style={{ color: '#333' }}>🟢 正常: {c.perceivable_descriptions.normal}</p>
                          <p style={{ color: '#E53935' }}>🔴 红盲: {c.perceivable_descriptions.protanopia}</p>
                          <p style={{ color: '#4CAF50' }}>🟢 绿盲: {c.perceivable_descriptions.deuteranopia}</p>
                          <p style={{ color: '#2196F3' }}>🔵 蓝盲: {c.perceivable_descriptions.tritanopia}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Palette section */}
      {activeSection === 'palette' && (
        <div>
          <h3 style={{ marginBottom: 12 }}>定制可感知调色板</h3>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
            根据您的色觉类型生成只包含您能区分的颜色调色板
          </p>
          <button onClick={handleGeneratePalette} disabled={loading} style={{
            padding: '12px 24px', borderRadius: 8, background: '#4A2C2A', color: 'white',
            fontSize: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '⏳ 生成中...' : '生成调色板'}
          </button>

          {paletteData.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
              {paletteData.map((p, i) => (
                <div key={i} style={{ padding: 12, borderRadius: 8, background: 'white', border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: p.hex_color }} title="实际色" />
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: p.simulated_hex }} title="模拟色" />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 'bold', marginTop: 8 }}>{p.descriptive_name}</div>
                  <div style={{ fontSize: 11, color: '#4CAF50' }}>{p.perceivable_as}</div>
                  {p.product_suggestions.length > 0 && (
                    <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                      推荐: {p.product_suggestions.map(s => s.shade_name).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
