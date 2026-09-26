/**
 * Otimizador de plano de corte — 2D Guillotine Bin Packing.
 *
 * Baseado no algoritmo "Guillotine" descrito por Jukka Jylänki
 * ("A Thousand Ways to Pack the Bin", 2010), adaptado para marcenaria:
 * - Considera o kerf (espessura do disco) entre peças adjacentes.
 * - Considera o refilo das bordas da chapa.
 * - Respeita o veio: peças com veio travado não podem girar em chapas amadeiradas.
 * - Todo corte gerado é "de guilhotina" (atravessa o retalho de ponta a ponta), o que
 *   é compatível com seccionadoras e com serra circular com guia.
 *
 * Como heurísticas gulosas variam muito com a ordem das peças, o otimizador roda
 * várias combinações (ordenação × critério de encaixe × regra de divisão × seleção de chapa)
 * e mantém o melhor resultado ("multi-start").
 *
 * Módulo em TypeScript puro, sem dependências.
 */
import type {
  CutPiece,
  MaterialRole,
  MaterialSpec,
  NestingInputPiece,
  NestingResult,
  Placement,
  SheetLayout,
  SheetSettings,
} from '@/types/woodcraft';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Critério para escolher em qual retalho livre a peça entra (menor pontuação vence). */
export type FitHeuristic = 'best-area' | 'best-short-side' | 'best-long-side';
/** Regra para dividir o retalho que sobra após posicionar a peça. */
export type SplitRule = 'shorter-leftover' | 'longer-leftover' | 'min-area' | 'max-area';
/** Ordenação inicial das peças. */
export type SortOrder = 'area' | 'long-side' | 'perimeter' | 'length' | 'width';
/** Abre a peça na primeira chapa onde couber, ou na chapa com melhor encaixe. */
export type BinSelection = 'first-fit' | 'best-fit';

export interface PackOptions {
  sort: SortOrder;
  fit: FitHeuristic;
  split: SplitRule;
  bin: BinSelection;
}

interface Candidate {
  rectIndex: number;
  w: number;
  h: number;
  rotated: boolean;
  score: number;
  tie: number;
}

/** Uma chapa em processo de empacotamento, com a lista de retalhos livres. */
class GuillotineSheet {
  readonly free: Rect[];
  readonly placements: Placement[] = [];
  usedArea = 0;

  constructor(
    width: number,
    height: number,
    private readonly kerf: number,
  ) {
    this.free = [{ x: 0, y: 0, w: width, h: height }];
  }

  private score(r: Rect, w: number, h: number, fit: FitHeuristic): [number, number] {
    const dw = r.w - w;
    const dh = r.h - h;
    const short = Math.min(dw, dh);
    const long = Math.max(dw, dh);
    switch (fit) {
      case 'best-area':
        return [r.w * r.h - w * h, short];
      case 'best-short-side':
        return [short, long];
      case 'best-long-side':
        return [long, short];
    }
  }

  /** Melhor retalho livre para a peça (ou null se não couber). */
  find(length: number, width: number, canRotate: boolean, fit: FitHeuristic): Candidate | null {
    let best: Candidate | null = null;
    const orientations: Array<[number, number, boolean]> = [[length, width, false]];
    if (canRotate && length !== width) orientations.push([width, length, true]);

    this.free.forEach((r, rectIndex) => {
      for (const [w, h, rotated] of orientations) {
        if (w > r.w || h > r.h) continue;
        const [score, tie] = this.score(r, w, h, fit);
        if (!best || score < best.score || (score === best.score && tie < best.tie)) {
          best = { rectIndex, w, h, rotated, score, tie };
        }
      }
    });
    return best;
  }

  place(c: Candidate, piece: { id: string; label: string }, instance: number, split: SplitRule): void {
    const r = this.free[c.rectIndex]!;
    this.placements.push({ pieceId: piece.id, label: piece.label, instance, x: r.x, y: r.y, w: c.w, h: c.h, rotated: c.rotated });
    this.usedArea += c.w * c.h;

    const k = this.kerf;
    const leftoverW = r.w - c.w; // sobra à direita (ao longo do comprimento)
    const leftoverH = r.h - c.h; // sobra embaixo (ao longo da largura)

    let horizontal: boolean;
    switch (split) {
      case 'shorter-leftover':
        horizontal = leftoverW <= leftoverH;
        break;
      case 'longer-leftover':
        horizontal = leftoverW > leftoverH;
        break;
      case 'min-area':
        horizontal = c.w * leftoverH > leftoverW * c.h;
        break;
      case 'max-area':
        horizontal = c.w * leftoverH <= leftoverW * c.h;
        break;
    }

    // Corte horizontal: o retalho de baixo fica com a largura total do retalho original.
    const bottom: Rect = { x: r.x, y: r.y + c.h + k, w: horizontal ? r.w : c.w, h: leftoverH - k };
    const right: Rect = { x: r.x + c.w + k, y: r.y, w: leftoverW - k, h: horizontal ? c.h : r.h };

    this.free.splice(c.rectIndex, 1);
    if (bottom.w > 0 && bottom.h > 0) this.free.push(bottom);
    if (right.w > 0 && right.h > 0) this.free.push(right);
  }
}

interface Unit {
  id: string;
  label: string;
  instance: number;
  length: number;
  width: number;
  canRotate: boolean;
}

const SORTERS: Record<SortOrder, (a: Unit, b: Unit) => number> = {
  area: (a, b) => b.length * b.width - a.length * a.width,
  'long-side': (a, b) => Math.max(b.length, b.width) - Math.max(a.length, a.width),
  perimeter: (a, b) => b.length + b.width - (a.length + a.width),
  length: (a, b) => b.length - a.length || b.width - a.width,
  width: (a, b) => b.width - a.width || b.length - a.length,
};

interface PackOutcome {
  sheets: GuillotineSheet[];
  unplaced: Unit[];
}

function expand(pieces: NestingInputPiece[]): Unit[] {
  return pieces.flatMap((p) =>
    Array.from({ length: Math.max(0, Math.floor(p.quantity)) }, (_, i) => ({
      id: p.id,
      label: p.label,
      instance: i + 1,
      length: p.length,
      width: p.width,
      canRotate: p.canRotate,
    })),
  );
}

/** Uma passada gulosa do empacotamento com uma combinação específica de heurísticas. */
function packOnce(units: Unit[], usableL: number, usableW: number, kerf: number, opt: PackOptions): PackOutcome {
  const sorted = [...units].sort(SORTERS[opt.sort]);
  const sheets: GuillotineSheet[] = [];
  const unplaced: Unit[] = [];

  for (const u of sorted) {
    const fitsEmpty =
      (u.length <= usableL && u.width <= usableW) || (u.canRotate && u.width <= usableL && u.length <= usableW);
    if (!fitsEmpty) {
      unplaced.push(u);
      continue;
    }

    let target: GuillotineSheet | null = null;
    let candidate: Candidate | null = null;
    for (const sheet of sheets) {
      const c = sheet.find(u.length, u.width, u.canRotate, opt.fit);
      if (!c) continue;
      if (opt.bin === 'first-fit') {
        target = sheet;
        candidate = c;
        break;
      }
      if (!candidate || c.score < candidate.score || (c.score === candidate.score && c.tie < candidate.tie)) {
        target = sheet;
        candidate = c;
      }
    }
    if (!target || !candidate) {
      target = new GuillotineSheet(usableL, usableW, kerf);
      sheets.push(target);
      candidate = target.find(u.length, u.width, u.canRotate, opt.fit)!;
    }
    target.place(candidate, u, u.instance, opt.split);
  }
  return { sheets, unplaced };
}

/** Todas as combinações de heurísticas avaliadas pelo multi-start. */
export const ALL_STRATEGIES: PackOptions[] = (['area', 'long-side', 'perimeter', 'length', 'width'] as const).flatMap((sort) =>
  (['best-area', 'best-short-side', 'best-long-side'] as const).flatMap((fit) =>
    (['shorter-leftover', 'longer-leftover', 'min-area', 'max-area'] as const).flatMap((split) =>
      (['first-fit', 'best-fit'] as const).map((bin) => ({ sort, fit, split, bin })),
    ),
  ),
);

/** Compara resultados: menos chapas vence; empate → última chapa mais vazia (retalho maior aproveitável). */
function isBetter(a: PackOutcome, b: PackOutcome): boolean {
  if (a.unplaced.length !== b.unplaced.length) return a.unplaced.length < b.unplaced.length;
  if (a.sheets.length !== b.sheets.length) return a.sheets.length < b.sheets.length;
  const lastA = a.sheets.at(-1)?.usedArea ?? 0;
  const lastB = b.sheets.at(-1)?.usedArea ?? 0;
  return lastA < lastB;
}

/**
 * Empacota as peças em chapas de mesmo material.
 * As coordenadas retornadas já incluem o refilo (origem = canto da chapa bruta).
 */
export function packSheets(
  pieces: NestingInputPiece[],
  sheet: SheetSettings,
  strategies: PackOptions[] = ALL_STRATEGIES,
): Omit<NestingResult, 'materialKey' | 'materialLabel' | 'thickness'> {
  const usableL = sheet.length - 2 * sheet.trim;
  const usableW = sheet.width - 2 * sheet.trim;
  const usableArea = Math.max(1, usableL * usableW);
  const units = expand(pieces);

  let best: PackOutcome | null = null;
  let bestStrategy = strategies[0]!;
  for (const opt of strategies) {
    const outcome = packOnce(units, usableL, usableW, sheet.kerf, opt);
    if (!best || isBetter(outcome, best)) {
      best = outcome;
      bestStrategy = opt;
    }
  }
  const outcome = best ?? { sheets: [], unplaced: [] };

  const sheets: SheetLayout[] = outcome.sheets.map((s, index) => ({
    index,
    placements: s.placements.map((pl) => ({ ...pl, x: pl.x + sheet.trim, y: pl.y + sheet.trim })),
    usedArea: s.usedArea,
    utilization: s.usedArea / usableArea,
  }));
  const totalPieceArea = units
    .filter((u) => !outcome.unplaced.includes(u))
    .reduce((acc, u) => acc + u.length * u.width, 0);

  return {
    sheet,
    sheets,
    unplaced: outcome.unplaced.map((u) => ({ pieceId: u.id, label: u.label, length: u.length, width: u.width })),
    totalPieceArea,
    sheetEquivalent: totalPieceArea / usableArea,
    utilization: sheets.length ? totalPieceArea / (sheets.length * usableArea) : 0,
    strategy: `${bestStrategy.sort} / ${bestStrategy.fit} / ${bestStrategy.split} / ${bestStrategy.bin}`,
  };
}

/** Chave de agrupamento: peças de mesmo material comercial e espessura dividem as mesmas chapas. */
export const materialKey = (label: string, thickness: number) => `${label.trim().toLowerCase()}|${thickness}`;

/**
 * Gera o plano de corte completo a partir da lista de corte:
 * agrupa por material/espessura e empacota cada grupo separadamente.
 */
export function planCutting(
  pieces: CutPiece[],
  materials: Record<MaterialRole, MaterialSpec>,
  sheet: SheetSettings,
): NestingResult[] {
  const groups = new Map<string, { label: string; thickness: number; items: NestingInputPiece[] }>();
  for (const p of pieces) {
    const spec = materials[p.material];
    const key = materialKey(spec.label, p.thickness);
    const group = groups.get(key) ?? { label: spec.label, thickness: p.thickness, items: [] };
    group.items.push({
      id: p.id,
      label: p.name,
      length: p.length,
      width: p.width,
      quantity: p.quantity,
      canRotate: !(spec.hasGrain && p.grain === 'length'),
    });
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      materialKey: key,
      materialLabel: g.label,
      thickness: g.thickness,
      ...packSheets(g.items, sheet),
    }))
    .sort((a, b) => b.thickness - a.thickness);
}
