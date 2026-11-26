import type { MakeupLook, MakeupStep, ProductMakeupLook } from '../types/makeup';

export const PRODUCT_MAKEUP_LOOKS: ProductMakeupLook[] = [
  {
    lookName: '晨曦轻颜',
    style: 'natural',
    products: [
      { brand: 'Lancôme', category: '粉底', name: '兰蔻持妆粉底液', shade: 'PO-01', colorHex: '#F2D5C4' },
      { brand: 'YSL', category: '眼影', name: '圣罗兰四色眼影盘', shade: '#02 玫瑰色', colorHex: '#D4A574' },
      { brand: '3CE', category: '腮红', name: '3CE 单色腮红', shade: 'Rose Beige', colorHex: '#E8A87C' },
      { brand: 'Armani', category: '口红', name: '阿玛尼红管唇釉', shade: '#405 浆果红', colorHex: '#A93B4A' },
    ],
  },
  {
    lookName: '暖阳蜜桃',
    style: 'natural',
    products: [
      { brand: "L'Oréal Paris", category: '粉底', name: '巴黎欧莱雅持妆粉底液', shade: 'N4', colorHex: '#E8C8A8' },
      { brand: '3CE', category: '眼影', name: '3CE 四色眼影盘', shade: '#Butter Cream', colorHex: '#C9A96E' },
      { brand: '3CE', category: '腮红', name: '3CE 单色腮红', shade: 'Nude Peach', colorHex: '#EB9D8E' },
      { brand: 'YSL', category: '口红', name: '圣罗兰小金条唇釉', shade: '#12 玫瑰木', colorHex: '#D4735E' },
    ],
  },
  {
    lookName: '星耀华妆',
    style: 'glam',
    products: [
      { brand: 'Armani', category: '粉底', name: '阿玛尼权力粉底液', shade: '#4', colorHex: '#E0BE9F' },
      { brand: 'YSL', category: '眼影', name: '圣罗兰四色眼影盘', shade: '#10 深棕', colorHex: '#4A2C2A' },
      { brand: 'Lancôme', category: '腮红', name: '兰蔻梦幻腮红', shade: '#02', colorHex: '#D4A574' },
      { brand: 'Armani', category: '口红', name: '阿玛尼红管唇釉', shade: '#400 经典红', colorHex: '#8B0000' },
    ],
  },
  {
    lookName: '雅韵职妆',
    style: 'professional',
    products: [
      { brand: 'Lancôme', category: '粉底', name: '兰蔻持妆粉底液', shade: 'PO-03', colorHex: '#E0BE9F' },
      { brand: '3CE', category: '眼影', name: '3CE 单色眼影', shade: '#Butter Cream', colorHex: '#C9A96E' },
      { brand: "L'Oréal Paris", category: '腮红', name: '巴黎欧莱雅炫彩腮红', shade: '#02 柔粉', colorHex: '#E8C8A8' },
      { brand: 'Lancôme', category: '口红', name: '兰蔻菁纯唇膏', shade: '#196 玫瑰豆沙', colorHex: '#A93B4A' },
    ],
  },
];

const CATEGORY_META: Record<string, {
  product_type: string;
  regions: string[];
  technique: string;
  intensity: string;
}> = {
  粉底: { product_type: 'foundation', regions: ['forehead', 'nose'], technique: 'blend outward', intensity: 'light' },
  眼影: { product_type: 'eyeshadow', regions: ['upper_lid', 'crease'], technique: 'sweep across', intensity: 'medium' },
  腮红: { product_type: 'blush', regions: ['left_cheek', 'right_cheek'], technique: 'sweep across', intensity: 'medium' },
  口红: { product_type: 'lipstick', regions: ['lips_upper', 'lips_lower'], technique: 'press', intensity: 'medium' },
};

const INTENSITY_BY_STYLE: Record<string, string> = {
  natural: 'subtle',
  subtle: 'subtle',
  glam: 'dramatic',
  professional: 'moderate',
};

export function toMakeupLook(look: ProductMakeupLook): MakeupLook {
  const region_colors: Record<string, string> = {};
  const steps: MakeupStep[] = [];

  look.products.forEach(product => {
    const meta = CATEGORY_META[product.category] ?? {
      product_type: product.category,
      regions: [],
      technique: 'sweep across',
      intensity: 'medium',
    };
    meta.regions.forEach(region => {
      region_colors[region] = product.colorHex;
      steps.push({
        step_number: steps.length + 1,
        product_type: meta.product_type,
        shade_number: product.shade,
        region,
        technique: meta.technique,
        intensity: meta.intensity,
        hex_color: product.colorHex,
        shade_name: product.name,
        brand: product.brand,
        product_name: product.name,
      });
    });
  });

  return {
    lookName: look.lookName,
    look_name: look.lookName,
    style: look.style,
    products: look.products,
    description: `${look.lookName} · ${look.products.map(p => p.brand).join(' + ')}`,
    steps,
    shade_ids_used: look.products.map(p => p.shade),
    region_colors,
    overall_intensity: INTENSITY_BY_STYLE[look.style] ?? 'subtle',
  };
}

export const MOCK_MAKEUP_LOOKS: MakeupLook[] = PRODUCT_MAKEUP_LOOKS.map(toMakeupLook);
