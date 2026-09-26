import type { CabinetParams, TemplateId, WorkbenchParams } from '@/types/woodcraft';

const ASSEMBLY = { screw: 'Parafuso direto', minifix: 'Minifix + cavilhas', dowel: 'Cavilhas coladas' } as const;
const BASE = { plinth: 'Rodapé recuado', feet: 'Pés reguláveis', none: 'Suspenso / sem rodapé' } as const;

/** Especificações gerais em formato "rótulo → valor" para o relatório. */
export function describeParams(templateId: TemplateId, params: CabinetParams | WorkbenchParams): Array<[string, string]> {
  const dims: [string, string] = ['Dimensões externas (L × A × P)', `${params.width} × ${params.height} × ${params.depth} mm`];
  if (templateId === 'workbench') {
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
