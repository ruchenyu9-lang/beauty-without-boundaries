import React from 'react';
import { Link } from 'react-router-dom';

const features = [
  {
    path: '/smart-makeup',
    title: '智能妆容生成',
    subtitle: '3D扫描人脸 + AI智能搭配',
    icon: '💄',
    desc: '录入已有产品色号，3D扫描人脸，AI智能生成多种妆容方案并标记使用色号',
    color: '#C44569',
  },
  {
    path: '/image-analysis',
    title: '妆容图片分析',
    subtitle: 'AI分析 + 平替推荐',
    icon: '📸',
    desc: '上传妆容图片，AI分析化妆步骤和注意事项，智能推荐平替产品',
    color: '#D4735E',
  },
  {
    path: '/color-vision',
    title: '色觉无障碍',
    subtitle: '色彩增强 + 色彩翻译',
    icon: '🎨',
    desc: '色弱色彩增强、色盲色彩翻译、定制可感知调色板',
    color: '#4A2C2A',
  },
];

export default function HomePage() {
  return (
    <div style={{ textAlign: 'center', paddingTop: 40 }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>美妆无界</h1>
      <h2 style={{ fontSize: 20, color: '#888', marginBottom: 40 }}>
        Beauty Without Boundaries — 让美妆科技真正包容每个人
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        {features.map(f => (
          <Link key={f.path} to={f.path} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'white', borderRadius: 16, padding: 30,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)', transition: 'transform 0.2s',
              borderLeft: `4px solid ${f.color}`,
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 20, color: '#333', marginBottom: 4 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: f.color, marginBottom: 8 }}>{f.subtitle}</p>
              <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 50, color: '#999', fontSize: 12 }}>
        欧莱雅第二届美妆黑客松 · 无界体验家赛道
      </div>
    </div>
  );
}
