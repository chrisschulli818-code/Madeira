import { describe, expect, it } from 'vitest';
import { buildCarcass, buildWorkbench } from '../cabinetEngine';
import { buildCustom, createPanel } from '../customEngine';
import { computeJoinery, spread } from '../joineryEngine';
import { defaultParamsFor } from '../templates';
import { FASTENER_SPACING } from '../constants';
import type { AssemblyMethod, CabinetParams } from '@/types/woodcraft';

const base = (assembly: AssemblyMethod = 'screw', extra: Partial<CabinetParams> = {}) =>
  buildCarcass('base-cabinet', { ...defaultParamsFor('base-cabinet'), assembly, ...extra });

describe('furação por parafuso', () => {
  const model = base('screw');
  const plan = computeJoinery(model);
  const screws = plan.ops.filter((o) => o.kind === 'parafuso');

  it('quantidade de parafusos bate com a lista de compras', () => {
    const expected = model.joints
      .filter((j) => !j.bracket && j.label !== 'Canto de gaveta')
      .reduce((n, j) => n + Math.max(2, Math.ceil(j.length / FASTENER_SPACING)), 0);
    expect(screws).toHaveLength(expected);
    // Cada parafuso tem um pré-furo correspondente na borda da outra peça
    expect(plan.ops.filter((o) => o.kind === 'prefuro')).toHaveLength(expected);
  });

  it('base × lateral: furo na face externa da lateral, na altura do meio da base', () => {
    const side = model.pieces.find((p) => p.role === 'side')!;
    const left = plan.ops.filter((o) => o.kind === 'parafuso' && o.pieceId === side.id && o.instance === 0 && o.joint.startsWith('Lateral × Base'));
    expect(left).toHaveLength(4);
    // Lateral esquerda: face externa em x = 0 (face A); altura = meio da base (100 + 9)
    expect(left.every((o) => o.surface === 'face-a' && o.u === 109 && o.world.x === 0)).toBe(true);
    // Distribuídos a 50 mm das pontas da junção (554 mm)
    expect(left.map((o) => o.v)).toEqual(spread(554, 4, 50).map((v) => Math.round(v * 10) / 10));
  });

  it('pré-furos ficam na borda da base', () => {
    const bottom = model.pieces.find((p) => p.role === 'bottom')!;
    const pre = plan.ops.filter((o) => o.kind === 'prefuro' && o.pieceId === bottom.id);
    // 2 laterais × 4 = 8 na borda (u = 0 ou u = comprimento)
    expect(pre.filter((o) => o.surface === 'borda' && (o.u === 0 || o.u === bottom.length))).toHaveLength(8);
  });
});

describe('ferragens e rasgo', () => {
  it('dobradiças: caneco Ø35 a 22,5 mm da borda e base na lateral', () => {
    const plan = computeJoinery(base());
    const cups = plan.ops.filter((o) => o.kind === 'caneco-dobradica');
    expect(cups).toHaveLength(2);
    expect(cups[0]).toMatchObject({ diameter: 35 });
    const plates = plan.ops.filter((o) => o.kind === 'base-dobradica');
    expect(plates).toHaveLength(4);
  });

  it('pinos das prateleiras nas duas faces que seguram a prateleira', () => {
    const plan = computeJoinery(base());
    expect(plan.ops.filter((o) => o.kind === 'pino-prateleira')).toHaveLength(4);
  });

  it('fundo em rasgo gera rasgos nas laterais, base e travessa', () => {
    const plan = computeJoinery(base('screw', { backMode: 'groove' }));
    const grooves = plan.ops.filter((o) => o.kind === 'rasgo');
    expect(grooves.length).toBeGreaterThanOrEqual(3);
    expect(grooves.every((g) => (g.length ?? 0) > 100)).toBe(true);
  });
});

describe('minifix e cavilhas', () => {
  it('minifix: tambor, pino e furo de borda para cada fixador, com cavilha de alinhamento', () => {
    const plan = computeJoinery(base('minifix'));
    const tambor = plan.ops.filter((o) => o.kind === 'minifix-tambor').length;
    expect(tambor).toBeGreaterThan(0);
    expect(plan.ops.filter((o) => o.kind === 'minifix-pino')).toHaveLength(tambor);
    expect(plan.ops.filter((o) => o.kind === 'minifix-furo-borda')).toHaveLength(tambor);
    expect(plan.ops.filter((o) => o.kind === 'cavilha').length).toBeGreaterThan(0);
    expect(plan.ops.some((o) => o.kind === 'parafuso')).toBe(false);
  });

  it('cavilhas coladas', () => {
    const plan = computeJoinery(base('dowel'));
    expect(plan.ops.every((o) => ['cavilha', 'caneco-dobradica', 'base-dobradica', 'pino-prateleira'].includes(o.kind))).toBe(true);
  });
});

describe('passo a passo e outros móveis', () => {
  it('ordem: identificar, fita, furar, base antes do tampo, portas, instalar', () => {
    const titles = computeJoinery(base()).steps.map((s) => s.title);
    expect(titles[0]).toBe('Identifique as peças');
    expect(titles).toContain('Fure as peças');
    const iBase = titles.findIndex((t) => t.includes('base'));
    const iRail = titles.findIndex((t) => t.includes('travessa'));
    expect(iBase).toBeGreaterThan(-1);
    expect(iRail).toBeGreaterThan(iBase);
    expect(titles.at(-1)).toBe('Instale e nivele');
    expect(titles).toContain('Instale as portas');
  });

  it('mesa e móvel livre também recebem encaixes', () => {
    expect(computeJoinery(buildWorkbench(defaultParamsFor('workbench'))).ops.length).toBeGreaterThan(0);
    const l1 = createPanel('lateral', []);
    const l2 = createPanel('lateral', [l1]);
    const b = createPanel('horizontal', [l1, l2]);
    const plan = computeJoinery(buildCustom({ panels: [l1, l2, b], assembly: 'screw' }));
    expect(plan.ops.filter((o) => o.kind === 'parafuso').length).toBe(2 * Math.max(2, Math.ceil(500 / FASTENER_SPACING)));
  });
});
