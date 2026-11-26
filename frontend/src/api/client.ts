/**
 * API client for backend communication.
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
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

export const healthCheck = () =>
  api.get('/health').then(r => r.data);
