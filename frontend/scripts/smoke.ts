/**
 * Smoke test for the in-browser mock API (static demo mode).
 *
 * Verifies the axios adapter contract and the response shape of every
 * endpoint the frontend calls. Bundled with esbuild and run in Node:
 *
 *   node scripts/run-smoke.mjs
 */

import axios from 'axios';
import { mockAdapter } from '../src/api/mockServer';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  adapter: mockAdapter,
});

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++;
    console.log('  ✓', name);
  } else {
    failed++;
    console.error('  ✗', name, extra !== undefined ? JSON.stringify(extra)?.slice(0, 300) : '');
  }
}

async function main() {
  // ── health ──
  const health = await api.get('/health').then(r => r.data);
  check('GET /api/health', health.status === 'ok' && !!health.service);

  // ── products ──
  const products = await api.get('/products/').then(r => r.data);
  check('GET /api/products → 30 products', products.total === 30 && products.products.length === 30);

  const foundations = await api.get('/products/', { params: { product_type: 'foundation' } }).then(r => r.data);
  check('GET /api/products?product_type=foundation',
    foundations.total > 0 && foundations.products.every((p: any) => p.product_type === 'foundation'));

  const shades = await api.get('/products/shades', { params: { product_type: 'lipstick' } }).then(r => r.data);
  check('GET /api/products/shades?product_type=lipstick (enriched)',
    shades.total > 0 && shades.shades.every((s: any) => s.brand && s.product_name));

  const search = await api.get('/products/search-shade', { params: { q: 'N4' } }).then(r => r.data);
  check('GET /api/products/search-shade?q=N4',
    Array.isArray(search.matches) && search.matches.length > 0 && search.matches.every((m: any) => m.brand));

  // ── makeup ──
  const scan = await api.post('/makeup/scan-face', { hex: '#D4A574' }).then(r => r.data);
  check('POST /api/makeup/scan-face',
    scan.lab && typeof scan.lab.L === 'number' && scan.hex === '#D4A574' && typeof scan.undertone === 'string');

  const match = await api.post('/makeup/shade-match', {
    skin_tone_lab: { L: 65.2, a: 12.3, b: 18.5 },
    shade_numbers: ['N4'],
  }).then(r => r.data);
  check('shade-match → matched_by_number contains N4 (enriched)',
    match.matched_by_number.length > 0 &&
    match.matched_by_number.every((m: any) => m.shade_number.toUpperCase() === 'N4' && m.brand));
  check('shade-match → 5 color_matches sorted by delta_e',
    match.color_matches.length === 5 &&
    match.color_matches.every((m: any) => typeof m.delta_e === 'number' && m.brand) &&
    match.color_matches.every((m: any, i: number, arr: any[]) => i === 0 || arr[i - 1].delta_e <= m.delta_e));

  const looks = await api.post('/makeup/generate-looks', {
    skin_tone_lab: { L: 65.2, a: 12.3, b: 18.5 },
    available_shade_ids: [4, 14, 18],
    style: 'natural',
  }).then(r => r.data);
  check('generate-looks → 3 looks (natural/glam/professional)', looks.looks.length === 3);
  check('generate-looks → steps enriched with hex_color + brand',
    looks.looks.every((l: any) => l.steps.every((s: any) => typeof s.hex_color === 'string' && !!s.brand)));

  const overlay = await api.post('/makeup/render-overlay-data', {
    region_colors: { forehead: '#F5D5B8', lips_upper: '#C44569' },
  }).then(r => r.data);
  check('render-overlay-data → landmark map with opacity',
    overlay.overlay_map.forehead.landmarks.length > 0 && overlay.overlay_map.lips_upper.opacity === 0.85);

  // ── analysis ──
  const analysis = await api.post('/analysis/analyze-image', { language: 'zh' }).then(r => r.data);
  check('analyze-image → mock analysis result',
    analysis.detected_style === '韩式玻璃肌肤' &&
    analysis.detected_products.length === 4 &&
    analysis.step_instructions.length === 4);

  const subs = await api.post('/analysis/find-substitutes', {
    detected_products: analysis.detected_products,
    max_price: 200,
  }).then(r => r.data);
  check('find-substitutes → one entry per detected product',
    subs.substitutes.length === 4 && subs.substitutes.every((s: any) => Array.isArray(s.substitutes)));

  const instr = await api.post('/analysis/generate-instructions', { language: 'zh' }).then(r => r.data);
  check('generate-instructions → 4 steps', instr.steps.length === 4);

  // ── color vision ──
  const plates = await api.get('/color-vision/ishihara-plates').then(r => r.data);
  check('ishihara-plates → 6 plates', plates.total === 6 && plates.plates[0].correct_answer === 12);

  const dalton = await api.post('/color-vision/daltonize-single', {
    hex_color: '#C44569',
    cb_type: 'deuteranopia',
  }).then(r => r.data);
  check('daltonize-single → corrected hex',
    /^#[0-9A-F]{6}$/.test(dalton.daltonized_hex) && dalton.daltonized_hex !== '#C44569');

  const identify = await api.post('/color-vision/identify-product-color', { language: 'zh' }).then(r => r.data);
  check('identify-product-color → mock identification',
    identify.identified_colors.length === 2 && !!identify.overall_color_story);

  const normal = await api.post('/color-vision/detect-type', {
    quiz_answers: plates.plates.map((p: any) => ({ plate_id: p.plate_id, selected_number: p.correct_answer })),
  }).then(r => r.data);
  check('detect-type all correct → normal / none', normal.detected_type === 'normal' && normal.severity === 'none');

  const protan = await api.post('/color-vision/detect-type', {
    quiz_answers: plates.plates.map((p: any) => ({ plate_id: p.plate_id, selected_number: p.protanopia_sees })),
  }).then(r => r.data);
  check('detect-type all protan answers → protanopia / strong',
    protan.detected_type === 'protanopia' && protan.severity === 'strong');

  const palette = await api.post('/color-vision/generate-palette', {
    cb_type: 'deuteranopia',
    skin_tone_lab: { L: 65.2, a: 12.3, b: 18.5 },
  }).then(r => r.data);
  check('generate-palette (deuteranopia) → named colors',
    palette.palette.length > 0 &&
    palette.palette.every((c: any) =>
      /^#[0-9A-F]{6}$/.test(c.hex_color) && !!c.descriptive_name && c.perceivable_as.startsWith('您将感知')));

  const paletteNormal = await api.post('/color-vision/generate-palette', {
    cb_type: 'normal',
    skin_tone_lab: { L: 65.2, a: 12.3, b: 18.5 },
  }).then(r => r.data);
  check('generate-palette (normal) → non-empty', paletteNormal.palette.length > 0);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error('SMOKE TEST CRASHED:', e);
  process.exit(1);
});
