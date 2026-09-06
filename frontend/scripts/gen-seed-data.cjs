/**
 * One-off generator: converts backend/app/data/*.json into frontend/src/data/seedData.ts
 * so the static demo build can bundle the same seed data the FastAPI backend serves.
 *
 * Run from frontend/: node scripts/gen-seed-data.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const products = JSON.parse(fs.readFileSync(path.join(root, '../backend/app/data/products.json'), 'utf-8'));
const shades = JSON.parse(fs.readFileSync(path.join(root, '../backend/app/data/shades.json'), 'utf-8'));

const ts = `/**
 * Seed data copied verbatim from backend/app/data/*.json
 * (regenerate with node scripts/gen-seed-data.cjs; used by the
 * in-browser mock API for the static GitHub Pages demo).
 */

export interface ProductRecord {
  id: number;
  brand: string;
  product_name: string;
  product_type: string;
  category: string;
  price: number;
  is_loreal: boolean;
}

export interface ShadeRecord {
  id: number;
  product_id: number;
  shade_name: string;
  shade_number: string;
  hex_color: string;
  lab_l: number;
  lab_a: number;
  lab_b: number;
  rgb_r: number;
  rgb_g: number;
  rgb_b: number;
  undertone: string;
  finish_type: string;
  coverage: string;
  [key: string]: unknown;
}

export const productsDb: ProductRecord[] = ${JSON.stringify(products, null, 2)};

export const shadesDb: ShadeRecord[] = ${JSON.stringify(shades, null, 2)};
`;

fs.writeFileSync(path.join(root, 'src/data/seedData.ts'), ts);
console.log('OK products:', products.length, 'shades:', shades.length, 'bytes:', ts.length);
