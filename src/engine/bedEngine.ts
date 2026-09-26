/**
 * Cama de MDF calculada a partir do colchão.
 *
 * Estrutura (a cabeceira fica encostada na parede, em z = 0; os pés ficam na frente):
 * - cabeceira e peseira até o chão (funcionam como pés);
 * - duas laterais entre elas, com borda 80 mm acima do estrado para segurar o colchão;
 * - sarrafos parafusados por dentro das laterais, onde o estrado apoia;
 * - travessa central nas camas mais largas que 1,20 m;
 * - estrado de ripas (70 mm, vão de até 50 mm) ou de chapa;
 * - colchão só como referência visual (fora da lista de corte).
 */
import type { AssembledModel, BedParams, Box3D, CutPiece, EdgeBanding, Joint, PieceRole } from '@/types/woodcraft';

const CLEARANCE = 10;
const LIP = 80;
const SLAT_W = 70;
const SLAT_GAP = 50;
const CLEAT_H = 40;
/** Folga do estrado para as laterais (mm). */
const GAP = 3;
/** Primeira e última ripa afastadas da cabeceira e da peseira (mm). */
const DECK_INSET = 25;

const EDGE = {
  none: { length: 0, width: 0 },
  oneLong: { length: 1, width: 0 },
  board: { length: 1, width: 2 },
} as const satisfies Record<string, EdgeBanding>;

const floorMm = (v: number) => Math.floor(v + 1e-6);

export function buildBed(input: BedParams): AssembledModel {
  const p: BedParams = {
    ...input,
    mattressWidth: Math.max(500, input.mattressWidth),
    mattressLength: Math.max(1500, input.mattressLength),
    thickness: Math.max(12, Math.min(40, input.thickness)),
    deckHeight: Math.max(150, input.deckHeight),
    railHeight: Math.max(100, input.railHeight),
  };
  const T = p.thickness;
  const innerW = p.mattressWidth + 2 * CLEARANCE;
  const innerL = p.mattressLength + 2 * CLEARANCE;
  const W = innerW + 2 * T;
  const D = innerL + 2 * T;
  const railTop = p.deckHeight + LIP;
  const railBottom = Math.max(0, railTop - p.railHeight);
  const headH = Math.max(p.headboardHeight, railTop);
  const footH = p.footboard ? Math.max(p.footboardHeight, railTop) : railTop;
  const warnings: string[] = [];
  if (p.railHeight < LIP + T + CLEAT_H) warnings.push(`Laterais com ${p.railHeight} mm ficam baixas para receber sarrafo e estrado; use pelo menos ${LIP + T + CLEAT_H} mm.`);

  const pieces: CutPiece[] = [];
  const joints: Joint[] = [];
  const add = (name: string, role: PieceRole, length: number, width: number, instances: Box3D[], extra: Partial<CutPiece> = {}) => {
    pieces.push({
      id: `${role}-${pieces.filter((x) => x.role === role).length + 1}`,
      name,
      role,
      material: 'carcass',
      quantity: instances.length,
      length: floorMm(length),
      width: floorMm(width),
      thickness: T,
      edgeBanding: EDGE.oneLong,
      grain: 'length',
      instances,
      ...extra,
    });
  };

  add('Cabeceira', 'headboard', W, headH, [{ x: 0, y: 0, z: 0, w: W, h: headH, d: T }], { edgeBanding: EDGE.board });
  add(p.footboard ? 'Peseira' : 'Peseira baixa', 'footboard', W, footH, [{ x: 0, y: 0, z: D - T, w: W, h: footH, d: T }], { edgeBanding: EDGE.board });
  add('Lateral da cama', 'bed-rail', innerL, p.railHeight, [0, W - T].map((x) => ({ x, y: railBottom, z: T, w: T, h: p.railHeight, d: innerL })));
  joints.push(...[1, 2, 3, 4].map(() => ({ label: 'Lateral × cabeceira/peseira', length: p.railHeight })));

  // Sarrafos por dentro das laterais: o estrado apoia sobre eles.
  const cleatTop = p.deckHeight - T;
  add('Sarrafo do estrado', 'cleat', innerL, CLEAT_H, [T, W - 2 * T].map((x) => ({ x, y: cleatTop - CLEAT_H, z: T, w: T, h: CLEAT_H, d: innerL })), {
    edgeBanding: EDGE.none,
    notes: 'Colado e parafusado por dentro das laterais',
  });
  joints.push(...[1, 2, 3, 4].map(() => ({ label: 'Sarrafo × cabeceira/peseira', length: CLEAT_H })));

  const beam = innerW > 1200;
  if (beam) {
    add('Travessa central', 'bed-rail', innerL, 100, [{ x: W / 2 - T / 2, y: cleatTop - 100, z: T, w: T, h: 100, d: innerL }], { edgeBanding: EDGE.none });
    joints.push({ label: 'Travessa central × cabeceira/peseira', length: 100 }, { label: 'Travessa central × cabeceira/peseira', length: 100 });
  }

  // O estrado apoia por cima dos sarrafos, com folga para as laterais, a cabeceira e a peseira.
  const deckW = innerW - 2 * GAP;
  const deckL = innerL - 2 * DECK_INSET;
  if (p.deck === 'ripas') {
    const n = Math.max(2, Math.ceil(deckL / (SLAT_W + SLAT_GAP)));
    const step = (deckL - SLAT_W) / (n - 1);
    add(
      'Ripa do estrado',
      'slat',
      deckW,
      SLAT_W,
      Array.from({ length: n }, (_, k) => ({ x: T + GAP, y: cleatTop, z: T + DECK_INSET + k * step, w: deckW, h: T, d: SLAT_W })),
      { edgeBanding: EDGE.none, notes: 'Apoiada nos sarrafos, 1 parafuso em cada ponta' },
    );
    for (let k = 0; k < n * (beam ? 3 : 2); k++) joints.push({ label: 'Ripa × sarrafo', length: SLAT_W });
  } else {
    const half = (innerL - 2 * GAP) / 2;
    add(
      'Estrado (chapa)',
      'slat',
      deckW,
      half,
      [0, 1].map((k) => ({ x: T + GAP, y: cleatTop, z: T + GAP + k * half, w: deckW, h: T, d: half })),
      { edgeBanding: EDGE.none, grain: 'free' },
    );
    joints.push(...[1, 2, 3, 4].map(() => ({ label: 'Estrado × sarrafo', length: half })));
  }

  // Colchão (referência visual).
  pieces.push({
    id: 'decor-1',
    name: 'Colchão',
    role: 'decor',
    material: 'carcass',
    quantity: 1,
    length: p.mattressLength,
    width: p.mattressWidth,
    thickness: p.mattressHeight,
    edgeBanding: EDGE.none,
    grain: 'free',
    instances: [{ x: T + CLEARANCE, y: p.deckHeight, z: T + CLEARANCE, w: p.mattressWidth, h: p.mattressHeight, d: p.mattressLength }],
    decorative: true,
    color: '#ece7de',
  });

  return {
    templateId: 'bed',
    overall: { width: W, height: Math.max(headH, footH), depth: D },
    pieces,
    doors: [],
    drawers: [],
    joints,
    adjustableShelves: 0,
    hangingRods: [],
    backPerimeter: 0,
    baseType: 'none',
    assembly: p.assembly,
    layout: { columns: [[T, W - T]], plinthHeight: 0, internalDepth: innerL },
    warnings,
  };
}
