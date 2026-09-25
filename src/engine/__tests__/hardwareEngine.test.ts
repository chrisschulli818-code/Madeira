import { describe, expect, it } from 'vitest';
import { buildCarcass } from '../cabinetEngine';
import { computeHardware, hingesForDoorHeight } from '../hardwareEngine';
import { computeTools } from '../toolsEngine';
import { defaultParamsFor } from '../templates';
import type { MaterialRole, MaterialSpec } from '@/types/woodcraft';

const materials: Record<MaterialRole, MaterialSpec> = {
  carcass: { role: 'carcass', label: 'MDF Branco', hasGrain: false },
  front: { role: 'front', label: 'MDF Branco', hasGrain: false },
  back: { role: 'back', label: 'HDF Branco', hasGrain: false },
  drawer: { role: 'drawer', label: 'MDF Branco', hasGrain: false },
};

describe('computeHardware', () => {
  const model = buildCarcass('base-cabinet', defaultParamsFor('base-cabinet'));
  const items = computeHardware(model, materials);
  const find = (name: string) => items.filter((i) => i.name.startsWith(name));

  it('dobradiças por altura da porta', () => {
    expect(hingesForDoorHeight(700)).toBe(2);
    expect(hingesForDoorHeight(1200)).toBe(3);
    expect(hingesForDoorHeight(1800)).toBe(4);
    expect(hingesForDoorHeight(2300)).toBe(5);
    expect(find('Dobradiça').reduce((n, i) => n + i.quantity, 0)).toBe(2);
  });

  it('corrediças pelo comprimento calculado', () => {
    expect(find('Corrediça')).toEqual([expect.objectContaining({ quantity: 2, unit: 'par', specification: expect.stringContaining('500 mm') })]);
  });

  it('puxadores, pinos e fita de borda', () => {
    expect(find('Puxador')[0]!.quantity).toBe(3);
    expect(find('Suporte de prateleira')[0]!.quantity).toBe(4);
    expect(find('Fita de borda').length).toBeGreaterThan(0);
  });

  it('minifix troca parafusos por minifix + cavilhas', () => {
    const m = buildCarcass('base-cabinet', { ...defaultParamsFor('base-cabinet'), assembly: 'minifix' });
    const list = computeHardware(m, materials);
    expect(list.some((i) => i.name.startsWith('Minifix'))).toBe(true);
    expect(list.some((i) => i.specification.startsWith('4,0 × 50'))).toBe(false);
  });
});

describe('computeTools', () => {
  it('ferramentas de dobradiça e corte próprio', () => {
    const model = buildCarcass('base-cabinet', defaultParamsFor('base-cabinet'));
    const tools = computeTools(model, { outsourcedCutting: false, outsourcedEdgeBanding: false });
    const ids = tools.map((t) => t.id);
    expect(ids).toContain('forstner-35');
    expect(ids).toContain('circular-saw');
    expect(ids).toContain('iron');
    expect(tools.find((t) => t.id === 'drill-5')!.category).toBe('obrigatoria');
  });
});
