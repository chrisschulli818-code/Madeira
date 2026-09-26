import { describe, expect, it } from 'vitest';
import { applyDrag, SHELF_GRID } from '../dragEngine';
import { buildCarcass } from '../cabinetEngine';
import { buildCustom, createPanel, panelBox } from '../customEngine';
import { createItem } from '../projectFile';
import { defaultParamsFor } from '../templates';
import type { CabinetParams, CustomPanel, ProjectItem } from '@/types/woodcraft';

/** Guarda-roupa de 2 vãos, cada um com porta e prateleiras (sem gavetas). */
type CarcassItem = Extract<ProjectItem, { params: CabinetParams }>;

function wardrobe(): CarcassItem {
  const params: CabinetParams = {
    ...defaultParamsFor('wardrobe'),
    columns: [
      { id: 'a', widthRatio: 1, drawers: 0, doors: 1, shelves: 2, hangingRod: false },
      { id: 'b', widthRatio: 1, drawers: 0, doors: 1, shelves: 1, hangingRod: false },
    ],
  };
  return { ...createItem('wardrobe'), templateId: 'wardrobe', params };
}

const shelfHandles = (item: CarcassItem) =>
  buildCarcass(item.templateId, item.params).handles!.filter((h) => h.kind === 'shelf');

describe('arrastar prateleira em móvel de caixa', () => {
  it('desliza na vertical encaixando em passos de 32 mm', () => {
    const item = wardrobe();
    const model = buildCarcass('wardrobe', item.params);
    const handle = model.handles!.find((h) => h.kind === 'shelf' && h.column === 0 && h.index === 0)!;
    const region = model.layout.regions![0]!;
    const r = applyDrag(item, model, handle, handle.box, { dx: 0, dy: 300 })!;
    expect(r).not.toBeNull();
    const col = (r.item.params as CabinetParams).columns[0]!;
    expect(col.shelves).toBe(2);
    // A outra prateleira fica onde estava; a arrastada vai ~300 mm acima, no passo de 32 mm
    expect(col.shelfPositions).toContain(region.shelves[1]);
    const moved = col.shelfPositions!.find((p) => p !== region.shelves[1])!;
    expect(moved % SHELF_GRID).toBe(0);
    expect(Math.abs(moved - (region.shelves[0]! + 300))).toBeLessThanOrEqual(SHELF_GRID / 2);
  });

  it('não ocupa o lugar de outra prateleira do vão', () => {
    const item = wardrobe();
    const model = buildCarcass('wardrobe', item.params);
    const [h0, h1] = model.handles!.filter((h) => h.kind === 'shelf' && h.column === 0);
    const r = applyDrag(item, model, h0!, h0!.box, { dx: 0, dy: h1!.box.y - h0!.box.y })!;
    const [a, b] = (r.item.params as CabinetParams).columns[0]!.shelfPositions!;
    expect(Math.abs(b! - a!)).toBeGreaterThanOrEqual(18 + 20);
  });

  it('não sai do vão (limitada entre base e tampo)', () => {
    const item = wardrobe();
    const model = buildCarcass('wardrobe', item.params);
    const handle = model.handles!.find((h) => h.kind === 'shelf' && h.column === 0)!;
    const r = applyDrag(item, model, handle, handle.box, { dx: 0, dy: 99999 })!;
    const after = buildCarcass('wardrobe', r.item.params as CabinetParams);
    const top = Math.max(...shelfHandles({ ...item, params: r.item.params as CabinetParams }).map((h) => h.box.y + h.box.h));
    expect(top).toBeLessThanOrEqual(after.layout.regions![0]!.top + 0.01);
  });

  it('pode ser levada para outro vão', () => {
    const item = wardrobe();
    const model = buildCarcass('wardrobe', item.params);
    const handle = model.handles!.find((h) => h.kind === 'shelf' && h.column === 0)!;
    const [a, b] = model.layout.columns;
    const r = applyDrag(item, model, handle, handle.box, { dx: b![0] - a![0], dy: 0 })!;
    const cols = (r.item.params as CabinetParams).columns;
    expect(cols.map((c) => c.shelves)).toEqual([1, 2]);
    expect(r.ref).toMatchObject({ kind: 'shelf', column: 1 });
  });
});

describe('arrastar gaveta em móvel de caixa', () => {
  const item = { ...createItem('base-cabinet'), templateId: 'base-cabinet' as const, params: defaultParamsFor('base-cabinet') };
  const model = buildCarcass('base-cabinet', item.params);
  const drawer = model.handles!.find((h) => h.kind === 'drawer' && h.column === 0)!;
  const [a, b] = model.layout.columns;

  it('leva a gaveta para o vão da porta, encaixando embaixo quando solta na parte de baixo', () => {
    const r = applyDrag(item, model, drawer, drawer.box, { dx: b![0] - a![0], dy: -600 })!;
    const cols = (r.item.params as CabinetParams).columns;
    expect(cols.map((c) => c.drawers)).toEqual([1, 1]);
    expect(cols[1]!.drawerPosition).toBe('bottom');
    // O modelo resultante tem prateleira fixa e porta acima da gaveta
    const after = buildCarcass('base-cabinet', r.item.params as CabinetParams);
    const front = after.handles!.find((h) => h.kind === 'drawer' && h.column === 1)!.box;
    const door = after.pieces.find((p) => p.role === 'door')!.instances[0]!;
    expect(door.y).toBeGreaterThan(front.y + front.h);
  });

  it('sem mudança real devolve null', () => {
    expect(applyDrag(item, model, drawer, drawer.box, { dx: 5, dy: 5 })).toBeNull();
  });
});

describe('arrastar no móvel livre', () => {
  /** Caixa com 2 laterais, base e tampo feitas pelos atalhos. */
  function box(): CustomPanel[] {
    const l1 = createPanel('lateral', []);
    const l2 = createPanel('lateral', [l1]);
    const base = createPanel('horizontal', [l1, l2]);
    const top = createPanel('horizontal', [l1, l2, base]);
    return [l1, l2, base, top];
  }
  const itemWith = (panels: CustomPanel[]): ProjectItem => ({ ...createItem('custom'), templateId: 'custom', params: { panels, assembly: 'screw' } });

  it('prateleira solta entre as laterais se ajusta à largura do vão', () => {
    const panels = box();
    const loose: CustomPanel = { ...createPanel('prateleira', panels), width: 300, x: 1000, y: 400 };
    const item = itemWith([...panels, loose]);
    const model = buildCustom({ panels: [...panels, loose], assembly: 'screw' });
    const handle = model.handles!.find((h) => h.panelId === loose.id)!;
    // Arrasta para dentro do móvel, na altura de ~352 mm
    const r = applyDrag(item, model, handle, handle.box, { dx: 200 - 1000, dy: -48 })!;
    const moved = (r.item.params as { panels: CustomPanel[] }).panels.find((p) => p.id === loose.id)!;
    expect(moved.x).toBe(19);
    expect(moved.width).toBe(762);
    expect(moved.depth).toBe(480);
  });

  it('gaveta encaixa entre as laterais e apoia sobre a base', () => {
    const panels = box();
    const drawer: CustomPanel = { ...createPanel('gaveta', panels), x: 1200, y: 300, width: 400 };
    const all = [...panels, drawer];
    const item = itemWith(all);
    const model = buildCustom({ panels: all, assembly: 'screw' });
    const handle = model.handles!.find((h) => h.panelId === drawer.id)!;
    const baseTop = panelBox(panels[2]!).y + 18;
    const r = applyDrag(item, model, handle, handle.box, { dx: 300 - 1200, dy: baseTop + 8 - 300 })!;
    const moved = (r.item.params as { panels: CustomPanel[] }).panels.find((p) => p.id === drawer.id)!;
    expect(moved).toMatchObject({ x: 18, width: 764, y: baseTop, depth: 500 });
    // E vira uma gaveta completa com corrediça
    const after = buildCustom({ panels: (r.item.params as { panels: CustomPanel[] }).panels, assembly: 'screw' });
    expect(after.drawers).toEqual([expect.objectContaining({ boxWidth: 764 - 26, slideLength: 450 })]);
  });

  it('gaveta solta sobre outra não se sobrepõe: empilha', () => {
    const panels = box();
    const g1 = createPanel('gaveta', panels);
    const g2 = createPanel('gaveta', [...panels, g1]);
    const all = [...panels, g1, g2];
    const item = itemWith(all);
    const model = buildCustom({ panels: all, assembly: 'screw' });
    const handle = model.handles!.find((h) => h.panelId === g2.id)!;
    // Arrasta a gaveta de cima para cima da de baixo
    const r = applyDrag(item, model, handle, handle.box, { dx: 0, dy: g1.y - g2.y + 30 })!;
    const moved = r ? (r.item.params as { panels: CustomPanel[] }).panels.find((p) => p.id === g2.id)! : g2;
    expect(moved.y === g1.y + g1.height || moved.y + moved.height <= g1.y).toBe(true);
    // Nunca abaixo da base nem acima do tampo
    expect(moved.y).toBeGreaterThanOrEqual(0);
    expect(moved.y + moved.height).toBeLessThanOrEqual(720);
  });

  it('gaveta arrastada para baixo do piso para sobre a base, sem atravessar', () => {
    const panels = box();
    const g1 = createPanel('gaveta', panels);
    const g2 = createPanel('gaveta', [...panels, g1]);
    const all = [...panels, g1, g2];
    const model = buildCustom({ panels: all, assembly: 'screw' });
    const handle = model.handles!.find((h) => h.panelId === g2.id)!;
    const r = applyDrag(itemWith(all), model, handle, handle.box, { dx: 0, dy: -500 });
    const moved = r ? (r.item.params as { panels: CustomPanel[] }).panels.find((p) => p.id === g2.id)! : g2;
    expect(moved.y).toBeGreaterThanOrEqual(18);
    const overlapsG1 = moved.y < g1.y + g1.height && g1.y < moved.y + moved.height;
    expect(overlapsG1).toBe(false);
  });

  it('peça fora de alcance fica na grade de 10 mm', () => {
    const panels = box();
    const item = itemWith(panels);
    const model = buildCustom({ panels, assembly: 'screw' });
    const handle = model.handles!.find((h) => h.panelId === panels[0]!.id)!;
    const r = applyDrag(item, model, handle, handle.box, { dx: -333, dy: 0 })!;
    const moved = (r.item.params as { panels: CustomPanel[] }).panels[0]!;
    expect(Math.abs(moved.x % 10)).toBe(0);
  });
});
