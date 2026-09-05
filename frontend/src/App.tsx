import React, { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SmartMakeupPage from './pages/SmartMakeupPage';
import ImageAnalysisPage from './pages/ImageAnalysisPage';
import ColorVisionPage from './pages/ColorVisionPage';

// ── Color Vision Context ─────────────────────────────────────
interface ColorVisionState {
  cbType: 'protanopia' | 'deuteranopia' | 'tritanopia' | 'none';
  daltonizeEnabled: boolean;
  language: 'zh' | 'en';
}

const defaultColorVision: ColorVisionState = {
  cbType: 'none',
  daltonizeEnabled: false,
  language: 'zh',
};

const ColorVisionContext = createContext<{
  state: ColorVisionState;
  update: (partial: Partial<ColorVisionState>) => void;
}>({ state: defaultColorVision, update: () => {} });

export const useColorVision = () => useContext(ColorVisionContext);

// ── Navigation ─────────────────────────────────────────────────
function Navigation() {
  const { state } = useColorVision();
  const links = [
    { path: '/', label: '首页', icon: '🏠' },
    { path: '/smart-makeup', label: '智能妆容', icon: '💄' },
    { path: '/image-analysis', label: '图片分析', icon: '📸' },
    { path: '/color-vision', label: '色觉无障碍', icon: '🎨' },
  ];

  return (
    <nav style={{
      display: 'flex', gap: 8, padding: '12px 20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white', fontSize: 14, alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontWeight: 'bold', fontSize: 18, marginRight: 20 }}>美妆无界</span>
      {links.map(l => (
        <Link key={l.path} to={l.path} style={{
          color: 'white', textDecoration: 'none', padding: '6px 12px',
          borderRadius: 8, background: 'rgba(255,255,255,0.15)',
        }}>
          {l.icon} {l.label}
        </Link>
      ))}
      <span style={{ marginLeft: 'auto', fontSize: 12 }}>
        {state.daltonizeEnabled ? `Daltonize: ${state.cbType}` : ''}
      </span>
    </nav>
  );
}

// ── App ─────────────────────────────────────────────────────────
export default function App() {
  const [cvState, setCvState] = useState<ColorVisionState>(defaultColorVision);
  const updateCv = (partial: Partial<ColorVisionState>) =>
    setCvState(prev => ({ ...prev, ...partial }));

  return (
    <ColorVisionContext.Provider value={{ state: cvState, update: updateCv }}>
      <BrowserRouter>
        <Navigation />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/smart-makeup" element={<SmartMakeupPage />} />
            <Route path="/image-analysis" element={<ImageAnalysisPage />} />
            <Route path="/color-vision" element={<ColorVisionPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ColorVisionContext.Provider>
  );
}
