import { describe, expect, it } from 'vitest';
import { buildItemResults, projectHardware, projectPieces, projectTools } from '../projectEngine';
import { planCutting } from '../nestingEngine';
import { computeBudget, DEFAULT_PRICES } from '../budgetEngine';
import { defaultItemPrice, defaultSheetPrice } from '../pricing';
import { createItem, DEFAULT_MATERIALS, DEFAULT_SERVICES, DEFAULT_SHEET, parseProjectFile, serializeProject } from '../projectFile';
import { migrateState } from '@/store/projectStore';
import type { ProjectItem } from '@/types/woodcraft';

const twoItems = (): ProjectItem[] => [
  { ...createItem('base-cabinet', 'Balcão'), quantity: 2 },
  createItem('wall-cabinet', 'Aéreo'),
];

describe('projeto com vários móveis', () => {
  const items = twoItems();
  const results = buildItemResults(items);
  const pieces = projectPieces(results);

  it('ids de peça são únicos no projeto', () => {
    const ids = pieces.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.includes('/'))).toBe(true);
  });

  it('multiplica as quantidades pelos móveis iguais', () => {
    const single = results[0]!.model.pieces.find((p) => p.name === 'Lateral')!;
    const inProject = pieces.find((p) => p.itemId === items[0]!.id && p.name === 'Lateral')!;
    expect(inProject.quantity).toBe(single.quantity * 2);
    expect(inProject.itemName).toBe('Balcão');
  });

  it('plano de corte combina as peças de todos os móveis', () => {
    const nesting = planCutting(pieces, DEFAULT_MATERIALS, DEFAULT_SHEET);
    const placed = nesting.reduce((n, g) => n + g.sheets.reduce((m, s) => m + s.placements.length, 0), 0);
    expect(placed).toBe(pieces.reduce((n, p) => n + p.quantity, 0));
  });

  it('soma ferragens considerando a quantidade de cada móvel', () => {
    const hardware = projectHardware(results, pieces, DEFAULT_MATERIALS);
    const hinges = hardware.filter((i) => i.name.startsWith('Dobradiça')).reduce((n, i) => n + i.quantity, 0);
    // Balcão: 1 porta × 2 dobradiças × 2 móveis; Aéreo: 2 portas × 2 dobradiças
    expect(hinges).toBe(8);
    expect(hardware.find((i) => i.name.startsWith('Corrediça'))!.quantity).toBe(4);
    expect(hardware.filter((i) => i.name.startsWith('Fita de borda')).length).toBeGreaterThan(0);
    // Consumíveis contados uma vez para o projeto, não por móvel
    expect(hardware.find((i) => i.name.startsWith('Lixa'))!.quantity).toBe(4);
  });

  it('une as ferramentas (obrigatória em algum móvel prevalece)', () => {
    const tools = projectTools(results, DEFAULT_SERVICES);
    expect(tools.find((t) => t.id === 'ladder')?.category).toBe('obrigatoria');
    expect(new Set(tools.map((t) => t.id)).size).toBe(tools.length);
  });
});

describe('orçamento', () => {
  const results = buildItemResults(twoItems());
  const pieces = projectPieces(results);
  const nesting = planCutting(pieces, DEFAULT_MATERIALS, DEFAULT_SHEET);
  const hardware = projectHardware(results, pieces, DEFAULT_MATERIALS);

  it('usa preços de referência e soma os totais', () => {
    const b = computeBudget(nesting, hardware, DEFAULT_SERVICES, DEFAULT_PRICES);
    const sheets = b.lines.filter((l) => l.category === 'chapas');
    expect(sheets.length).toBe(nesting.length);
    expect(sheets.every((l) => l.unitPrice > 0 && !l.custom)).toBe(true);
    expect(b.cost).toBeCloseTo(Object.values(b.subtotals).reduce((a, c) => a + c, 0), 2);
    // Corte terceirizado por padrão: linha de serviço por chapa
    expect(b.lines.find((l) => l.key === 'service:cutting')!.quantity).toBe(nesting.reduce((n, g) => n + g.sheets.length, 0));
  });

  it('aplica preços informados, mão de obra e margem', () => {
    const key = nesting[0]!.materialKey;
    const hinge = hardware.find((i) => i.name.startsWith('Dobradiça'))!;
    const b = computeBudget(nesting, hardware, DEFAULT_SERVICES, {
      ...DEFAULT_PRICES,
      sheetPrices: { [key]: 500 },
      itemPrices: { [hinge.id]: 20 },
      labor: 800,
      marginPercent: 25,
    });
    const sheetLine = b.lines.find((l) => l.key === `sheet:${key}`)!;
    expect(sheetLine).toMatchObject({ unitPrice: 500, custom: true, total: 500 * nesting[0]!.sheets.length });
    expect(b.lines.find((l) => l.key === `item:${hinge.id}`)!.unitPrice).toBe(20);
    expect(b.subtotals['mao-de-obra']).toBe(800);
    expect(b.margin).toBeCloseTo(b.cost * 0.25, 1);
    expect(b.price).toBeCloseTo(b.cost * 1.25, 1);
  });

  it('preços de referência', () => {
    expect(defaultSheetPrice(18, 'MDF Branco TX')).toBe(340);
    expect(defaultSheetPrice(18, 'MDF Freijó')).toBeGreaterThan(340);
    expect(defaultItemPrice({ id: 'x', category: 'ferragem', name: 'Corrediça telescópica', specification: '500 mm', quantity: 1, unit: 'par', application: '' })).toBe(40);
  });
});

describe('arquivo de projeto', () => {
  it('salva e abre sem perder dados', () => {
    const items = twoItems();
    const data = {
      projectName: 'Cozinha',
      items,
      sheet: DEFAULT_SHEET,
      materials: DEFAULT_MATERIALS,
      services: DEFAULT_SERVICES,
      prices: { ...DEFAULT_PRICES, labor: 300, itemPrices: { abc: 2.5 } },
    };
    const parsed = parseProjectFile(serializeProject(data));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toEqual(data);
  });

  it('rejeita arquivos inválidos', () => {
    expect(parseProjectFile('não é json').ok).toBe(false);
    expect(parseProjectFile('{"foo":1}').ok).toBe(false);
    expect(parseProjectFile(JSON.stringify({ app: 'woodcraft-planner', version: 2, items: [] })).ok).toBe(false);
  });

  it('completa campos ausentes e corrige valores inválidos', () => {
    const parsed = parseProjectFile(
      JSON.stringify({
        app: 'woodcraft-planner',
        version: 2,
        items: [
          { templateId: 'base-cabinet', params: { width: 1200, assembly: 'cola-quente', columns: [{ drawers: 2, doors: 7 }] } },
          { templateId: 'inexistente' },
        ],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const [item] = parsed.data.items;
    expect(parsed.data.items).toHaveLength(1);
    expect(item!.templateId).toBe('base-cabinet');
    if (item!.templateId === 'workbench' || item!.templateId === 'custom') return;
    expect(item!.params.width).toBe(1200);
    expect(item!.params.height).toBe(870);
    expect(item!.params.assembly).toBe('screw');
    expect(item!.params.columns[0]).toMatchObject({ drawers: 2, doors: 1, drawerPosition: 'top' });
    expect(parsed.data.sheet).toEqual(DEFAULT_SHEET);
  });

  it('migra o estado salvo da versão anterior (um móvel por vez)', () => {
    const migrated = migrateState(
      {
        projectName: 'Antigo',
        templateId: 'wall-cabinet',
        cabinetParams: { 'wall-cabinet': { width: 1000, height: 700, depth: 330, columns: [{ id: 'x', widthRatio: 1, drawers: 0, doors: 2, shelves: 3, hangingRod: false }] } },
        workbenchParams: {},
        sheet: DEFAULT_SHEET,
      },
      1,
    );
    expect(migrated.projectName).toBe('Antigo');
    expect(migrated.items).toHaveLength(1);
    const item = migrated.items![0]!;
    expect(item.templateId).toBe('wall-cabinet');
    expect(item.templateId === 'wall-cabinet' && item.params.width).toBe(1000);
    expect(migrated.activeItemId).toBe(item.id);
    expect('cabinetParams' in migrated).toBe(false);
  });
});
