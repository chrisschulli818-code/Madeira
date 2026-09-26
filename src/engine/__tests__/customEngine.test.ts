import { describe, expect, it } from 'vitest';
import { buildCustom, contactLength, createPanel, panelBox } from '../customEngine';
import { computeHardware } from '../hardwareEngine';
import { parseProjectFile, serializeProject, createItem, DEFAULT_MATERIALS, DEFAULT_SERVICES, DEFAULT_SHEET } from '../projectFile';
import { DEFAULT_PRICES } from '../budgetEngine';
import type { CustomPanel, ProjectItem } from '@/types/woodcraft';

/** Caixa simples montada à mão: 2 laterais, base e tampo entre elas, fundo e porta. */
function simpleBox(): CustomPanel[] {
  const base = { edgeBanding: { length: 1 as const, width: 0 as const }, grainLocked: true, thickness: 18 };
  return [
    { ...base, id: 'l1', name: 'Lateral', kind: 'estrutura', orientation: 'side', width: 0, height: 720, depth: 500, x: 0, y: 0, z: 0 },
    { ...base, id: 'l2', name: 'Lateral', kind: 'estrutura', orientation: 'side', width: 0, height: 720, depth: 500, x: 782, y: 0, z: 0 },
    { ...base, id: 'b', name: 'Base', kind: 'estrutura', orientation: 'horizontal', width: 764, height: 0, depth: 500, x: 18, y: 0, z: 0 },
    { ...base, id: 't', name: 'Tampo', kind: 'estrutura', orientation: 'horizontal', width: 764, height: 0, depth: 500, x: 18, y: 702, z: 0 },
    { ...base, id: 'f', name: 'Fundo', kind: 'fundo', orientation: 'front', thickness: 6, width: 800, height: 720, depth: 0, x: 0, y: 0, z: -6, edgeBanding: { length: 0, width: 0 }, grainLocked: false },
    { ...base, id: 'p', name: 'Porta', kind: 'porta', orientation: 'front', width: 797, height: 717, depth: 0, x: 1.5, y: 1.5, z: 500, edgeBanding: { length: 2, width: 2 } },
  ];
}

describe('móvel livre', () => {
  it('começa vazio sem erros', () => {
    const m = buildCustom({ panels: [], assembly: 'screw' });
    expect(m.pieces).toHaveLength(0);
    expect(m.overall).toEqual({ width: 0, height: 0, depth: 0 });
    expect(m.warnings).toHaveLength(0);
  });

  it('gera a lista de corte com comprimento no sentido do veio e agrupa painéis iguais', () => {
    const m = buildCustom({ panels: simpleBox(), assembly: 'screw' });
    const side = m.pieces.find((p) => p.name === 'Lateral')!;
    expect(side).toMatchObject({ quantity: 2, length: 720, width: 500, thickness: 18, role: 'side' });
    expect(side.sourceIds).toEqual(['l1', 'l2']);
    expect(m.pieces.find((p) => p.name === 'Base')).toMatchObject({ length: 764, width: 500 });
    expect(m.pieces.find((p) => p.name === 'Fundo')).toMatchObject({ material: 'back', thickness: 6, grain: 'free' });
    expect(m.overall).toEqual({ width: 800, height: 720, depth: 506 + 18 });
  });

  it('detecta as junções pelo contato entre painéis de estrutura', () => {
    const m = buildCustom({ panels: simpleBox(), assembly: 'screw' });
    // Base e tampo encostam nas duas laterais: 4 junções de 500 mm
    expect(m.joints).toHaveLength(4);
    expect(m.joints.every((j) => j.length === 500)).toBe(true);
    expect(m.warnings).toHaveLength(0);
  });

  it('portas, fundo e ferragens', () => {
    const m = buildCustom({ panels: simpleBox(), assembly: 'screw' });
    expect(m.doors).toEqual([expect.objectContaining({ height: 717, width: 797 })]);
    expect(m.backPerimeter).toBe(2 * (720 + 800));
    const hw = computeHardware(m, DEFAULT_MATERIALS);
    expect(hw.find((i) => i.name.startsWith('Dobradiça'))!.quantity).toBe(2);
    expect(hw.find((i) => i.name.startsWith('Parafuso chipboard cabeça chata'))!.quantity).toBeGreaterThan(0);
  });

  it('avisa quando painéis de estrutura se sobrepõem', () => {
    const panels = simpleBox();
    panels[2] = { ...panels[2]!, x: 0 }; // base invadindo a lateral esquerda
    const m = buildCustom({ panels, assembly: 'screw' });
    expect(m.warnings.some((w) => w.includes('sobrepostos'))).toBe(true);
  });

  it('contato só conta com face encostada e área em comum', () => {
    const a = { x: 0, y: 0, z: 0, w: 18, h: 700, d: 500 };
    expect(contactLength(a, { x: 18, y: 0, z: 0, w: 500, h: 18, d: 500 })).toBe(500);
    expect(contactLength(a, { x: 30, y: 0, z: 0, w: 500, h: 18, d: 500 })).toBeNull();
  });

  it('atalhos posicionam a nova peça ao lado/em cima das existentes', () => {
    const first = createPanel('lateral', []);
    expect(panelBox(first)).toMatchObject({ x: 0, y: 0, w: 18, h: 720, d: 500 });
    // 2ª lateral a 800 mm de largura total
    const second = createPanel('lateral', [first]);
    expect(second.x).toBe(782);
    // Base e tampo entre as laterais
    const bottom = createPanel('horizontal', [first, second]);
    expect(bottom.name).toBe('Base');
    expect(panelBox(bottom)).toMatchObject({ x: 18, y: 0, w: 764, h: 18, d: 500 });
    const top = createPanel('horizontal', [first, second, bottom]);
    expect(top.name).toBe('Tampo');
    expect(panelBox(top)).toMatchObject({ x: 18, y: 702, w: 764 });
    // Montadas pelos atalhos, as 4 peças formam 4 junções sem sobreposição
    const m = buildCustom({ panels: [first, second, bottom, top], assembly: 'screw' });
    expect(m.joints).toHaveLength(4);
    expect(m.warnings).toHaveLength(0);
    // "Lateral 1" e "Lateral 2" iguais formam uma linha com quantidade 2
    expect(m.pieces.find((p) => p.name === 'Lateral')).toMatchObject({ quantity: 2 });
  });

  it('salva e abre projeto com móvel livre', () => {
    const item: ProjectItem = { ...createItem('custom'), templateId: 'custom', params: { panels: simpleBox(), assembly: 'minifix' } };
    const parsed = parseProjectFile(
      serializeProject({ projectName: 'Do zero', items: [item], sheet: DEFAULT_SHEET, materials: DEFAULT_MATERIALS, services: DEFAULT_SERVICES, prices: DEFAULT_PRICES }),
    );
    expect(parsed.ok && parsed.data.items[0]).toEqual(item);
  });
});
