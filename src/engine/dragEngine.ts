/**
 * Arrastar e encaixar peças dentro dos móveis.
 *
 * Recebe a peça arrastada (alça), a posição desejada na vista frontal (mm) e devolve
 * os parâmetros atualizados do móvel com a peça "encaixada":
 *
 * - Prateleira de móvel de caixa: desliza na vertical dentro do vão, em passos de 32 mm
 *   (sistema 32, a furação padrão dos pinos), e pode ser levada para outro vão.
 * - Gaveta de móvel de caixa: pode ser levada para outro vão e, em vão com porta,
 *   encaixa em cima ou embaixo conforme a altura em que é solta.
 * - Painel do móvel livre: encosta nas faces das peças vizinhas (ímã de 20 mm); prateleiras,
 *   painéis deitados e gavetas se ajustam à largura entre as laterais em que forem soltos.
 *
 * Módulo puro (sem React), coberto por testes.
 */
import type { AssembledModel, CabinetParams, CustomPanel, CustomParams, DragHandle, ProjectItem } from '@/types/woodcraft';
import { panelBox } from './customEngine';

/** Passo da furação de pinos de prateleira (sistema 32). */
export const SHELF_GRID = 32;
/** Distância em que uma peça "gruda" na face de outra (mm). */
export const SNAP_DISTANCE = 20;
/** Passo do posicionamento livre quando não há face próxima (mm). */
export const FREE_GRID = 10;

export type HandleRef = Omit<DragHandle, 'box'>;

/** Posição desejada da peça na vista frontal: canto inferior esquerdo (x, y) e tamanho (w, h), em mm. */
export interface DragTarget {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DragResult {
  item: ProjectItem;
  /** Alça atualizada (a peça pode ter mudado de vão ou de índice). */
  ref: HandleRef;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const roundTo = (v: number, step: number) => Math.round(v / step) * step || 0; // evita -0

/** Vão que contém a coordenada x (ou o mais próximo). */
export function columnAt(columns: Array<[number, number]>, x: number): number {
  let best = 0;
  let bestDist = Infinity;
  columns.forEach(([a, b], i) => {
    const dist = x < a ? a - x : x > b ? x - b : 0;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}

// ---------------------------------------------------------------------------
// Móveis de caixa
// ---------------------------------------------------------------------------

export function dragCarcassShelf(p: CabinetParams, model: AssembledModel, ref: HandleRef, t: DragTarget): { params: CabinetParams; ref: HandleRef } | null {
  const regions = model.layout.regions;
  if (!regions || ref.column === undefined || ref.index === undefined) return null;
  let col = columnAt(model.layout.columns, t.x + t.w / 2);
  if (!regions[col]?.acceptsShelves) col = ref.column;
  const region = regions[col]!;
  const maxOffset = region.top - region.bottom - p.carcassThickness;
  if (maxOffset < 0) return null;
  const lists = regions.map((r) => [...r.shelves]);
  // Outras prateleiras do vão de destino: a arrastada não pode ocupar o mesmo lugar.
  const others = lists[col]!.filter((_, k) => !(col === ref.column && k === ref.index));
  const minGap = p.carcassThickness + 20;
  const free = (o: number) => others.every((q) => Math.abs(q - o) >= minGap);
  const wanted = clamp(roundTo(t.y - region.bottom, SHELF_GRID), 0, maxOffset);
  let offset = wanted;
  if (!free(wanted)) {
    // Procura o furo livre mais próximo (acima ou abaixo), no passo de 32 mm.
    const options: number[] = [];
    for (let o = 0; o <= maxOffset; o += SHELF_GRID) if (free(o)) options.push(o);
    if (free(maxOffset)) options.push(maxOffset);
    if (!options.length) return null;
    offset = options.reduce((a, b) => (Math.abs(b - wanted) < Math.abs(a - wanted) ? b : a));
  }

  if (col === ref.column && Math.abs((lists[col]![ref.index] ?? NaN) - offset) < 0.5) return null;
  lists[ref.column]!.splice(ref.index, 1);
  lists[col]!.push(offset);
  lists[col]!.sort((a, b) => a - b);

  const columns = p.columns.map((c, i) =>
    i === ref.column || i === col ? { ...c, shelves: lists[i]!.length, shelfPositions: lists[i]! } : c,
  );
  return { params: { ...p, columns }, ref: { kind: 'shelf', column: col, index: lists[col]!.indexOf(offset) } };
}

export function dragCarcassDrawer(p: CabinetParams, model: AssembledModel, ref: HandleRef, t: DragTarget): { params: CabinetParams; ref: HandleRef } | null {
  if (ref.column === undefined) return null;
  const col = columnAt(model.layout.columns, t.x + t.w / 2);
  const frontsMid = (model.layout.plinthHeight + model.overall.height) / 2;
  const position: 'top' | 'bottom' = t.y + t.h / 2 >= frontsMid ? 'top' : 'bottom';
  const source = p.columns[ref.column];
  const target = p.columns[col];
  if (!source || !target) return null;

  if (col === ref.column) {
    if (target.doors === 0 || (target.drawerPosition ?? 'top') === position) return null;
    const columns = p.columns.map((c, i) => (i === col ? { ...c, drawerPosition: position } : c));
    return { params: { ...p, columns }, ref: { ...ref } };
  }
  const columns = p.columns.map((c, i) => {
    if (i === ref.column) return { ...c, drawers: Math.max(0, c.drawers - 1) };
    if (i === col) return { ...c, drawers: c.drawers + 1, drawerPosition: position };
    return c;
  });
  return { params: { ...p, columns }, ref: { kind: 'drawer', column: col, index: 0 } };
}

// ---------------------------------------------------------------------------
// Móvel livre
// ---------------------------------------------------------------------------

/** Valor mais próximo dentre os candidatos, se estiver a até `SNAP_DISTANCE`. */
function nearest(value: number, candidates: number[]): number | null {
  let best: number | null = null;
  for (const c of candidates) if (Math.abs(c - value) <= SNAP_DISTANCE && (best === null || Math.abs(c - value) < Math.abs(best - value))) best = c;
  return best;
}

const overlaps = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 0.5;

export function dragCustomPanel(params: CustomParams, ref: HandleRef, t: DragTarget): { params: CustomParams; ref: HandleRef } | null {
  const panel = params.panels.find((p) => p.id === ref.panelId);
  if (!panel) return null;
  const box = panelBox(panel);
  const others = params.panels.filter((p) => p.id !== panel.id).map((p) => ({ p, b: panelBox(p) }));
  const next: CustomPanel = { ...panel };
  // O alvo refere-se à peça clicada (ex.: a frente da gaveta); converte para a origem do painel.
  let x = t.x;
  let width = box.w;

  const fits = panel.kind === 'gaveta' || panel.orientation === 'horizontal';
  let fitted = false;
  // Faixa vertical permitida: entre o piso e o topo das laterais (quando encaixada), ou acima do piso.
  const structure = others.filter(({ p }) => p.kind === 'estrutura');
  let yMin = structure.length ? Math.min(0, ...structure.map(({ b }) => b.y)) : -Infinity;
  let yMax = Infinity;
  if (fits) {
    // Encaixe entre as laterais que cobrem a altura em que a peça foi solta.
    const sides = others.filter(({ p, b }) => p.kind === 'estrutura' && p.orientation === 'side' && overlaps(b.y, b.y + b.h, t.y, t.y + box.h));
    const cx = t.x + box.w / 2;
    const leftSides = sides.filter(({ b }) => b.x + b.w <= cx + 1);
    const rightSides = sides.filter(({ b }) => b.x >= cx - 1);
    if (leftSides.length && rightSides.length) {
      const left = leftSides.reduce((a, c) => (c.b.x + c.b.w > a.b.x + a.b.w ? c : a));
      const right = rightSides.reduce((a, c) => (c.b.x < a.b.x ? c : a));
      const gap = right.b.x - (left.b.x + left.b.w);
      if (gap > 50) {
        const clearance = panel.kind === 'prateleira' ? 1 : 0;
        x = left.b.x + left.b.w + clearance;
        width = gap - 2 * clearance;
        fitted = true;
        yMin = Math.max(left.b.y, right.b.y);
        yMax = Math.min(left.b.y + left.b.h, right.b.y + right.b.h) - box.h;
        const sideDepth = Math.max(left.b.d, right.b.d);
        next.z = Math.min(left.b.z, right.b.z);
        if (panel.kind === 'gaveta') next.depth = sideDepth;
        else if (panel.kind === 'prateleira') next.depth = Math.max(30, sideDepth - 20);
        else next.depth = sideDepth;
      }
    }
  }
  if (!fitted) {
    const snapX = nearest(t.x, others.flatMap(({ b }) => [b.x, b.x + b.w, b.x - box.w, b.x + b.w - box.w]));
    x = snapX ?? roundTo(t.x, FREE_GRID);
  }

  // Vertical: apoia sobre a face de cima de uma peça abaixo, ou encosta embaixo de uma de cima.
  const inRange = others.filter(({ b }) => overlaps(b.x, b.x + b.w, x, x + width));
  const allowed = (yy: number) => yy >= yMin - 0.01 && yy <= yMax + 0.01;
  const snapY = nearest(t.y, inRange.flatMap(({ b }) => [b.y + b.h, b.y - box.h]).filter(allowed));
  let y = snapY ?? (yMax >= yMin ? clamp(roundTo(t.y, FREE_GRID), yMin, yMax) : roundTo(t.y, FREE_GRID));

  // Sem sobreposição: se bater em outra peça sólida no mesmo espaço, empilha acima ou abaixo dela.
  const solid = new Set(['estrutura', 'prateleira', 'gaveta']);
  if (solid.has(panel.kind)) {
    const zRange = panel.kind === 'gaveta' ? [next.z, next.z + next.depth] : [next.z, next.z + (panel.orientation === 'front' ? panel.thickness : next.depth)];
    const blockers = inRange.filter(({ p, b }) => solid.has(p.kind) && overlaps(b.z, b.z + b.d, zRange[0]!, zRange[1]!));
    const hits = (yy: number) => blockers.some(({ b }) => overlaps(b.y, b.y + b.h, yy, yy + box.h));
    if (hits(y)) {
      const options = blockers.flatMap(({ b }) => [b.y + b.h, b.y - box.h]).filter((yy) => allowed(yy) && !hits(yy));
      if (!options.length) return null;
      const wanted = y;
      y = options.reduce((a, c) => (Math.abs(c - wanted) < Math.abs(a - wanted) ? c : a));
    }
  }

  next.x = x;
  next.y = y;
  if (fitted) next.width = width;
  const changed = (['x', 'y', 'z', 'width', 'depth'] as const).some((k) => Math.abs(next[k] - panel[k]) > 0.01);
  if (!changed) return null;
  return { params: { ...params, panels: params.panels.map((p) => (p.id === panel.id ? next : p)) }, ref: { ...ref } };
}

// ---------------------------------------------------------------------------
// Ponto de entrada
// ---------------------------------------------------------------------------

/**
 * Aplica o arraste de uma peça a partir do estado do início do arraste.
 *
 * Sempre calculado sobre o móvel como estava ao começar (`item`/`model`) mais o deslocamento
 * do ponteiro (`delta`, mm na vista frontal) — assim o resultado não acumula erros.
 * Devolve null quando a peça volta para onde estava.
 */
export function applyDrag(
  item: ProjectItem,
  model: AssembledModel,
  ref: HandleRef,
  startBox: { x: number; y: number; w: number; h: number },
  delta: { dx: number; dy: number },
): DragResult | null {
  if (item.templateId === 'custom') {
    if (ref.kind !== 'panel') return null;
    const panel = item.params.panels.find((p) => p.id === ref.panelId);
    if (!panel) return null;
    const origin = panelBox(panel);
    const r = dragCustomPanel(item.params, ref, { x: origin.x + delta.dx, y: origin.y + delta.dy, w: origin.w, h: origin.h });
    return r && { item: { ...item, params: r.params }, ref: r.ref };
  }
  if (item.templateId === 'workbench') return null;
  const t: DragTarget = { x: startBox.x + delta.dx, y: startBox.y + delta.dy, w: startBox.w, h: startBox.h };
  const r =
    ref.kind === 'shelf'
      ? dragCarcassShelf(item.params, model, ref, t)
      : ref.kind === 'drawer'
        ? dragCarcassDrawer(item.params, model, ref, t)
        : null;
  return r && { item: { ...item, params: r.params }, ref: r.ref };
}
