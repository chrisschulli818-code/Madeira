import type {
  CabinetParams,
  CabinetTemplate,
  ColumnConfig,
  TemplateId,
  WorkbenchParams,
} from '@/types/woodcraft';

let columnSeq = 0;
/** Cria um vão com valores padrão (ids únicos para listas React). */
export function makeColumn(partial: Partial<ColumnConfig> = {}): ColumnConfig {
  columnSeq += 1;
  return {
    id: `col-${Date.now().toString(36)}-${columnSeq}`,
    widthRatio: 1,
    drawers: 0,
    doors: 1,
    shelves: 1,
    hangingRod: false,
    drawerPosition: 'top',
    ...partial,
  };
}

const carcassBase: Omit<CabinetParams, 'width' | 'height' | 'depth' | 'columns'> = {
  carcassThickness: 18,
  backThickness: 6,
  frontThickness: 18,
  drawerBoxThickness: 15,
  backMode: 'overlay',
  baseType: 'plinth',
  plinthHeight: 100,
  plinthSetback: 50,
  topType: 'full',
  drawerFrontHeight: 180,
  frontGap: 3,
  assembly: 'screw',
};

export const BASE_CABINET: CabinetTemplate<CabinetParams> = {
  id: 'base-cabinet',
  name: 'Balcão inferior',
  description: 'Gabinete de cozinha/banheiro com gavetas e porta, rodapé recuado e travessas para tampo.',
  kind: 'carcass',
  limits: { width: [300, 1500], height: [500, 1000], depth: [300, 700] },
  defaults: {
    ...carcassBase,
    width: 900,
    height: 870,
    depth: 560,
    topType: 'rails',
    columns: [
      { id: 'base-c1', widthRatio: 1, drawers: 2, doors: 0, shelves: 0, hangingRod: false, drawerPosition: 'top' },
      { id: 'base-c2', widthRatio: 1, drawers: 0, doors: 1, shelves: 1, hangingRod: false, drawerPosition: 'top' },
    ],
  },
};

export const WALL_CABINET: CabinetTemplate<CabinetParams> = {
  id: 'wall-cabinet',
  name: 'Armário aéreo',
  description: 'Armário suspenso de cozinha com portas de abrir e prateleiras móveis.',
  kind: 'carcass',
  limits: { width: [300, 1500], height: [300, 1000], depth: [250, 450] },
  defaults: {
    ...carcassBase,
    width: 800,
    height: 700,
    depth: 330,
    baseType: 'none',
    plinthHeight: 0,
    plinthSetback: 0,
    columns: [{ id: 'wall-c1', widthRatio: 1, drawers: 0, doors: 2, shelves: 2, hangingRod: false, drawerPosition: 'top' }],
  },
};

export const WARDROBE: CabinetTemplate<CabinetParams> = {
  id: 'wardrobe',
  name: 'Guarda-roupa modular',
  description: 'Módulo de guarda-roupa com vão de prateleiras e vão cabideiro com maleiro.',
  kind: 'carcass',
  limits: { width: [400, 2400], height: [1200, 2700], depth: [400, 700] },
  defaults: {
    ...carcassBase,
    width: 1200,
    height: 2200,
    depth: 580,
    plinthHeight: 80,
    plinthSetback: 30,
    columns: [
      { id: 'ward-c1', widthRatio: 1, drawers: 0, doors: 1, shelves: 4, hangingRod: false, drawerPosition: 'top' },
      { id: 'ward-c2', widthRatio: 1, drawers: 0, doors: 1, shelves: 1, hangingRod: true, drawerPosition: 'top' },
    ],
  },
};

export const WORKBENCH: CabinetTemplate<WorkbenchParams> = {
  id: 'workbench',
  name: 'Mesa de trabalho',
  description: 'Mesa simples com tampo sobre dois painéis laterais, saia traseira e prateleira inferior.',
  kind: 'workbench',
  limits: { width: [600, 2400], height: [600, 1100], depth: [400, 1000] },
  defaults: {
    width: 1500,
    height: 900,
    depth: 700,
    topThickness: 25,
    panelThickness: 18,
    sideOverhang: 50,
    apronHeight: 150,
    lowerShelf: true,
    lowerShelfHeight: 150,
    assembly: 'screw',
  },
};

export const TEMPLATES = {
  'base-cabinet': BASE_CABINET,
  'wall-cabinet': WALL_CABINET,
  wardrobe: WARDROBE,
  workbench: WORKBENCH,
} as const satisfies Record<TemplateId, CabinetTemplate>;

export const TEMPLATE_LIST: CabinetTemplate[] = Object.values(TEMPLATES);

/** Cópia profunda dos parâmetros padrão (evita mutar o template). */
export function defaultParamsFor(id: 'workbench'): WorkbenchParams;
export function defaultParamsFor(id: Exclude<TemplateId, 'workbench'>): CabinetParams;
export function defaultParamsFor(id: TemplateId): CabinetParams | WorkbenchParams;
export function defaultParamsFor(id: TemplateId): CabinetParams | WorkbenchParams {
  return structuredClone(TEMPLATES[id].defaults);
}
