/**
 * Móvel livre: o usuário monta o móvel do zero, painel por painel.
 *
 * Cada painel tem orientação, medidas, espessura e posição. A partir deles o motor gera:
 * - a lista de corte (painéis idênticos são agrupados, guardando os ids de origem),
 * - as junções estruturais, detectadas automaticamente onde dois painéis de estrutura se encostam,
 * - portas (dobradiças pela altura), prateleiras móveis (pinos) e fundos (pregos),
 * - avisos de painéis de estrutura que se sobrepõem.
 */
import type {
  AssembledModel,
  Box3D,
  CustomPanel,
  CustomPanelKind,
  CustomParams,
  CutPiece,
  DoorSpec,
  DragHandle,
  DrawerSpec,
  EdgeBanding,
  Joint,
  MaterialRole,
  PanelOrientation,
  PieceRole,
} from '@/types/woodcraft';
import {
  DRAWER_HEIGHT_CLEARANCE,
  DRAWER_MIN_BOX_HEIGHT,
  MIN_PIECE_SIZE,
  SLIDE_CLEARANCE_PER_SIDE,
  SLIDE_LENGTHS,
  SLIDE_REAR_CLEARANCE,
} from './constants';

/** Tolerância para considerar que duas faces se encostam (mm). */
const TOUCH_TOLERANCE = 0.5;

const floorMm = (v: number) => Math.floor(v + 1e-6);

/** Caixa 3D ocupada pelo painel (para a gaveta: o módulo inteiro, incluindo a frente). */
export function panelBox(p: CustomPanel): Box3D {
  if (p.kind === 'gaveta') return { x: p.x, y: p.y, z: p.z, w: p.width, h: p.height, d: p.depth + p.thickness };
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    w: p.orientation === 'side' ? p.thickness : p.width,
    h: p.orientation === 'horizontal' ? p.thickness : p.height,
    d: p.orientation === 'front' ? p.thickness : p.depth,
  };
}

/** Medidas de corte: comprimento no sentido do veio (vertical em pé, largura quando deitado). */
export function panelCutSize(p: CustomPanel): { length: number; width: number } {
  if (p.kind === 'gaveta') return { length: p.width, width: p.height };
  switch (p.orientation) {
    case 'side':
      return { length: p.height, width: p.depth };
    case 'front':
      return { length: p.height, width: p.width };
    case 'horizontal':
      return { length: p.width, width: p.depth };
  }
}

const ROLE: Record<CustomPanelKind, Record<PanelOrientation, PieceRole>> = {
  estrutura: { side: 'side', front: 'apron', horizontal: 'bottom' },
  prateleira: { side: 'shelf', front: 'shelf', horizontal: 'shelf' },
  fundo: { side: 'back', front: 'back', horizontal: 'back' },
  porta: { side: 'door', front: 'door', horizontal: 'door' },
  frente: { side: 'drawer-front', front: 'drawer-front', horizontal: 'drawer-front' },
  gaveta: { side: 'drawer-front', front: 'drawer-front', horizontal: 'drawer-front' },
};

const MATERIAL: Record<CustomPanelKind, MaterialRole> = {
  estrutura: 'carcass',
  prateleira: 'carcass',
  fundo: 'back',
  porta: 'front',
  frente: 'front',
  gaveta: 'front',
};

export const PANEL_KIND_LABELS: Record<CustomPanelKind, string> = {
  estrutura: 'Estrutura',
  prateleira: 'Prateleira móvel',
  fundo: 'Fundo',
  porta: 'Porta',
  frente: 'Frente / painel aparente',
  gaveta: 'Gaveta (módulo)',
};

/** Espessura da caixa e do fundo da gaveta do móvel livre. */
const DRAWER_BOX_T = 15;
const DRAWER_BOTTOM_T = 6;

/** Maior corrediça comercial que cabe na profundidade do vão. */
function slideFor(depth: number): number | null {
  const fits = SLIDE_LENGTHS.filter((l) => l <= depth - SLIDE_REAR_CLEARANCE);
  return fits.length ? fits[fits.length - 1]! : null;
}

interface Part {
  name: string;
  role: PieceRole;
  material: MaterialRole;
  length: number;
  width: number;
  thickness: number;
  edgeBanding: EdgeBanding;
  grain: 'length' | 'free';
  box: Box3D;
}

/**
 * Peças de um módulo de gaveta encaixado no vão (x, y, z, largura × profundidade):
 * frente (3 mm menor que o vão), caixa com folga de corrediça e fundo pregado por baixo.
 */
export function drawerModule(p: CustomPanel): { parts: Part[]; spec: DrawerSpec; warnings: string[] } {
  const warnings: string[] = [];
  const Wo = p.width;
  const Do = p.depth;
  const Hf = p.height;
  const slide = slideFor(Do);
  if (slide === null) warnings.push(`"${p.name}": profundidade de ${Math.round(Do)} mm é pouca para corrediça (mín. ${250 + SLIDE_REAR_CLEARANCE} mm).`);
  const L = slide ?? Math.max(MIN_PIECE_SIZE, Do - SLIDE_REAR_CLEARANCE);
  const boxW = Wo - 2 * SLIDE_CLEARANCE_PER_SIDE;
  const boxH = Math.max(DRAWER_MIN_BOX_HEIGHT, Hf - DRAWER_HEIGHT_CLEARANCE);
  const bx = p.x + SLIDE_CLEARANCE_PER_SIDE;
  const by = p.y + 10 + DRAWER_BOTTOM_T;
  const bz = p.z + Do - L;
  const edge1: EdgeBanding = { length: 1, width: 0 };
  const parts: Part[] = [
    {
      name: 'Frente de gaveta',
      role: 'drawer-front',
      material: 'front',
      length: Wo - 3,
      width: Hf - 3,
      thickness: p.thickness,
      edgeBanding: p.edgeBanding,
      grain: p.grainLocked ? 'length' : 'free',
      box: { x: p.x + 1.5, y: p.y + 1.5, z: p.z + Do, w: Wo - 3, h: Hf - 3, d: p.thickness },
    },
    ...[bx, bx + boxW - DRAWER_BOX_T].map((x): Part => ({
      name: 'Lateral da gaveta',
      role: 'drawer-side',
      material: 'drawer',
      length: L,
      width: boxH,
      thickness: DRAWER_BOX_T,
      edgeBanding: edge1,
      grain: 'length',
      box: { x, y: by, z: bz, w: DRAWER_BOX_T, h: boxH, d: L },
    })),
    ...[p.z + Do - DRAWER_BOX_T, bz].map((z): Part => ({
      name: 'Contra-frente / traseira da gaveta',
      role: 'drawer-back',
      material: 'drawer',
      length: boxW - 2 * DRAWER_BOX_T,
      width: boxH,
      thickness: DRAWER_BOX_T,
      edgeBanding: edge1,
      grain: 'length',
      box: { x: bx + DRAWER_BOX_T, y: by, z, w: boxW - 2 * DRAWER_BOX_T, h: boxH, d: DRAWER_BOX_T },
    })),
    {
      name: 'Fundo da gaveta',
      role: 'drawer-bottom',
      material: 'back',
      length: L,
      width: boxW,
      thickness: DRAWER_BOTTOM_T,
      edgeBanding: { length: 0, width: 0 },
      grain: 'free',
      box: { x: bx, y: by - DRAWER_BOTTOM_T, z: bz, w: boxW, h: DRAWER_BOTTOM_T, d: L },
    },
  ];
  return {
    parts,
    spec: { frontWidth: floorMm(Wo - 3), frontHeight: floorMm(Hf - 3), boxWidth: floorMm(boxW), boxHeight: floorMm(boxH), slideLength: L },
    warnings,
  };
}

/** Sobreposição de dois intervalos [a0, a1] e [b0, b1]. */
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);

/**
 * Se duas caixas se encostam por uma face, devolve o comprimento da junção
 * (maior lado do retângulo de contato); senão, null.
 */
export function contactLength(a: Box3D, b: Box3D): number | null {
  const ox = overlap(a.x, a.x + a.w, b.x, b.x + b.w);
  const oy = overlap(a.y, a.y + a.h, b.y, b.y + b.h);
  const oz = overlap(a.z, a.z + a.d, b.z, b.z + b.d);
  const t = TOUCH_TOLERANCE;
  // Encostadas: uma sobreposição ~0 (contato de faces) e as outras duas positivas.
  if (Math.abs(ox) <= t && oy > t && oz > t) return Math.max(oy, oz);
  if (Math.abs(oy) <= t && ox > t && oz > t) return Math.max(ox, oz);
  if (Math.abs(oz) <= t && ox > t && oy > t) return Math.max(ox, oy);
  return null;
}

/** true se as caixas se interpenetram (volume em comum). */
export function boxesIntersect(a: Box3D, b: Box3D): boolean {
  const t = TOUCH_TOLERANCE;
  return (
    overlap(a.x, a.x + a.w, b.x, b.x + b.w) > t &&
    overlap(a.y, a.y + a.h, b.y, b.y + b.h) > t &&
    overlap(a.z, a.z + a.d, b.z, b.z + b.d) > t
  );
}

export function buildCustom(params: CustomParams): AssembledModel {
  const warnings: string[] = [];
  const panels = params.panels.filter((p) => {
    const { length, width } = panelCutSize(p);
    const ok = length >= MIN_PIECE_SIZE && width >= MIN_PIECE_SIZE && p.thickness > 0;
    if (!ok) warnings.push(`"${p.name}" tem medidas muito pequenas (${floorMm(length)} × ${floorMm(width)} mm) e ficou fora da lista de corte.`);
    return ok;
  });

  // --- Peças (painéis idênticos viram uma linha com quantidade) --------------------------
  const groups = new Map<string, CutPiece>();
  const handles: DragHandle[] = [];
  const drawers: DrawerSpec[] = [];
  const joints: Joint[] = [];

  const addPart = (part: Part, panelId: string) => {
    const L = floorMm(part.length);
    const W = floorMm(part.width);
    const key = [part.name, part.role, part.material, L, W, part.thickness, part.edgeBanding.length, part.edgeBanding.width, part.grain].join('|');
    const box = part.box;
    handles.push({ kind: 'panel', box, panelId });
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += 1;
      existing.instances.push(box);
      if (!existing.sourceIds!.includes(panelId)) existing.sourceIds!.push(panelId);
      return;
    }
    groups.set(key, {
      id: '',
      name: part.name,
      role: part.role,
      material: part.material,
      quantity: 1,
      length: L,
      width: W,
      thickness: part.thickness,
      edgeBanding: part.edgeBanding,
      grain: part.grain,
      instances: [box],
      sourceIds: [panelId],
    });
  };

  for (const p of panels) {
    if (p.kind === 'gaveta') {
      const module = drawerModule(p);
      module.parts.forEach((part) => addPart(part, p.id));
      drawers.push(module.spec);
      warnings.push(...module.warnings);
      for (let c = 0; c < 4; c++) joints.push({ label: 'Canto de gaveta', length: module.spec.boxHeight });
      continue;
    }
    const { length, width } = panelCutSize(p);
    addPart(
      {
        // "Lateral 1" e "Lateral 2" iguais viram uma linha "Lateral" × 2 na lista de corte.
        name: p.name.trim().replace(/\s+\d+$/, '') || PANEL_KIND_LABELS[p.kind],
        role: ROLE[p.kind][p.orientation],
        material: MATERIAL[p.kind],
        length,
        width,
        thickness: p.thickness,
        edgeBanding: p.edgeBanding,
        grain: p.grainLocked && p.kind !== 'fundo' ? 'length' : 'free',
        box: panelBox(p),
      },
      p.id,
    );
  }
  const pieces = [...groups.values()].map((piece, i) => ({ ...piece, id: `painel-${i + 1}` }));
  const pieceOf = new Map(pieces.flatMap((piece) => piece.sourceIds!.map((sid) => [sid, piece.id] as const)));

  // --- Junções automáticas e sobreposições -------------------------------------------------
  const structural = panels.filter((p) => p.kind === 'estrutura');
  let structuralJoints = 0;
  for (let i = 0; i < structural.length; i++) {
    for (let j = i + 1; j < structural.length; j++) {
      const a = structural[i]!;
      const b = structural[j]!;
      const boxA = panelBox(a);
      const boxB = panelBox(b);
      if (boxesIntersect(boxA, boxB)) {
        warnings.push(`"${a.name}" e "${b.name}" estão sobrepostos — confira posições e medidas.`);
        continue;
      }
      const length = contactLength(boxA, boxB);
      if (length !== null) {
        joints.push({ label: `${a.name} × ${b.name}`, length });
        structuralJoints++;
      }
    }
  }
  if (structural.length > 1 && structuralJoints === 0) {
    warnings.push('Nenhum painel de estrutura encosta em outro: posicione as peças para que se toquem (as junções são calculadas pelo contato).');
  }

  // --- Portas, prateleiras, fundo --------------------------------------------------------------
  const doors: DoorSpec[] = panels
    .filter((p) => p.kind === 'porta')
    .map((p) => {
      const box = panelBox(p);
      const [width, height] = p.orientation === 'side' ? [box.d, box.h] : p.orientation === 'front' ? [box.w, box.h] : [box.w, box.d];
      return { pieceId: pieceOf.get(p.id) ?? '', width: floorMm(width), height: floorMm(height), hingeSide: 'left', overlay: 'full', box };
    });
  const adjustableShelves = panels.filter((p) => p.kind === 'prateleira').length;
  const backPerimeter = panels
    .filter((p) => p.kind === 'fundo')
    .reduce((acc, p) => {
      const { length, width } = panelCutSize(p);
      return acc + 2 * (length + width);
    }, 0);

  // --- Dimensões gerais (caixa envolvente) ----------------------------------------------------
  const boxes = panels.map(panelBox);
  const maxOf = (f: (b: Box3D) => number) => (boxes.length ? Math.max(...boxes.map(f)) : 0);
  const minOf = (f: (b: Box3D) => number) => (boxes.length ? Math.min(...boxes.map(f)) : 0);
  const overall = {
    width: floorMm(maxOf((b) => b.x + b.w) - Math.min(0, minOf((b) => b.x))),
    height: floorMm(maxOf((b) => b.y + b.h) - Math.min(0, minOf((b) => b.y))),
    depth: floorMm(maxOf((b) => b.z + b.d) - Math.min(0, minOf((b) => b.z))),
  };

  return {
    templateId: 'custom',
    overall,
    pieces,
    doors,
    drawers,
    joints,
    adjustableShelves,
    hangingRods: [],
    backPerimeter,
    baseType: 'none',
    assembly: params.assembly,
    layout: { columns: [], plinthHeight: 0, internalDepth: overall.depth },
    handles,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Criação de painéis (atalhos do editor)
// ---------------------------------------------------------------------------

let panelSeq = 0;
export const newPanelId = () => `p${Date.now().toString(36)}${(panelSeq++).toString(36)}`;

export type PanelPreset = 'lateral' | 'horizontal' | 'prateleira' | 'gaveta' | 'fundo' | 'porta' | 'livre';

export const PANEL_PRESETS: Array<{ id: PanelPreset; label: string; hint: string }> = [
  { id: 'lateral', label: 'Lateral', hint: 'Painel em pé, de lado, à direita do que já existe' },
  { id: 'horizontal', label: 'Base / tampo', hint: 'Painel deitado, em cima do que já existe' },
  { id: 'prateleira', label: 'Prateleira', hint: 'Prateleira móvel no meio da altura' },
  { id: 'gaveta', label: 'Gaveta', hint: 'Gaveta com corrediça encaixada entre as laterais, empilhada sobre a base' },
  { id: 'fundo', label: 'Fundo', hint: 'Fundo de 6 mm atrás do móvel' },
  { id: 'porta', label: 'Porta', hint: 'Porta cobrindo a frente do móvel' },
  { id: 'livre', label: 'Painel livre', hint: 'Painel frontal de 600 × 400 mm' },
];

/**
 * Cria um painel já posicionado em relação ao que existe (caixa envolvente).
 * Com o móvel vazio, parte de uma caixa de referência de 800 × 720 × 500 mm.
 */
export function createPanel(preset: PanelPreset, existing: CustomPanel[], thickness = 18): CustomPanel {
  const boxes = existing.map(panelBox);
  const empty = boxes.length === 0;
  const B = empty
    ? { x0: 0, y0: 0, z0: 0, x1: 800, y1: 720, z1: 500 }
    : {
        x0: Math.min(...boxes.map((b) => b.x)),
        y0: Math.min(...boxes.map((b) => b.y)),
        z0: Math.min(...boxes.map((b) => b.z)),
        x1: Math.max(...boxes.map((b) => b.x + b.w)),
        y1: Math.max(...boxes.map((b) => b.y + b.h)),
        z1: Math.max(...boxes.map((b) => b.z + b.d)),
      };
  const W = B.x1 - B.x0;
  const H = B.y1 - B.y0;
  const D = B.z1 - B.z0;
  const T = thickness;
  const count = (kind: string) => existing.filter((p) => p.name.startsWith(kind)).length + 1;
  const base = { id: newPanelId(), edgeBanding: { length: 1, width: 0 } as EdgeBanding, grainLocked: true, thickness: T };

  const sides = existing.filter((p) => p.orientation === 'side' && p.kind === 'estrutura');

  switch (preset) {
    case 'lateral': {
      // 1ª lateral na origem; 2ª a 800 mm (largura de referência) se só há uma lateral; depois, ao lado do conjunto.
      const onlyOneSide = sides.length === 1 && W < 100;
      const x = empty ? 0 : onlyOneSide ? sides[0]!.x + 800 - T : B.x1;
      return { ...base, name: `Lateral ${count('Lateral')}`, kind: 'estrutura', orientation: 'side', width: W, height: H, depth: D, x, y: B.y0, z: B.z0 };
    }
    case 'horizontal': {
      if (sides.length >= 2) {
        // Entre as laterais das pontas: primeiro a base, depois o tampo, depois empilha em cima.
        const left = sides.reduce((a, b) => (b.x < a.x ? b : a));
        const right = sides.reduce((a, b) => (b.x > a.x ? b : a));
        const x = left.x + left.thickness;
        const width = right.x - x;
        const depth = Math.max(...sides.map((p) => p.depth));
        const z = Math.min(...sides.map((p) => p.z));
        const between = existing.filter((p) => p.orientation === 'horizontal' && p.kind === 'estrutura' && p.x >= x - 1 && p.x < right.x);
        const hasBottom = between.some((p) => Math.abs(p.y - B.y0) < 1);
        const hasTop = between.some((p) => Math.abs(p.y + p.thickness - B.y1) < 1);
        const [name, y] = !hasBottom ? ['Base', B.y0] : !hasTop ? ['Tampo', B.y1 - T] : [`Painel horizontal ${count('Painel horizontal')}`, B.y1];
        return { ...base, name, kind: 'estrutura', orientation: 'horizontal', width, height: H, depth, x, y, z };
      }
      return { ...base, name: `Painel horizontal ${count('Painel horizontal')}`, kind: 'estrutura', orientation: 'horizontal', width: W, height: H, depth: D, x: B.x0, y: empty ? 0 : B.y1, z: B.z0 };
    }
    case 'prateleira':
      return {
        ...base,
        name: 'Prateleira',
        kind: 'prateleira',
        orientation: 'horizontal',
        width: Math.max(MIN_PIECE_SIZE, W - 2 * T - 2),
        height: H,
        depth: Math.max(MIN_PIECE_SIZE, D - 20),
        x: B.x0 + T + 1,
        y: Math.round(B.y0 + H / 2),
        z: B.z0,
      };
    case 'gaveta': {
      let x = B.x0;
      let width = W;
      let depth = D;
      let z = B.z0;
      const inSpan: CustomPanel[] = [];
      if (sides.length >= 2) {
        const left = sides.reduce((a, b) => (b.x < a.x ? b : a));
        const right = sides.reduce((a, b) => (b.x > a.x ? b : a));
        x = left.x + left.thickness;
        width = right.x - x;
        depth = Math.max(...sides.map((p) => p.depth));
        z = Math.min(...sides.map((p) => p.z));
        inSpan.push(...existing.filter((p) => p.x >= x - 1 && p.x < right.x));
      }
      // Empilha sobre a peça mais alta abaixo do tampo (base, prateleira fixa ou outra gaveta).
      const tops = inSpan
        .filter((p) => p.kind === 'gaveta' || (p.kind === 'estrutura' && p.orientation === 'horizontal'))
        .map((p) => p.y + (p.kind === 'gaveta' ? p.height : p.thickness))
        .filter((top) => top < B.y1 - 0.5);
      const y = tops.length ? Math.max(...tops) : B.y0;
      return {
        ...base,
        name: `Gaveta ${count('Gaveta')}`,
        kind: 'gaveta',
        orientation: 'front',
        width,
        height: 180,
        depth,
        x,
        y,
        z,
        edgeBanding: { length: 2, width: 2 },
      };
    }
    case 'fundo':
      return { ...base, name: 'Fundo', kind: 'fundo', orientation: 'front', thickness: 6, width: W, height: H, depth: D, x: B.x0, y: B.y0, z: B.z0 - 6, edgeBanding: { length: 0, width: 0 }, grainLocked: false };
    case 'porta':
      return { ...base, name: `Porta ${count('Porta')}`, kind: 'porta', orientation: 'front', width: W - 3, height: H - 3, depth: D, x: B.x0 + 1.5, y: B.y0 + 1.5, z: B.z1, edgeBanding: { length: 2, width: 2 } };
    case 'livre':
      return { ...base, name: `Painel ${count('Painel ')}`, kind: 'estrutura', orientation: 'front', width: 600, height: 400, depth: D, x: empty ? 0 : B.x1 + 50, y: B.y0, z: B.z0 };
  }
}
