import React, { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SmartMakeupPage from './pages/SmartMakeupPage';
import ImageAnalysisPage from './pages/ImageAnalysisPage';
import ColorVisionPage from './pages/ColorVisionPage';
import { HomeIcon, LipstickIcon, CameraIcon, PaletteIcon, SparklesIcon } from './components/common/Icons';

const ROUTER_BASE = ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/')
  .replace(/\/$/, '') || '/';

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
    { path: '/', label: '首页', Icon: HomeIcon },
    { path: '/smart-makeup', label: '智能妆容', Icon: LipstickIcon },
    { path: '/image-analysis', label: '图片分析', Icon: CameraIcon },
    { path: '/color-vision', label: '色觉无障碍', Icon: PaletteIcon },
  ];

  return (
    <nav className="site-nav">
      <Link to="/" className="nav-brand">
        <span className="nav-brand-mark"><SparklesIcon /></span>
        美妆无界
      </Link>
      <div className="nav-links">
        {links.map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </div>
      {state.daltonizeEnabled && (
        <span className="nav-status">Daltonize: {state.cbType}</span>
      )}
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
      <BrowserRouter basename={ROUTER_BASE}>
        <Navigation />
        <div className="app-shell">
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
