/**
 * Preços de referência (R$) usados quando o usuário não informou o seu.
 * Valores médios de varejo no Brasil — servem de ponto de partida e devem ser
 * ajustados à região e ao fornecedor na aba Orçamento.
 */
import type { HardwareItem } from '@/types/woodcraft';

/** Preço de referência de uma chapa inteira (2750 × 1830) pela espessura. */
export function defaultSheetPrice(thickness: number, label = ''): number {
  const table: Array<[number, number]> = [
    [3, 95],
    [6, 150],
    [9, 200],
    [12, 240],
    [15, 290],
    [18, 340],
    [25, 480],
  ];
  const base = table.find(([t]) => thickness <= t)?.[1] ?? 560;
  // Padrões amadeirados costumam custar mais que o branco.
  return /branco|white|cru/i.test(label) || !label ? base : Math.round(base * 1.25);
}

type Rule = [RegExp, number | ((item: HardwareItem) => number)];

const RULES: Rule[] = [
  [/^Parafuso de união/, 1.2],
  [/^Parafuso chipboard cabeça panela/, 0.08],
  [/^Parafuso chipboard/, 0.18],
  [/^Tapa-furo/, 0.05],
  [/^Minifix/, 0.9],
  [/^Cavilha/, 0.08],
  [/^Cola PVA/, 18],
  [/^Prego|grampo/i, 0.03],
  [/^Corrediça telescópica/, (i) => Math.round(20 + (Number(i.specification.match(/(\d+) mm/)?.[1]) || 450) * 0.04)],
  [/^Dobradiça.*reta/, 9],
  [/^Dobradiça.*curva/, 10],
  [/^Puxador/, 18],
  [/^Suporte de prateleira/, 0.4],
  [/^Cantoneira L/, (i) => (i.specification.startsWith('40') ? 3.5 : 1.2)],
  [/^Calço|sapata/i, (i) => (/M8/.test(i.specification) ? 6 : 3)],
  [/^Pé regulável/, 5],
  [/^Suspensor/, 18],
  [/^Bucha/, 0.8],
  [/^Tubo oblongo/, 28],
  [/^Suporte para tubo/, 6],
  [/^Fita de borda (\d+)/, (i) => ({ 19: 1.2, 22: 1.5, 35: 2.8, 45: 3.5 })[Number(i.name.match(/(\d+) mm/)?.[1])] ?? 1.5],
  [/^Lixa/, 2.5],
  [/^Parafuso de união/, 1.2],
];

/** Preço unitário de referência de um insumo (por un, par ou metro). */
export function defaultItemPrice(item: HardwareItem): number {
  for (const [pattern, price] of RULES) {
    if (pattern.test(item.name)) return typeof price === 'number' ? price : price(item);
  }
  return 0;
}
