import { Link } from 'react-router-dom';
import {
  LipstickIcon,
  CameraIcon,
  PaletteIcon,
  SparklesIcon,
  ArrowUpRightIcon,
} from '../components/common/Icons';

const features = [
  {
    path: '/smart-makeup',
    title: '智能妆容生成',
    subtitle: '3D扫描人脸 + AI智能搭配',
    icon: LipstickIcon,
    desc: '录入已有产品色号，3D扫描人脸，AI智能生成多种妆容方案并标记使用色号',
  },
  {
    path: '/image-analysis',
    title: '妆容图片分析',
    subtitle: 'AI分析 + 平替推荐',
    icon: CameraIcon,
    desc: '上传妆容图片，AI分析化妆步骤和注意事项，智能推荐平替产品',
  },
  {
    path: '/color-vision',
    title: '色觉无障碍',
    subtitle: '色彩增强 + 色彩翻译',
    icon: PaletteIcon,
    desc: '色弱色彩增强、色盲色彩翻译、定制可感知调色板',
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="hero">
        <div className="hero-blob hero-blob--purple" />
        <div className="hero-blob hero-blob--pink" />
        <div className="hero-blob hero-blob--sky" />
        <div className="hero-inner">
          <span className="hero-badge">BEAUTY × TECHNOLOGY × INCLUSION</span>
          <h1 className="hero-title">
            <span className="hero-title-text">美妆无界</span>
            <SparklesIcon className="hero-title-icon" />
          </h1>
          <p className="hero-subtitle">
            Beauty Without Boundaries — 让美妆科技真正包容每个人
          </p>
          <div className="hero-tags">
            <span className="hero-tag">科技赋能</span>
            <span className="hero-tag">多元包容</span>
            <span className="hero-tag">无界体验</span>
          </div>
        </div>
      </section>

      <div className="features-grid">
        {features.map(({ path, title, subtitle, desc, icon: Icon }) => (
          <Link key={path} to={path} className="feature-card">
            <div className="feature-icon-wrap"><Icon /></div>
            <h3 className="feature-title">{title}</h3>
            <p className="feature-subtitle">{subtitle}</p>
            <p className="feature-desc">{desc}</p>
            <span className="feature-more">
              探索功能 <ArrowUpRightIcon />
            </span>
          </Link>
        ))}
      </div>

      <footer className="site-footer">欧莱雅第二届美妆黑客松 · 无界体验家赛道</footer>
    </div>
  );
}
