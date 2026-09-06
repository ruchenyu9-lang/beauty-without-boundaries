/**
 * API client for backend communication.
 *
 * Static demo mode: when built with VITE_USE_MOCK_API=true (GitHub Pages
 * deployment), requests are served by the in-browser mock backend
 * (see ./mockServer.ts) instead of the FastAPI server.
 */

import axios from 'axios';
import { mockAdapter } from './mockServer';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  ...(import.meta.env.VITE_USE_MOCK_API === 'true' ? { adapter: mockAdapter } : {}),
});

// ── Products ──────────────────────────────────────────────

export const getProducts = (type?: string) =>
  api.get('/products/', { params: { product_type: type } }).then(r => r.data);

export const getShades = (productId?: number, productType?: string) =>
  api.get('/products/shades', { params: { product_id: productId, product_type: productType } }).then(r => r.data);

export const searchShade = (q: string) =>
  api.get('/products/search-shade', { params: { q } }).then(r => r.data);

// ── Feature 1: Makeup ─────────────────────────────────────

export const scanFace = (data: { hex?: string; r?: number; g?: number; b?: number }) =>
  api.post('/makeup/scan-face', data).then(r => r.data);

export const shadeMatch = (data: { skin_tone_lab: any; shade_numbers: string[]; product_type_filter?: string }) =>
  api.post('/makeup/shade-match', data).then(r => r.data);

export const generateLooks = (data: { skin_tone_lab: any; available_shade_ids: number[]; style?: string; occasion?: string; language?: string }) =>
  api.post('/makeup/generate-looks', data).then(r => r.data);

export const renderOverlay = (data: { region_colors: Record<string, string> }) =>
  api.post('/makeup/render-overlay-data', data).then(r => r.data);

// ── Feature 2: Analysis ──────────────────────────────────

export const analyzeImage = (language: string = 'zh') =>
  api.post('/analysis/analyze-image', { language }).then(r => r.data);

export const findSubstitutes = (data: { detected_products: any[]; max_price?: number }) =>
  api.post('/analysis/find-substitutes', data).then(r => r.data);

export const generateInstructions = (language: string = 'zh') =>
  api.post('/analysis/generate-instructions', { language }).then(r => r.data);

// ── Feature 3: Color Vision ──────────────────────────────

export const daltonizeSingle = (hex: string, cbType: string) =>
  api.post('/color-vision/daltonize-single', { hex_color: hex, cb_type: cbType }).then(r => r.data);

export const identifyProductColor = (language: string = 'zh') =>
  api.post('/color-vision/identify-product-color', { language }).then(r => r.data);

export const detectCBType = (quizAnswers: any[]) =>
  api.post('/color-vision/detect-type', { quiz_answers: quizAnswers }).then(r => r.data);

export const getIshiharaPlates = () =>
  api.get('/color-vision/ishihara-plates').then(r => r.data);

export const generatePalette = (cbType: string, skinToneLab?: any) =>
  api.post('/color-vision/generate-palette', { cb_type: cbType, skin_tone_lab: skinToneLab || { L: 65.2, a: 12.3, b: 18.5 } }).then(r => r.data);

export const healthCheck = () =>
  api.get('/health').then(r => r.data);
