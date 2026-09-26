/**
 * Orçamento do projeto: chapas + insumos + serviços da madeireira + mão de obra + margem.
 * Cada preço usa o valor informado pelo usuário ou, na falta dele, o preço de referência.
 */
import type {
  Budget,
  BudgetCategory,
  BudgetLine,
  HardwareItem,
  NestingResult,
  PriceSettings,
  ServiceSettings,
} from '@/types/woodcraft';
import { defaultItemPrice, defaultSheetPrice } from './pricing';

export const DEFAULT_PRICES: PriceSettings = {
  sheetPrices: {},
  itemPrices: {},
  cuttingPerSheet: 30,
  edgeBandingPerMeter: 2.5,
  labor: 0,
  marginPercent: 0,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export const sheetPriceKey = (materialKey: string) => `sheet:${materialKey}`;

export function computeBudget(
  nesting: NestingResult[],
  hardware: HardwareItem[],
  services: ServiceSettings,
  prices: PriceSettings,
): Budget {
  const lines: BudgetLine[] = [];
  const line = (l: Omit<BudgetLine, 'total'>) => lines.push({ ...l, total: round2(l.quantity * l.unitPrice) });

  for (const g of nesting) {
    if (!g.sheets.length) continue;
    const custom = prices.sheetPrices[g.materialKey];
    line({
      key: sheetPriceKey(g.materialKey),
      category: 'chapas',
      description: `Chapa ${g.materialLabel} ${g.thickness} mm`,
      detail: `${g.sheet.length} × ${g.sheet.width} mm`,
      quantity: g.sheets.length,
      unit: 'un',
      unitPrice: custom ?? defaultSheetPrice(g.thickness, g.materialLabel),
      custom: custom !== undefined,
    });
  }

  for (const item of hardware) {
    const custom = prices.itemPrices[item.id];
    line({
      key: `item:${item.id}`,
      category: 'insumos',
      description: item.name,
      detail: item.specification,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: custom ?? defaultItemPrice(item),
      custom: custom !== undefined,
    });
  }

  const totalSheets = nesting.reduce((n, g) => n + g.sheets.length, 0);
  if (services.outsourcedCutting && totalSheets) {
    line({
      key: 'service:cutting',
      category: 'servicos',
      description: 'Corte na madeireira',
      detail: 'Por chapa cortada',
      quantity: totalSheets,
      unit: 'chapa',
      unitPrice: prices.cuttingPerSheet,
      custom: false,
    });
  }
  const bandMeters = hardware.filter((i) => i.name.startsWith('Fita de borda')).reduce((n, i) => n + i.quantity, 0);
  if (services.outsourcedEdgeBanding && bandMeters) {
    line({
      key: 'service:edge-banding',
      category: 'servicos',
      description: 'Aplicação de fita na madeireira',
      detail: 'Por metro de fita',
      quantity: bandMeters,
      unit: 'm',
      unitPrice: prices.edgeBandingPerMeter,
      custom: false,
    });
  }
  if (prices.labor > 0) {
    line({
      key: 'labor',
      category: 'mao-de-obra',
      description: 'Mão de obra',
      detail: 'Montagem e instalação',
      quantity: 1,
      unit: 'vb',
      unitPrice: prices.labor,
      custom: true,
    });
  }

  const subtotals: Record<BudgetCategory, number> = { chapas: 0, insumos: 0, servicos: 0, 'mao-de-obra': 0 };
  for (const l of lines) subtotals[l.category] = round2(subtotals[l.category] + l.total);
  const cost = round2(Object.values(subtotals).reduce((a, b) => a + b, 0));
  const margin = round2((cost * Math.max(0, prices.marginPercent)) / 100);
  return { lines, subtotals, cost, margin, price: round2(cost + margin) };
}
