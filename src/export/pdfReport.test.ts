import { describe, expect, it } from 'vitest';
import { buildCarcass } from '@/engine/cabinetEngine';
import { planCutting } from '@/engine/nestingEngine';
import { computeHardware } from '@/engine/hardwareEngine';
import { computeTools } from '@/engine/toolsEngine';
import { defaultParamsFor } from '@/engine/templates';
import { describeParams } from '@/lib/specs';
import type { MaterialRole, MaterialSpec, SheetSettings } from '@/types/woodcraft';
import { buildPdfReport, pdfText } from './pdfReport';

const materials: Record<MaterialRole, MaterialSpec> = {
  carcass: { role: 'carcass', label: 'MDF Branco TX', hasGrain: false },
  front: { role: 'front', label: 'MDF Freijó', hasGrain: true },
  back: { role: 'back', label: 'HDF Branco', hasGrain: false },
  drawer: { role: 'drawer', label: 'MDF Branco TX', hasGrain: false },
};
const sheet: SheetSettings = { length: 2750, width: 1830, kerf: 4, trim: 10 };

describe('buildPdfReport', () => {
  it('gera um PDF com todas as seções', () => {
    const params = defaultParamsFor('base-cabinet');
    const model = buildCarcass('base-cabinet', params);
    const doc = buildPdfReport({
      projectName: 'Cozinha — balcão pia',
      templateName: 'Balcão inferior',
      date: new Date(2026, 8, 26),
      specs: describeParams('base-cabinet', params),
      model,
      nesting: planCutting(model.pieces, materials, sheet),
      hardware: computeHardware(model, materials),
      tools: computeTools(model, { outsourcedCutting: true, outsourcedEdgeBanding: false }),
      materials,
      sheet,
    });
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(5);
    const content = doc.output();
    expect(content.startsWith('%PDF-')).toBe(true);
    for (const text of ['Lista de corte', 'Plano de corte', 'Lista de compras', 'Checklist de ferramentas', 'Lateral', 'Corredi']) {
      expect(content).toContain(text);
    }
  });

  it('troca símbolos fora da codificação das fontes padrão', () => {
    expect(pdfText('≈ 0,6 chapa — ≥ 900 → ok')).toBe('~ 0,6 chapa - >= 900 -> ok');
  });
});
