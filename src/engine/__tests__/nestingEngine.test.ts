import { describe, expect, it } from 'vitest';
import { packSheets, planCutting } from '../nestingEngine';
import { buildCarcass } from '../cabinetEngine';
import { defaultParamsFor } from '../templates';
import type { MaterialRole, MaterialSpec, Placement, SheetSettings } from '@/types/woodcraft';

const SHEET: SheetSettings = { length: 2750, width: 1830, kerf: 4, trim: 10 };

function overlaps(a: Placement, b: Placement, kerf: number) {
  return a.x < b.x + b.w + kerf && b.x < a.x + a.w + kerf && a.y < b.y + b.h + kerf && b.y < a.y + a.h + kerf;
}

describe('packSheets', () => {
  it('não sobrepõe peças e respeita o kerf e o refilo', () => {
    const r = packSheets(
      [
        { id: 'a', label: 'A', length: 800, width: 500, quantity: 6, canRotate: true },
        { id: 'b', label: 'B', length: 1200, width: 300, quantity: 4, canRotate: false },
        { id: 'c', label: 'C', length: 400, width: 400, quantity: 5, canRotate: true },
      ],
      SHEET,
    );
    expect(r.unplaced).toHaveLength(0);
    for (const s of r.sheets) {
      s.placements.forEach((a, i) => {
        expect(a.x).toBeGreaterThanOrEqual(SHEET.trim);
        expect(a.y).toBeGreaterThanOrEqual(SHEET.trim);
        expect(a.x + a.w).toBeLessThanOrEqual(SHEET.length - SHEET.trim);
        expect(a.y + a.h).toBeLessThanOrEqual(SHEET.width - SHEET.trim);
        s.placements.slice(i + 1).forEach((b) => expect(overlaps(a, b, SHEET.kerf - 0.001)).toBe(false));
      });
    }
    const placed = r.sheets.reduce((n, s) => n + s.placements.length, 0);
    expect(placed).toBe(15);
  });

  it('respeita o veio travado (sem rotação)', () => {
    const r = packSheets([{ id: 'x', label: 'X', length: 2000, width: 300, quantity: 3, canRotate: false }], SHEET);
    for (const pl of r.sheets.flatMap((s) => s.placements)) {
      expect(pl.rotated).toBe(false);
      expect(pl.w).toBe(2000);
    }
  });

  it('marca como não posicionadas as peças maiores que a chapa', () => {
    const r = packSheets([{ id: 'big', label: 'Big', length: 3000, width: 500, quantity: 1, canRotate: true }], SHEET);
    expect(r.unplaced).toHaveLength(1);
    expect(r.sheets).toHaveLength(0);
  });

  it('encaixa peças que cabem exatamente na área útil', () => {
    const r = packSheets([{ id: 'full', label: 'Full', length: 2730, width: 1810, quantity: 2, canRotate: false }], SHEET);
    expect(r.sheets).toHaveLength(2);
    expect(r.utilization).toBeCloseTo(1);
  });
});

describe('planCutting', () => {
  it('agrupa por material e espessura', () => {
    const materials: Record<MaterialRole, MaterialSpec> = {
      carcass: { role: 'carcass', label: 'MDF Branco', hasGrain: false },
      front: { role: 'front', label: 'MDF Branco', hasGrain: false },
      back: { role: 'back', label: 'HDF Branco', hasGrain: false },
      drawer: { role: 'drawer', label: 'MDF Branco', hasGrain: false },
    };
    const model = buildCarcass('base-cabinet', defaultParamsFor('base-cabinet'));
    const plan = planCutting(model.pieces, materials, SHEET);
    // 18 mm (caixa + frentes), 15 mm (gavetas), 6 mm (fundos)
    expect(plan.map((g) => g.thickness)).toEqual([18, 15, 6]);
    expect(plan.every((g) => g.unplaced.length === 0)).toBe(true);
    expect(plan[0]!.sheets).toHaveLength(1);
  });
});
