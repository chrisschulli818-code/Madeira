import { describe, expect, it } from 'vitest';
import { buildCarcass, buildWorkbench, pickSlideLength, splitByRatio } from '../cabinetEngine';
import { defaultParamsFor } from '../templates';
import type { CabinetParams } from '@/types/woodcraft';

/** Gabinete inferior 1 porta + 2 gavetas (caso de referência). */
function referenceParams(): CabinetParams {
  return {
    ...defaultParamsFor('base-cabinet'),
    width: 900,
    height: 870,
    depth: 560,
    carcassThickness: 18,
    backThickness: 6,
    plinthHeight: 100,
    plinthSetback: 50,
    frontGap: 3,
  };
}

const byName = (model: ReturnType<typeof buildCarcass>, name: string) => model.pieces.find((p) => p.name === name);

describe('buildCarcass — balcão 900 × 870 × 560, 2 gavetas + 1 porta', () => {
  const model = buildCarcass('base-cabinet', referenceParams());

  it('laterais vão até o chão e descontam o fundo sobreposto', () => {
    const side = byName(model, 'Lateral')!;
    expect(side.quantity).toBe(2);
    expect(side.length).toBe(870);
    expect(side.width).toBe(560 - 6);
  });

  it('base e travessas descontam as duas laterais', () => {
    expect(byName(model, 'Base')).toMatchObject({ length: 900 - 36, width: 554, quantity: 1 });
    expect(byName(model, 'Travessa superior')).toMatchObject({ length: 864, width: 100, quantity: 2 });
    expect(byName(model, 'Rodapé')).toMatchObject({ length: 864, width: 100 });
  });

  it('divide o vão interno descontando a divisória', () => {
    // 864 - 18 = 846 → 423 por vão
    expect(model.layout.columns.map(([a, b]) => b - a)).toEqual([423, 423]);
    expect(byName(model, 'Divisória')).toMatchObject({ length: 870 - 100 - 18 - 18, width: 554 });
  });

  it('frentes sobrepostas com folga de 3 mm', () => {
    // Vão 1: 0 → centro da divisória (18 + 423 + 9 = 450)
    const drawerFront = byName(model, 'Frente de gaveta')!;
    expect(drawerFront.quantity).toBe(2);
    expect(drawerFront.length).toBe(447);
    // Zona de frentes: 870 - 100 = 770; 2 gavetas: (770 - 3 - 3) / 2 = 382
    expect(drawerFront.width).toBe(382);
    const door = byName(model, 'Porta')!;
    expect(door).toMatchObject({ quantity: 1, length: 767, width: 447 });
    expect(door.edgeBanding).toEqual({ length: 2, width: 2 });
  });

  it('caixa de gaveta desconta a folga das corrediças', () => {
    expect(model.drawers).toHaveLength(2);
    expect(model.drawers[0]).toMatchObject({ boxWidth: 423 - 26, slideLength: 500 });
    expect(byName(model, 'Lateral da gaveta')).toMatchObject({ quantity: 4, length: 500, thickness: 15 });
    expect(byName(model, 'Contra-frente / traseira da gaveta')).toMatchObject({ quantity: 4, length: 397 - 30 });
  });

  it('porta do último vão abre para a direita sobre a lateral externa', () => {
    expect(model.doors).toEqual([expect.objectContaining({ hingeSide: 'right', overlay: 'full', height: 767 })]);
    expect(model.adjustableShelves).toBe(1);
  });

  it('fundo sobreposto é 2 mm menor por lado', () => {
    expect(byName(model, 'Fundo')).toMatchObject({ length: 770 - 4, width: 896, thickness: 6 });
  });
});

describe('buildCarcass — variações', () => {
  it('fundo em rasgo usa a profundidade total nas laterais', () => {
    const m = buildCarcass('base-cabinet', { ...referenceParams(), backMode: 'groove' });
    expect(byName(m, 'Lateral')!.width).toBe(560);
    // 752 - 18 = 734 de altura interna (base até travessas) + 2 × 8 − 2
    expect(byName(m, 'Fundo')).toMatchObject({ length: 734 + 14, width: 864 + 14 });
  });

  it('porta dupla divide o vão em duas folhas', () => {
    const m = buildCarcass('wall-cabinet', defaultParamsFor('wall-cabinet'));
    const door = byName(m, 'Porta')!;
    expect(door.quantity).toBe(2);
    expect(door.width).toBe((800 - 6) / 2);
    expect(m.doors.map((d) => d.hingeSide)).toEqual(['left', 'right']);
  });

  it('gera avisos em vez de quebrar com medidas impossíveis', () => {
    const m = buildCarcass('base-cabinet', { ...referenceParams(), width: 150, columns: [...referenceParams().columns, ...referenceParams().columns] });
    expect(m.warnings.length).toBeGreaterThan(0);
  });

  it('cabideiro no guarda-roupa', () => {
    const m = buildCarcass('wardrobe', defaultParamsFor('wardrobe'));
    expect(m.hangingRods).toHaveLength(1);
  });
});

describe('buildWorkbench', () => {
  it('calcula tampo, painéis e saia', () => {
    const m = buildWorkbench(defaultParamsFor('workbench'));
    expect(m.pieces.find((p) => p.role === 'worktop')).toMatchObject({ length: 1500, width: 700, thickness: 25 });
    expect(m.pieces.find((p) => p.role === 'leg-panel')).toMatchObject({ quantity: 2, length: 875, width: 600 });
    expect(m.pieces.find((p) => p.role === 'apron')).toMatchObject({ length: 1500 - 100 - 36 });
  });
});

describe('utilidades', () => {
  it('splitByRatio preserva o total', () => {
    expect(splitByRatio(1000, [1, 1, 1])).toEqual([333, 333, 334]);
    expect(splitByRatio(900, [2, 1])).toEqual([600, 300]);
  });
  it('pickSlideLength escolhe a maior corrediça comercial', () => {
    expect(pickSlideLength(554)).toBe(500);
    expect(pickSlideLength(200)).toBeNull();
  });
});
