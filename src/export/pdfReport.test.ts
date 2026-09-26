import { describe, expect, it } from 'vitest';
import { planCutting } from '@/engine/nestingEngine';
import { buildItemResults, projectHardware, projectPieces, projectTools } from '@/engine/projectEngine';
import { computeBudget, DEFAULT_PRICES } from '@/engine/budgetEngine';
import { createItem, DEFAULT_MATERIALS, DEFAULT_SERVICES, DEFAULT_SHEET } from '@/engine/projectFile';
import { TEMPLATES } from '@/engine/templates';
import { describeParams } from '@/lib/specs';
import { buildPdfReport, pdfText } from './pdfReport';
import { createPanel } from '@/engine/customEngine';
import { DEFAULT_ROOM, resolvePlacements } from '@/engine/roomEngine';
import type { ProjectItem } from '@/types/woodcraft';

function sampleReport(itemCount: number, extra: ProjectItem[] = []) {
  const items = [...[createItem('base-cabinet', 'Balcão pia'), createItem('wall-cabinet', 'Aéreo'), createItem('workbench')].slice(0, itemCount), ...extra];
  const results = buildItemResults(items);
  const pieces = projectPieces(results);
  const nesting = planCutting(pieces, DEFAULT_MATERIALS, DEFAULT_SHEET);
  const hardware = projectHardware(results, pieces, DEFAULT_MATERIALS);
  return buildPdfReport({
    projectName: 'Cozinha — reforma',
    date: new Date(2026, 8, 26),
    items: results.map(({ item, model }) => ({
      name: item.name,
      templateName: TEMPLATES[item.templateId].name,
      quantity: item.quantity,
      specs: describeParams(item.templateId, item.params),
      model,
    })),
    pieces,
    nesting,
    hardware,
    tools: projectTools(results, DEFAULT_SERVICES),
    budget: computeBudget(nesting, hardware, DEFAULT_SERVICES, DEFAULT_PRICES),
    materials: DEFAULT_MATERIALS,
    sheet: DEFAULT_SHEET,
    room: DEFAULT_ROOM,
    placements: resolvePlacements(results, DEFAULT_ROOM, []),
  });
}

describe('buildPdfReport', () => {
  it('gera um PDF com todas as seções', () => {
    const doc = sampleReport(1);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(6);
    const content = doc.output();
    expect(content.startsWith('%PDF-')).toBe(true);
    for (const text of ['Montagem passo a passo', 'Mapa de furação', 'Ambiente: Cozinha', 'Parede', 'Resumo do projeto', 'Lista de corte', 'Plano de corte', 'Lista de compras', 'Orçamento', 'Checklist de ferramentas', 'Lateral', 'Corredi']) {
      expect(content).toContain(text);
    }
  });

  it('inclui uma seção por móvel em projetos com vários móveis', () => {
    const content = sampleReport(3).output();
    for (const text of ['Móvel 1: Balcão pia', 'Móvel 2: Aéreo', 'Móvel 3: Mesa de trabalho']) expect(content).toContain(text);
  });

  it('aceita móvel livre, vazio ou com peças', () => {
    const empty = createItem('custom', 'Vazio');
    const built = createItem('custom', 'Caixa');
    if (built.templateId === 'custom') {
      const a = createPanel('lateral', []);
      const b = createPanel('lateral', [a]);
      built.params.panels = [a, b, createPanel('horizontal', [a, b])];
    }
    const content = sampleReport(0, [empty, built]).output();
    expect(content).toContain('Este móvel ainda não tem peças.');
    expect(content).toContain('Junções detectadas');
  });

  it('troca símbolos fora da codificação das fontes padrão', () => {
    expect(pdfText('≈ 0,6 chapa — ≥ 900 → ok')).toBe('~ 0,6 chapa - >= 900 -> ok');
  });
});
