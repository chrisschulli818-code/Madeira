/**
 * Objetos do ambiente (eletrodomésticos, sofá, mesa, cadeira, TV...).
 * Servem só para compor o cômodo e as imagens: todas as peças são decorativas,
 * ficando fora da lista de corte, das compras, do orçamento e da montagem.
 * A frente do objeto fica no +Z (igual aos móveis).
 */
import type { AssembledModel, Box3D, CutPiece, PropParams, PropType } from '@/types/woodcraft';

export const PROP_CATALOG: Array<{ type: PropType; label: string; width: number; height: number; depth: number; color: string; elevation?: number }> = [
  { type: 'geladeira', label: 'Geladeira', width: 700, height: 1850, depth: 720, color: '#eef0f2' },
  { type: 'fogao', label: 'Fogão', width: 760, height: 900, depth: 650, color: '#cfd3d6' },
  { type: 'lavadora', label: 'Máquina de lavar', width: 600, height: 850, depth: 620, color: '#f4f5f6' },
  { type: 'sofa', label: 'Sofá', width: 2000, height: 850, depth: 900, color: '#8a8f99' },
  { type: 'poltrona', label: 'Poltrona', width: 800, height: 850, depth: 800, color: '#9c7b63' },
  { type: 'mesa', label: 'Mesa de jantar', width: 1600, height: 760, depth: 900, color: '#8b5a2b' },
  { type: 'cadeira', label: 'Cadeira', width: 450, height: 900, depth: 500, color: '#6b4a2b' },
  { type: 'tv', label: 'TV', width: 1250, height: 720, depth: 60, color: '#141414', elevation: 900 },
  { type: 'tapete', label: 'Tapete', width: 2000, height: 10, depth: 1400, color: '#b9a88f' },
  { type: 'planta', label: 'Planta', width: 450, height: 1200, depth: 450, color: '#4d7c4a' },
];

export const propInfo = (type: PropType) => PROP_CATALOG.find((p) => p.type === type) ?? PROP_CATALOG[0]!;

/** Escurece/clareia uma cor hex (fator > 1 clareia). */
function shade(hex: string, f: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function buildProp(p: PropParams): AssembledModel {
  const W = Math.max(50, p.width);
  const H = Math.max(5, p.height);
  const D = Math.max(20, p.depth);
  const parts: Array<{ name: string; box: Box3D; color: string }> = [];
  const add = (name: string, box: Box3D, color = p.color) => parts.push({ name, box, color });

  switch (p.type) {
    case 'geladeira':
      add('Corpo', { x: 0, y: 0, z: 0, w: W, h: H, d: D - 20 });
      add('Porta do freezer', { x: 0, y: H * 0.7, z: D - 20, w: W, h: H * 0.3 - 5, d: 20 }, shade(p.color, 0.97));
      add('Porta', { x: 0, y: 0, z: D - 20, w: W, h: H * 0.7 - 10, d: 20 }, shade(p.color, 0.97));
      add('Puxador', { x: W - 60, y: H * 0.35, z: D, w: 25, h: H * 0.5, d: 30 }, '#8a8f95');
      break;
    case 'fogao':
      add('Corpo', { x: 0, y: 0, z: 0, w: W, h: H - 20, d: D });
      add('Mesa', { x: 0, y: H - 20, z: 0, w: W, h: 20, d: D }, '#1d1d1f');
      add('Porta do forno', { x: 60, y: 120, z: D, w: W - 120, h: H * 0.55, d: 15 }, '#2b2e33');
      add('Painel', { x: 0, y: H * 0.8, z: D, w: W, h: 90, d: 20 }, shade(p.color, 0.85));
      break;
    case 'lavadora':
      add('Corpo', { x: 0, y: 0, z: 0, w: W, h: H, d: D });
      add('Porta', { x: W * 0.2, y: H * 0.25, z: D, w: W * 0.6, h: W * 0.6, d: 25 }, '#9aa3ad');
      break;
    case 'sofa':
    case 'poltrona': {
      const seatH = 420;
      const arm = p.type === 'sofa' ? 180 : 160;
      add('Base', { x: arm, y: 0, z: 0, w: W - 2 * arm, h: seatH, d: D });
      add('Encosto', { x: arm, y: seatH, z: 0, w: W - 2 * arm, h: H - seatH, d: 220 }, shade(p.color, 0.92));
      add('Braço esquerdo', { x: 0, y: 0, z: 0, w: arm, h: Math.min(H, 620), d: D }, shade(p.color, 0.88));
      add('Braço direito', { x: W - arm, y: 0, z: 0, w: arm, h: Math.min(H, 620), d: D }, shade(p.color, 0.88));
      add('Almofadas', { x: arm, y: seatH, z: 220, w: W - 2 * arm, h: 120, d: D - 220 }, shade(p.color, 1.08));
      break;
    }
    case 'mesa': {
      const leg = 70;
      add('Tampo', { x: 0, y: H - 35, z: 0, w: W, h: 35, d: D });
      for (const [x, z] of [[60, 60], [W - 60 - leg, 60], [60, D - 60 - leg], [W - 60 - leg, D - 60 - leg]] as const) {
        add('Pé', { x, y: 0, z, w: leg, h: H - 35, d: leg }, shade(p.color, 0.85));
      }
      break;
    }
    case 'cadeira': {
      const leg = 35;
      const seat = 450;
      add('Assento', { x: 0, y: seat, z: 0, w: W, h: 40, d: D });
      add('Encosto', { x: 0, y: seat + 40, z: 0, w: W, h: H - seat - 40, d: 30 }, shade(p.color, 0.9));
      for (const [x, z] of [[0, 0], [W - leg, 0], [0, D - leg], [W - leg, D - leg]] as const) add('Pé', { x, y: 0, z, w: leg, h: seat, d: leg }, shade(p.color, 0.8));
      break;
    }
    case 'tv':
      add('Tela', { x: 0, y: 0, z: 0, w: W, h: H, d: D });
      add('Moldura inferior', { x: 0, y: 0, z: D, w: W, h: 12, d: 2 }, '#2a2a2a');
      break;
    case 'tapete':
      add('Tapete', { x: 0, y: 0, z: 0, w: W, h: H, d: D });
      break;
    case 'planta': {
      const pot = Math.min(W, D) * 0.65;
      add('Vaso', { x: (W - pot) / 2, y: 0, z: (D - pot) / 2, w: pot, h: H * 0.3, d: pot }, '#b86b4b');
      add('Folhagem', { x: 0, y: H * 0.3, z: 0, w: W, h: H * 0.7, d: D });
      break;
    }
  }

  const pieces: CutPiece[] = parts.map((part, i) => ({
    id: `decor-${i + 1}`,
    name: part.name,
    role: 'decor',
    material: 'carcass',
    quantity: 1,
    length: Math.round(part.box.w),
    width: Math.round(part.box.d),
    thickness: Math.round(part.box.h),
    edgeBanding: { length: 0, width: 0 },
    grain: 'free',
    instances: [part.box],
    decorative: true,
    color: part.color,
  }));

  return {
    templateId: 'prop',
    overall: { width: W, height: H, depth: D },
    pieces,
    doors: [],
    drawers: [],
    joints: [],
    adjustableShelves: 0,
    hangingRods: [],
    backPerimeter: 0,
    baseType: 'none',
    assembly: 'screw',
    layout: { columns: [], plinthHeight: 0, internalDepth: D },
    warnings: [],
  };
}
