# 美妆无界 (Beauty Without Boundaries)

欧莱雅第二届美妆黑客松 · 无界体验家赛道 — 多模态美妆交互平台

**🌐 在线演示**: https://ruchenyu9-lang.github.io/beauty-without-boundaries/

> 无需安装任何东西，直接在浏览器中体验全部三大功能（3D 人脸试妆需要摄像头权限）。

## 在线演示说明

GitHub Pages 部署的是**纯静态版本**：由于后端返回的全部是预生成的 Mock 数据和确定性色彩计算（CIEDE2000、Lab 转换、Daltonize），这些逻辑被完整移植到了浏览器端（`frontend/src/api/mockServer.ts`），因此静态版与本地运行前后端的完整版表现一致。

- 推送到 `main` 分支的改动会通过 GitHub Actions（`.github/workflows/deploy-pages.yml`）自动重新部署
- 本地开发仍按下方步骤启动真实的 FastAPI 后端
- 修改后端种子数据后，运行 `cd frontend && node scripts/gen-seed-data.cjs` 同步前端副本

## 快速启动

### 后端 (Python + FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 前端 (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

浏览器访问 http://localhost:5173

## 3 大功能

1. **智能妆容生成** — 3D人脸扫描 + AI智能搭配色号
2. **妆容图片分析** — 上传妆容图 → AI分析步骤 + 平替推荐
3. **色觉无障碍** — Daltonize色彩增强 + Ishihara检测 + 色彩翻译 + 定制调色板

## 技术栈

- 前端: React + TypeScript (Vite)
- 后端: Python + FastAPI + SQLite
- 色彩科学: CIEDE2000 ΔE、Lab色彩空间、Daltonize算法
- AI: Mock数据（预生成结果，无需外部API密钥）

## API 端点

| 功能 | 端点 |
|------|------|
| 健康检查 | GET /api/health |
| 产品列表 | GET /api/products/ |
| 色号搜索 | GET /api/products/search-shade |
| 人脸扫描 | POST /api/makeup/scan-face |
| 色号匹配 | POST /api/makeup/shade-match |
| 妆容生成 | POST /api/makeup/generate-looks |
| 妆容叠加 | POST /api/makeup/render-overlay-data |
| 图片分析 | POST /api/analysis/analyze-image |
| 平替搜索 | POST /api/analysis/find-substitutes |
| Daltonize | POST /api/color-vision/daltonize-single |
| 色盲检测 | POST /api/color-vision/detect-type |
| Ishihara测试 | GET /api/color-vision/ishihara-plates |
| 色彩识别 | POST /api/color-vision/identify-product-color |
| 调色板 | POST /api/color-vision/generate-palette |
