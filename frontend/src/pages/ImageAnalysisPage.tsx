import React, { useState } from 'react';
import * as api from '../api/client';
import { daltonizeHex } from '../lib/color/daltonize';
import { describeColor } from '../lib/color/colorDescriptor';
import { useColorVision } from '../App';
import type { AnalysisResult, SubstituteResult } from '../types/api';

export default function ImageAnalysisPage() {
  const { state } = useColorVision();
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [substitutes, setSubstitutes] = useState<SubstituteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'steps' | 'substitutes'>('analysis');

  const renderColor = (hex: string) =>
    state.daltonizeEnabled ? daltonizeHex(hex, state.cbType) : hex;

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await api.analyzeImage('zh');
      setAnalysisResult(result);
      // Fetch substitutes
      if (result.detected_products) {
        const subResult = await api.findSubstitutes({ detected_products: result.detected_products });
        setSubstitutes(subResult.substitutes || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div>
      <h2 style={{ fontSize: 24, marginBottom: 16 }}>妆容图片分析 + 平替推荐</h2>

      {/* Upload area */}
      <div style={{
        padding: 40, textAlign: 'center', borderRadius: 12,
        background: '#f8f8f8', border: '2px dashed #ccc', marginBottom: 24,
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📸</div>
        <p style={{ color: '#888', marginBottom: 16 }}>
          上传妆容参考图片（Mock 模式使用预设分析结果）
        </p>
        <button onClick={handleAnalyze} disabled={loading} style={{
          padding: '12px 32px', borderRadius: 8, background: '#D4735E', color: 'white',
          fontSize: 16, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? '⏳ 分析中...' : '开始分析'}
        </button>
      </div>

      {/* Tabs */}
      {analysisResult && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['analysis', 'steps', 'substitutes'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13,
                background: activeTab === tab ? '#D4735E' : '#eee',
                color: activeTab === tab ? 'white' : '#888', border: 'none', cursor: 'pointer',
              }}>
                {tab === 'analysis' ? '分析结果' : tab === 'steps' ? '步骤指导' : '平替推荐'}
              </button>
            ))}
          </div>

          {/* Analysis tab */}
          {activeTab === 'analysis' && (
            <div>
              <div style={{ padding: 16, borderRadius: 12, background: 'white', border: '1px solid #ddd', marginBottom: 16 }}>
                <h3>检测风格: {analysisResult.detected_style}</h3>
                <p style={{ fontSize: 13, color: '#888' }}>
                  难度: {analysisResult.difficulty_level} | 适用: {analysisResult.suitable_skin_tones}
                </p>
              </div>

              <h4 style={{ marginBottom: 8 }}>识别的产品</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {analysisResult.detected_products.map((p, i) => (
                  <div key={i} style={{ padding: 12, borderRadius: 8, background: 'white', border: '1px solid #eee' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 15, background: renderColor(p.estimated_hex) }} />
                      <strong style={{ fontSize: 14 }}>{p.type}</strong>
                    </div>
                    <p style={{ fontSize: 12, color: '#666' }}>{p.color_description}</p>
                    {state.cbType !== 'none' && (
                      <p style={{ fontSize: 11, color: '#4CAF50', marginTop: 4 }}>
                        🎯 {describeColor(p.estimated_hex, state.cbType)}
                      </p>
                    )}
                    <p style={{ fontSize: 11, color: '#888' }}>区域: {p.region} | 质感: {p.finish}</p>
                  </div>
                ))}
              </div>

              <h4 style={{ marginTop: 16, marginBottom: 8 }}>色彩提取</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                {analysisResult.color_palette.map((c, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 8, background: renderColor(c.hex), border: '1px solid #ddd' }} />
                    <span style={{ fontSize: 11 }}>{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steps tab */}
          {activeTab === 'steps' && (
            <div>
              {analysisResult.step_instructions.map((step, i) => (
                <div key={i} style={{
                  padding: 16, borderRadius: 8, background: 'white',
                  border: '1px solid #eee', marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 18, background: '#D4735E',
                      color: 'white', textAlign: 'center', lineHeight: '36px', fontWeight: 'bold',
                    }}>
                      {step.step_number}
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong>{step.action}</strong>
                      <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                        产品: {step.product_type} · 色号: {step.color_reference} · 技法: {step.technique}
                      </p>
                      <p style={{ fontSize: 12, color: '#4CAF50', marginTop: 2 }}>
                        💡 {step.tip}
                      </p>
                      <p style={{ fontSize: 12, color: '#E53935', marginTop: 2 }}>
                        ⚠️ {step.warning}
                      </p>
                      <p style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                        ⏱️ 约 {step.duration_estimate}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Substitutes tab */}
          {activeTab === 'substitutes' && (
            <div>
              {substitutes.map((sub, i) => (
                <div key={i} style={{ padding: 16, borderRadius: 8, background: 'white', border: '1px solid #eee', marginBottom: 16 }}>
                  <h4 style={{ marginBottom: 8 }}>
                    原色: {sub.original_description}
                    <span style={{
                      display: 'inline-block', width: 24, height: 24, borderRadius: 12,
                      background: renderColor(sub.original_color), marginLeft: 8, verticalAlign: 'middle',
                    }} />
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                    {sub.substitutes.map((item, j) => (
                      <div key={j} style={{ padding: 8, borderRadius: 6, background: '#f8f8f8', border: '1px solid #eee' }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <div style={{ width: 20, height: 20, borderRadius: 10, background: renderColor(item.hex_color) }} />
                          <span style={{ fontSize: 12 }}>{item.brand} {item.shade_name}</span>
                        </div>
                        <p style={{ fontSize: 11, color: '#888' }}>
                          ¥{item.price} · ΔE={item.delta_e} · 评分={item.score}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {substitutes.length === 0 && <p style={{ color: '#888' }}>暂无平替数据</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
