/**
 * Motor de cálculo de peças (explosão do móvel em lista de corte).
 *
 * Recebe os parâmetros globais de um template e devolve um `AssembledModel` com:
 * - as peças reais de corte (descontadas as espessuras das chapas adjacentes),
 * - a posição 3D de cada unidade (para o viewport),
 * - as especificações de portas/gavetas e as junções (para o cálculo de ferragens).
 *
 * Módulo em TypeScript puro: não depende de React nem do DOM, e pode ser testado isoladamente.
 *
 * Convenção de construção da caixa ("caixa de marceneiro" padrão):
 * - Laterais inteiras (vão do chão/base até o topo); base, tampo, travessas e prateleiras
 *   fixas ENTRE as laterais → largura interna = L − 2·E.
 * - Frentes sobrepostas (portas e gavetas cobrem a caixa), com folga `frontGap` entre frentes.
 *   Sobre uma divisória, cada frente cobre metade dela (dobradiça curva).
 * - Profundidade informada = profundidade da caixa, sem contar as frentes.
 */
import type {
  AssembledModel,
  Box3D,
  CabinetParams,
  CutPiece,
  DoorSpec,
  DrawerSpec,
  EdgeBanding,
  GrainDirection,
  Joint,
  MaterialRole,
  PieceRole,
  TemplateId,
  WorkbenchParams,
} from '@/types/woodcraft';
import {
  DRAWER_HEIGHT_CLEARANCE,
  DRAWER_MIN_BOX_HEIGHT,
  GROOVE_BACK_CLEARANCE,
  GROOVE_DEPTH,
  GROOVE_OFFSET,
  MAX_DOOR_LEAF_WIDTH,
  MIN_PIECE_SIZE,
  OVERLAY_BACK_REDUCTION,
  RAIL_WIDTH,
  ROD_DROP,
  ROD_MIN_HANGING,
  ROD_SHELF_SPACING,
  SHELF_FRONT_SETBACK,
  SHELF_SIDE_CLEARANCE,
  SLIDE_CLEARANCE_PER_SIDE,
  SLIDE_LENGTHS,
  SLIDE_REAR_CLEARANCE,
} from './constants';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Medida de corte: arredonda para baixo ao mm (frentes nunca ficam maiores que o vão). */
export const cutMm = (v: number): number => Math.floor(v + 1e-6);

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface PieceInput {
  name: string;
  role: PieceRole;
  material: MaterialRole;
  length: number;
  width: number;
  thickness: number;
  edgeBanding: EdgeBanding;
  grain?: GrainDirection;
  instances: Box3D[];
  notes?: string;
}

const EDGE = {
  none: { length: 0, width: 0 },
  oneLong: { length: 1, width: 0 },
  twoLong: { length: 2, width: 0 },
  all: { length: 2, width: 2 },
} as const satisfies Record<string, EdgeBanding>;

/**
 * Acumula peças e agrupa as idênticas (mesmo nome, papel, material, medidas e fita)
 * em uma única linha com quantidade > 1, preservando a posição de cada unidade.
 */
class PieceCollector {
  private readonly map = new Map<string, CutPiece>();
  readonly warnings: string[] = [];

  add(p: PieceInput): void {
    const length = cutMm(p.length);
    const width = cutMm(p.width);
    if (p.instances.length === 0) return;
    if (length < MIN_PIECE_SIZE || width < MIN_PIECE_SIZE) {
      this.warnings.push(
        `"${p.name}" ficou com ${length} × ${width} mm (abaixo de ${MIN_PIECE_SIZE} mm) e foi descartada. Revise as medidas.`,
      );
      return;
    }
    const key = [p.name, p.role, p.material, length, width, p.thickness, p.edgeBanding.length, p.edgeBanding.width].join('|');
    const existing = this.map.get(key);
    if (existing) {
      existing.quantity += p.instances.length;
      existing.instances.push(...p.instances);
      return;
    }
    this.map.set(key, {
      id: '',
      name: p.name,
      role: p.role,
      material: p.material,
      quantity: p.instances.length,
      length,
      width,
      thickness: p.thickness,
      edgeBanding: p.edgeBanding,
      grain: p.grain ?? 'length',
      instances: [...p.instances],
      notes: p.notes,
    });
  }

  /** Devolve as peças com ids estáveis (`role-n`). */
  pieces(): CutPiece[] {
    const counters = new Map<string, number>();
    return [...this.map.values()].map((piece) => {
      const n = (counters.get(piece.role) ?? 0) + 1;
      counters.set(piece.role, n);
      return { ...piece, id: `${piece.role}-${n}` };
    });
  }
}

/** Distribui um total inteiro em partes proporcionais aos pesos; a última absorve o arredondamento. */
export function splitByRatio(total: number, ratios: number[]): number[] {
  const safe = ratios.map((r) => (Number.isFinite(r) && r > 0 ? r : 1));
  const sum = safe.reduce((a, b) => a + b, 0);
  const parts = safe.map((r) => Math.round((total * r) / sum));
  const assigned = parts.slice(0, -1).reduce((a, b) => a + b, 0);
  parts[parts.length - 1] = total - assigned;
  return parts;
}

/** Maior corrediça comercial que cabe na profundidade interna disponível. */
export function pickSlideLength(internalDepth: number): number | null {
  const available = internalDepth - SLIDE_REAR_CLEARANCE;
  const fits = SLIDE_LENGTHS.filter((l) => l <= available);
  return fits.length ? fits[fits.length - 1]! : null;
}

// ---------------------------------------------------------------------------
// Móveis de caixa: balcão, aéreo, guarda-roupa
// ---------------------------------------------------------------------------

/**
 * Calcula todas as peças de um móvel de caixa com vãos, divisórias, gavetas, portas e prateleiras.
 */
export function buildCarcass(templateId: TemplateId, input: CabinetParams): AssembledModel {
  const p: CabinetParams = {
    ...input,
    width: clamp(input.width, 150, 5000),
    height: clamp(input.height, 150, 3000),
    depth: clamp(input.depth, 100, 1200),
    carcassThickness: clamp(input.carcassThickness, 6, 40),
    backThickness: clamp(input.backThickness, 3, 40),
    frontThickness: clamp(input.frontThickness, 6, 40),
    drawerBoxThickness: clamp(input.drawerBoxThickness, 6, 40),
    plinthHeight: input.baseType === 'none' ? 0 : clamp(input.plinthHeight, 0, 400),
    plinthSetback: clamp(input.plinthSetback, 0, 200),
    frontGap: clamp(input.frontGap, 0, 10),
    drawerFrontHeight: clamp(input.drawerFrontHeight, 60, 600),
    columns: input.columns.length ? input.columns : [{ id: 'c', widthRatio: 1, drawers: 0, doors: 1, shelves: 0, hangingRod: false }],
  };

  const W = p.width;
  const H = p.height;
  const D = p.depth;
  const T = p.carcassThickness;
  const Tb = p.backThickness;
  const Tf = p.frontThickness;
  const Td = p.drawerBoxThickness;
  const g = p.frontGap;

  const out = new PieceCollector();
  const warnings = out.warnings;
  const joints: Joint[] = [];
  const doors: Omit<DoorSpec, 'pieceId'>[] = [];
  const drawers: DrawerSpec[] = [];
  const hangingRods: number[] = [];
  let adjustableShelves = 0;

  // --- Referências verticais --------------------------------------------------
  const hasPlinth = p.baseType === 'plinth' && p.plinthHeight > 0;
  /** Face inferior da base (acima do rodapé ou dos pés). */
  const baseY = p.plinthHeight;
  /** Onde as laterais começam: no chão com rodapé, ou junto com a base quando suspensa. */
  const sideY0 = hasPlinth ? 0 : baseY;
  const bottomTop = baseY + T;
  const topUnder = H - T;
  const interiorH = topUnder - bottomTop;

  // --- Referências de profundidade -------------------------------------------
  const overlayBack = p.backMode === 'overlay';
  /** Laterais, base e tampo: no fundo sobreposto descontam a espessura do fundo. */
  const sideDepth = overlayBack ? D - Tb : D;
  const sideZ0 = D - sideDepth;
  /** Profundidade útil interna (até o fundo). Divisórias e prateleiras fixas param aqui. */
  const internalDepth = overlayBack ? D - Tb : D - GROOVE_OFFSET - Tb;
  const internalZ0 = D - internalDepth;

  const innerW = W - 2 * T;
  if (innerW <= 0 || interiorH <= 0) {
    warnings.push('As espessuras informadas não cabem nas dimensões externas do móvel.');
  }
  if (!overlayBack && Tb > T / 2) {
    warnings.push(`Fundo de ${Tb} mm é espesso demais para rasgo em chapa de ${T} mm; prefira fundo de 3–6 mm.`);
  }

  // --- Laterais ----------------------------------------------------------------
  out.add({
    name: 'Lateral',
    role: 'side',
    material: 'carcass',
    length: H - sideY0,
    width: sideDepth,
    thickness: T,
    edgeBanding: EDGE.oneLong,
    instances: [0, W - T].map((x) => ({ x, y: sideY0, z: sideZ0, w: T, h: H - sideY0, d: sideDepth })),
    notes: overlayBack ? undefined : `Rasgo p/ fundo: ${GROOVE_DEPTH} mm de profundidade a ${GROOVE_OFFSET} mm da traseira`,
  });

  // --- Base ---------------------------------------------------------------------
  out.add({
    name: 'Base',
    role: 'bottom',
    material: 'carcass',
    length: innerW,
    width: sideDepth,
    thickness: T,
    edgeBanding: EDGE.oneLong,
    instances: [{ x: T, y: baseY, z: sideZ0, w: innerW, h: T, d: sideDepth }],
  });
  joints.push({ label: 'Base × laterais', length: sideDepth }, { label: 'Base × laterais', length: sideDepth });

  // --- Tampo ou travessas --------------------------------------------------------
  if (p.topType === 'full') {
    out.add({
      name: 'Tampo',
      role: 'top',
      material: 'carcass',
      length: innerW,
      width: sideDepth,
      thickness: T,
      edgeBanding: EDGE.oneLong,
      instances: [{ x: T, y: H - T, z: sideZ0, w: innerW, h: T, d: sideDepth }],
    });
    joints.push({ label: 'Tampo × laterais', length: sideDepth }, { label: 'Tampo × laterais', length: sideDepth });
  } else {
    const rail = Math.min(RAIL_WIDTH, sideDepth / 2);
    out.add({
      name: 'Travessa superior',
      role: 'rail',
      material: 'carcass',
      length: innerW,
      width: rail,
      thickness: T,
      edgeBanding: EDGE.oneLong,
      instances: [D - rail, sideZ0].map((z) => ({ x: T, y: H - T, z, w: innerW, h: T, d: rail })),
      notes: 'Uma frontal e uma traseira; o tampo (pedra/madeira) apoia sobre elas.',
    });
    for (let i = 0; i < 4; i++) joints.push({ label: 'Travessa × laterais', length: rail });
  }

  // --- Rodapé ---------------------------------------------------------------------
  if (hasPlinth) {
    const plinthZ = D - p.plinthSetback - T;
    if (plinthZ < sideZ0) warnings.push('O recuo do rodapé é maior que a profundidade da caixa.');
    out.add({
      name: 'Rodapé',
      role: 'plinth',
      material: 'carcass',
      length: innerW,
      width: p.plinthHeight,
      thickness: T,
      edgeBanding: EDGE.none,
      instances: [{ x: T, y: 0, z: Math.max(sideZ0, plinthZ), w: innerW, h: p.plinthHeight, d: T }],
      notes: p.plinthSetback > 0 ? `Recuado ${p.plinthSetback} mm da frente` : undefined,
    });
  }

  // --- Fundo ------------------------------------------------------------------------
  if (overlayBack) {
    const backH = H - baseY - OVERLAY_BACK_REDUCTION;
    const backW = W - OVERLAY_BACK_REDUCTION;
    const inset = OVERLAY_BACK_REDUCTION / 2;
    out.add({
      name: 'Fundo',
      role: 'back',
      material: 'back',
      length: backH,
      width: backW,
      thickness: Tb,
      edgeBanding: EDGE.none,
      grain: 'free',
      instances: [{ x: inset, y: baseY + inset, z: 0, w: backW, h: backH, d: Tb }],
      notes: 'Sobreposto: pregado/grampeado na traseira da caixa',
    });
  } else {
    const backH = interiorH + 2 * GROOVE_DEPTH - GROOVE_BACK_CLEARANCE;
    const backW = innerW + 2 * GROOVE_DEPTH - GROOVE_BACK_CLEARANCE;
    out.add({
      name: 'Fundo',
      role: 'back',
      material: 'back',
      length: backH,
      width: backW,
      thickness: Tb,
      edgeBanding: EDGE.none,
      grain: 'free',
      instances: [{ x: T - GROOVE_DEPTH + 1, y: bottomTop - GROOVE_DEPTH + 1, z: GROOVE_OFFSET, w: backW, h: backH, d: Tb }],
      notes: 'Encaixado em rasgo nas laterais, base e tampo',
    });
  }

  // --- Vãos (colunas) e divisórias ----------------------------------------------------
  const nCols = p.columns.length;
  const available = innerW - (nCols - 1) * T;
  const colWidths = splitByRatio(Math.max(0, available), p.columns.map((c) => c.widthRatio));
  const columnSpans: Array<[number, number]> = [];
  let cursor = T;
  colWidths.forEach((w, i) => {
    columnSpans.push([cursor, cursor + w]);
    cursor += w;
    if (i < nCols - 1) {
      out.add({
        name: 'Divisória',
        role: 'divider',
        material: 'carcass',
        length: interiorH,
        width: internalDepth,
        thickness: T,
        edgeBanding: EDGE.oneLong,
        instances: [{ x: cursor, y: bottomTop, z: internalZ0, w: T, h: interiorH, d: internalDepth }],
      });
      joints.push({ label: 'Divisória × base', length: internalDepth });
      if (p.topType === 'full') joints.push({ label: 'Divisória × tampo', length: internalDepth });
      else joints.push({ label: 'Divisória × travessas', length: RAIL_WIDTH }, { label: 'Divisória × travessas', length: RAIL_WIDTH });
      cursor += T;
    }
  });

  const slideLength = pickSlideLength(internalDepth);

  p.columns.forEach((col, i) => {
    const [x0, x1] = columnSpans[i]!;
    const colW = x1 - x0;
    const label = nCols > 1 ? ` (vão ${i + 1})` : '';
    if (colW < 100) warnings.push(`Vão ${i + 1} ficou com apenas ${Math.round(colW)} mm de largura interna.`);

    // Limites das frentes: bordas externas da caixa ou centro das divisórias.
    const fx0 = i === 0 ? 0 : x0 - T / 2;
    const fx1 = i === nCols - 1 ? W : x1 + T / 2;
    const frontSpan = fx1 - fx0;
    const frontBottom = baseY + g / 2;
    const frontTop = H - g / 2;

    const nDrawers = Math.max(0, Math.floor(col.drawers));
    const nDoors = col.doors;

    // Região interna livre para portas/prateleiras e faixa das frentes da porta.
    let regionTop = topUnder;
    let regionBottom = bottomTop;
    let doorTop = frontTop;
    let doorBottom = frontBottom;

    // --- Gavetas --------------------------------------------------------------------
    if (nDrawers > 0) {
      const mixed = nDoors > 0;
      const atBottom = mixed && col.drawerPosition === 'bottom';
      const fh = mixed ? p.drawerFrontHeight : (frontTop - frontBottom - (nDrawers - 1) * g) / nDrawers;
      const boxW = colW - 2 * SLIDE_CLEARANCE_PER_SIDE;
      const slide = slideLength ?? Math.max(MIN_PIECE_SIZE, internalDepth - SLIDE_REAR_CLEARANCE);
      if (slideLength === null) warnings.push('Profundidade interna insuficiente para corrediça comercial (mín. 250 mm).');
      if (fh < 100) warnings.push(`Frente de gaveta com ${Math.round(fh)} mm é baixa demais para uma caixa útil.`);

      // Limites internos do gaveteiro (entre base/tampo e a prateleira fixa).
      let drawerFloor = bottomTop;
      let drawerCeiling = topUnder;

      if (mixed) {
        // Prateleira fixa separando gaveteiro e porta, centrada na folga entre as frentes.
        const boundary = atBottom ? frontBottom + nDrawers * (fh + g) - g / 2 : frontTop - nDrawers * (fh + g) + g / 2;
        const shelfY = boundary - T / 2;
        if (atBottom) {
          doorBottom = boundary + g / 2;
          regionBottom = shelfY + T;
          drawerCeiling = shelfY;
        } else {
          doorTop = boundary - g / 2;
          regionTop = shelfY;
          drawerFloor = shelfY + T;
        }
        out.add({
          name: 'Prateleira fixa',
          role: 'fixed-shelf',
          material: 'carcass',
          length: colW,
          width: internalDepth,
          thickness: T,
          edgeBanding: EDGE.oneLong,
          instances: [{ x: x0, y: shelfY, z: internalZ0, w: colW, h: T, d: internalDepth }],
          notes: 'Separa gavetas e porta',
        });
        joints.push({ label: 'Prateleira fixa × laterais', length: internalDepth }, { label: 'Prateleira fixa × laterais', length: internalDepth });
      } else {
        regionTop = bottomTop; // vão só de gavetas: não sobra região para prateleiras
      }

      for (let k = 0; k < nDrawers; k++) {
        const bottom = atBottom ? frontBottom + k * (fh + g) : frontTop - k * (fh + g) - fh;
        const frontW = frontSpan - g;
        out.add({
          name: 'Frente de gaveta',
          role: 'drawer-front',
          material: 'front',
          length: frontW,
          width: fh,
          thickness: Tf,
          edgeBanding: EDGE.all,
          instances: [{ x: fx0 + g / 2, y: bottom, z: D, w: frontW, h: fh, d: Tf }],
        });

        // A caixa fica 10 mm acima do piso do vão (fundo pregado por baixo) e abaixo do teto.
        const boxX = x0 + SLIDE_CLEARANCE_PER_SIDE;
        const boxY = Math.max(bottom, drawerFloor) + 10 + Tb;
        const slotTop = Math.min(bottom + fh, drawerCeiling);
        const boxH = Math.max(DRAWER_MIN_BOX_HEIGHT, Math.min(fh - DRAWER_HEIGHT_CLEARANCE, slotTop - boxY - 5));
        const boxZ = D - slide;
        out.add({
          name: 'Lateral da gaveta',
          role: 'drawer-side',
          material: 'drawer',
          length: slide,
          width: boxH,
          thickness: Td,
          edgeBanding: EDGE.oneLong,
          instances: [boxX, boxX + boxW - Td].map((x) => ({ x, y: boxY, z: boxZ, w: Td, h: boxH, d: slide })),
        });
        out.add({
          name: 'Contra-frente / traseira da gaveta',
          role: 'drawer-back',
          material: 'drawer',
          length: boxW - 2 * Td,
          width: boxH,
          thickness: Td,
          edgeBanding: EDGE.oneLong,
          instances: [D - Td, boxZ].map((z) => ({ x: boxX + Td, y: boxY, z, w: boxW - 2 * Td, h: boxH, d: Td })),
        });
        out.add({
          name: 'Fundo da gaveta',
          role: 'drawer-bottom',
          material: 'back',
          length: slide,
          width: boxW,
          thickness: Tb,
          edgeBanding: EDGE.none,
          grain: 'free',
          instances: [{ x: boxX, y: boxY - Tb, z: boxZ, w: boxW, h: Tb, d: slide }],
          notes: 'Pregado/grampeado por baixo da caixa',
        });
        drawers.push({
          frontWidth: cutMm(frontW),
          frontHeight: cutMm(fh),
          boxWidth: cutMm(boxW),
          boxHeight: cutMm(boxH),
          slideLength: slide,
        });
        // Cada caixa de gaveta tem 4 cantos parafusados.
        for (let c = 0; c < 4; c++) joints.push({ label: 'Canto de gaveta', length: boxH });
      }
    }

    // --- Portas ---------------------------------------------------------------------
    if (nDoors > 0) {
      const doorH = doorTop - doorBottom;
      if (doorH < 150) warnings.push(`Porta do vão ${i + 1} ficou com ${Math.round(doorH)} mm de altura.`);
      const leafW = nDoors === 1 ? frontSpan - g : (frontSpan - 2 * g) / 2;
      if (leafW > MAX_DOOR_LEAF_WIDTH) {
        warnings.push(`Porta do vão ${i + 1} com ${Math.round(leafW)} mm de largura: acima de ${MAX_DOOR_LEAF_WIDTH} mm há risco de empenar — considere 2 folhas.`);
      }
      const isFirst = i === 0;
      const isLast = i === nCols - 1;
      const leaves: Array<{ x: number; hingeSide: 'left' | 'right'; outer: boolean }> =
        nDoors === 1
          ? [isLast && nCols > 1 ? { x: fx0 + g / 2, hingeSide: 'right', outer: true } : { x: fx0 + g / 2, hingeSide: 'left', outer: isFirst }]
          : [
              { x: fx0 + g / 2, hingeSide: 'left', outer: isFirst },
              { x: fx0 + g / 2 + leafW + g, hingeSide: 'right', outer: isLast },
            ];
      for (const leaf of leaves) {
        out.add({
          name: 'Porta',
          role: 'door',
          material: 'front',
          length: doorH,
          width: leafW,
          thickness: Tf,
          edgeBanding: EDGE.all,
          instances: [{ x: leaf.x, y: doorBottom, z: D, w: leafW, h: doorH, d: Tf }],
        });
        doors.push({ width: cutMm(leafW), height: cutMm(doorH), hingeSide: leaf.hingeSide, overlay: leaf.outer ? 'full' : 'half' });
      }
    }

    // --- Prateleiras móveis e cabideiro ------------------------------------------------
    const regionH = regionTop - regionBottom;
    const nShelves = nDrawers > 0 && nDoors === 0 ? 0 : Math.max(0, Math.floor(col.shelves));
    if (nDrawers > 0 && nDoors === 0 && col.shelves > 0) {
      warnings.push(`Vão ${i + 1} tem apenas gavetas; prateleiras foram ignoradas.`);
    }
    const setback = nDoors > 0 ? SHELF_FRONT_SETBACK : 0;
    const shelfLen = colW - SHELF_SIDE_CLEARANCE;
    const shelfDepth = internalDepth - setback;
    const shelfYs: number[] = [];
    if (nShelves > 0 && regionH > T) {
      if (col.hangingRod) {
        for (let k = 0; k < nShelves; k++) {
          const y = regionTop - ROD_SHELF_SPACING * (k + 1);
          if (y > regionBottom + T) shelfYs.push(y);
        }
      } else {
        const spacing = regionH / (nShelves + 1);
        for (let k = 1; k <= nShelves; k++) shelfYs.push(regionBottom + k * spacing - T / 2);
      }
    }
    if (shelfYs.length) {
      out.add({
        name: 'Prateleira móvel',
        role: 'shelf',
        material: 'carcass',
        length: shelfLen,
        width: shelfDepth,
        thickness: T,
        edgeBanding: EDGE.oneLong,
        instances: shelfYs.map((y) => ({ x: x0 + SHELF_SIDE_CLEARANCE / 2, y, z: internalZ0, w: shelfLen, h: T, d: shelfDepth })),
        notes: label ? `Apoiada em pinos${label}` : 'Apoiada em pinos',
      });
      adjustableShelves += shelfYs.length;
    }

    if (col.hangingRod && regionH > T) {
      const lowest = shelfYs.length ? Math.min(...shelfYs) : regionTop;
      const rodY = lowest - ROD_DROP;
      if (rodY - regionBottom < ROD_MIN_HANGING) {
        warnings.push(`Cabideiro do vão ${i + 1} tem apenas ${Math.round(rodY - regionBottom)} mm de altura livre (recomendado ≥ ${ROD_MIN_HANGING} mm).`);
      }
      hangingRods.push(cutMm(colW - 2));
    }
  });

  const pieces = out.pieces();
  const doorPieceId = (d: Omit<DoorSpec, 'pieceId'>) =>
    pieces.find((pc) => pc.role === 'door' && pc.length === d.height && pc.width === d.width)?.id ?? '';

  return {
    templateId,
    overall: { width: W, height: H, depth: D },
    pieces,
    doors: doors.map((d) => ({ ...d, pieceId: doorPieceId(d) })),
    drawers,
    joints,
    adjustableShelves,
    hangingRods,
    backPerimeter: overlayBack ? 2 * (W + H - baseY) : 0,
    baseType: p.baseType,
    assembly: p.assembly,
    layout: { columns: columnSpans, plinthHeight: baseY, internalDepth },
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Mesa de trabalho
// ---------------------------------------------------------------------------

/** Calcula as peças de uma mesa com tampo sobre dois painéis laterais. */
export function buildWorkbench(input: WorkbenchParams): AssembledModel {
  const p: WorkbenchParams = {
    ...input,
    width: clamp(input.width, 300, 4000),
    height: clamp(input.height, 300, 1500),
    depth: clamp(input.depth, 250, 1500),
    topThickness: clamp(input.topThickness, 12, 80),
    panelThickness: clamp(input.panelThickness, 12, 50),
    sideOverhang: clamp(input.sideOverhang, 0, 400),
    apronHeight: clamp(input.apronHeight, 50, 400),
  };
  const { width: W, height: H, depth: D, topThickness: Tt, panelThickness: Tp, sideOverhang: o } = p;
  const out = new PieceCollector();
  const joints: Joint[] = [];

  const legH = H - Tt;
  const legD = D - 2 * o;
  const between = W - 2 * o - 2 * Tp;
  if (between <= 0 || legD <= 0) out.warnings.push('O balanço do tampo é grande demais para as dimensões da mesa.');

  out.add({
    name: 'Tampo',
    role: 'worktop',
    material: 'carcass',
    length: W,
    width: D,
    thickness: Tt,
    edgeBanding: EDGE.all,
    instances: [{ x: 0, y: legH, z: 0, w: W, h: Tt, d: D }],
  });
  out.add({
    name: 'Painel lateral (pé)',
    role: 'leg-panel',
    material: 'carcass',
    length: legH,
    width: legD,
    thickness: Tp,
    edgeBanding: EDGE.twoLong,
    instances: [o, W - o - Tp].map((x) => ({ x, y: 0, z: o, w: Tp, h: legH, d: legD })),
  });
  out.add({
    name: 'Saia traseira',
    role: 'apron',
    material: 'carcass',
    length: between,
    width: p.apronHeight,
    thickness: Tp,
    edgeBanding: EDGE.oneLong,
    instances: [{ x: o + Tp, y: legH - p.apronHeight, z: o, w: between, h: p.apronHeight, d: Tp }],
  });
  joints.push({ label: 'Saia × painéis', length: p.apronHeight }, { label: 'Saia × painéis', length: p.apronHeight });

  if (p.lowerShelf) {
    const shelfY = clamp(p.lowerShelfHeight, 50, legH - p.apronHeight - Tp - 100);
    const shelfD = legD - Tp;
    out.add({
      name: 'Prateleira inferior',
      role: 'fixed-shelf',
      material: 'carcass',
      length: between,
      width: shelfD,
      thickness: Tp,
      edgeBanding: EDGE.oneLong,
      instances: [{ x: o + Tp, y: shelfY, z: o + Tp, w: between, h: Tp, d: shelfD }],
    });
    joints.push({ label: 'Prateleira × painéis', length: shelfD }, { label: 'Prateleira × painéis', length: shelfD });
  }

  // Tampo fixado por baixo com cantoneiras nos painéis e na saia.
  joints.push(
    { label: 'Tampo × painéis', length: legD, bracket: true },
    { label: 'Tampo × painéis', length: legD, bracket: true },
    { label: 'Tampo × saia', length: between, bracket: true },
  );

  return {
    templateId: 'workbench',
    overall: { width: W, height: H, depth: D },
    pieces: out.pieces(),
    doors: [],
    drawers: [],
    joints,
    adjustableShelves: 0,
    hangingRods: [],
    backPerimeter: 0,
    baseType: 'none',
    assembly: p.assembly,
    layout: { columns: [[o + Tp, W - o - Tp]], plinthHeight: 0, internalDepth: legD },
    warnings: out.warnings,
  };
}

// ---------------------------------------------------------------------------
// Ponto de entrada
// ---------------------------------------------------------------------------

export type ModelInput =
  | { templateId: 'workbench'; params: WorkbenchParams }
  | { templateId: Exclude<TemplateId, 'workbench'>; params: CabinetParams };

/** Monta o modelo do móvel a partir do template selecionado. */
export function buildModel(input: ModelInput): AssembledModel {
  return input.templateId === 'workbench' ? buildWorkbench(input.params) : buildCarcass(input.templateId, input.params);
}

// ---------------------------------------------------------------------------
// Métricas derivadas da lista de corte
// ---------------------------------------------------------------------------

/** Metragem linear (m) de fita de borda de uma linha da lista de corte (todas as unidades). */
export function edgeBandingMeters(piece: CutPiece): number {
  const perUnit = piece.edgeBanding.length * piece.length + piece.edgeBanding.width * piece.width;
  return (perUnit * piece.quantity) / 1000;
}

/** Área (m²) de uma linha da lista de corte. */
export function pieceArea(piece: CutPiece): number {
  return (piece.length * piece.width * piece.quantity) / 1e6;
}

/** Notação usada pelas madeireiras: "1C 2L" = 1 comprimento e 2 larguras com fita. */
export function edgeBandingLabel(e: EdgeBanding): string {
  if (!e.length && !e.width) return '—';
  return [e.length ? `${e.length}C` : '', e.width ? `${e.width}L` : ''].filter(Boolean).join(' ');
}
