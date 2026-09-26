import type { BedParams, CabinetParams, CustomParams, ProjectItem, PropParams, TemplateId, WorkbenchParams } from '@/types/woodcraft';
import { propInfo } from '@/engine/propEngine';
import { buildBed } from '@/engine/bedEngine';
import { buildCustom, PANEL_KIND_LABELS } from '@/engine/customEngine';

const ASSEMBLY = { screw: 'Parafuso direto', minifix: 'Minifix + cavilhas', dowel: 'Cavilhas coladas' } as const;
const BASE = { plinth: 'Rodapé recuado', feet: 'Pés reguláveis', none: 'Suspenso / sem rodapé' } as const;

/** Especificações gerais em formato "rótulo → valor" para o relatório. */
export function describeParams(templateId: TemplateId, params: ProjectItem['params']): Array<[string, string]> {
  if (templateId === 'prop') {
    const p = params as PropParams;
    return [
      ['Objeto', propInfo(p.type).label],
      ['Medidas (L × A × P)', `${p.width} × ${p.height} × ${p.depth} mm`],
      ['Produção', 'Não — objeto só para compor o ambiente'],
    ];
  }
  if (templateId === 'bed') {
    const p = params as BedParams;
    const { overall } = buildBed(p);
    return [
      ['Dimensões externas (L × A × P)', `${overall.width} × ${overall.height} × ${overall.depth} mm`],
      ['Colchão', `${p.mattressWidth} × ${p.mattressLength} × ${p.mattressHeight} mm`],
      ['Estrado', `${p.deck === 'ripas' ? 'Ripas de 70 mm' : 'Chapa inteira'}, a ${p.deckHeight} mm do piso`],
      ['Cabeceira / peseira', `${p.headboardHeight} mm / ${p.footboard ? `${p.footboardHeight} mm` : 'baixa'}`],
      ['Chapa', `${p.thickness} mm`],
      ['Montagem', `${ASSEMBLY[p.assembly]} + ferragens de encaixe nas laterais`],
    ];
  }
  if (templateId === 'custom') {
    const p = params as CustomParams;
    const { overall, joints } = buildCustom(p);
    const byKind = new Map<string, number>();
    for (const panel of p.panels) byKind.set(PANEL_KIND_LABELS[panel.kind], (byKind.get(PANEL_KIND_LABELS[panel.kind]) ?? 0) + 1);
    return [
      ['Dimensões externas (L × A × P)', `${overall.width} × ${overall.height} × ${overall.depth} mm`],
      ['Painéis', p.panels.length ? [...byKind].map(([k, n]) => `${n} ${k.toLowerCase()}`).join(', ') : 'nenhum'],
      ['Junções detectadas', String(joints.length)],
      ['Montagem', ASSEMBLY[p.assembly]],
    ];
  }
  const q = params as CabinetParams | WorkbenchParams;
  const dims: [string, string] = ['Dimensões externas (L × A × P)', `${q.width} × ${q.height} × ${q.depth} mm`];
  if (templateId === 'workbench' || templateId === 'desk') {
    const p = params as WorkbenchParams;
    return [
      dims,
      ['Tampo', `${p.topThickness} mm, balanço de ${p.sideOverhang} mm`],
      ['Painéis laterais / saia', `${p.panelThickness} mm, saia de ${p.apronHeight} mm`],
      ['Prateleira inferior', p.lowerShelf ? `a ${p.lowerShelfHeight} mm do piso` : 'não'],
      ['Montagem', ASSEMBLY[p.assembly]],
    ];
  }
  const p = params as CabinetParams;
  const drawers = p.columns.reduce((n, c) => n + c.drawers, 0);
  const doors = p.columns.reduce((n, c) => n + c.doors, 0);
  const shelves = p.columns.reduce((n, c) => n + c.shelves, 0);
  return [
    dims,
    ['Chapa da caixa / frentes', `${p.carcassThickness} mm / ${p.frontThickness} mm`],
    ['Fundo', `${p.backThickness} mm, ${p.backMode === 'overlay' ? 'sobreposto (pregado)' : 'encaixado em rasgo'}`],
    ['Apoio', p.baseType === 'none' ? BASE.none : `${BASE[p.baseType]}, ${p.plinthHeight} mm${p.baseType === 'plinth' ? `, recuo ${p.plinthSetback} mm` : ''}`],
    ['Tampo da caixa', p.topType === 'full' ? 'Painel inteiro' : 'Travessas (tampo sobreposto)'],
    ['Vãos', `${p.columns.length} vão(s), ${p.columns.length - 1} divisória(s)`],
    ['Frentes', `${doors} porta(s), ${drawers} gaveta(s), folga ${p.frontGap} mm`],
    ['Prateleiras móveis', String(shelves)],
    ['Montagem', ASSEMBLY[p.assembly]],
  ];
}
