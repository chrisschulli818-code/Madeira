import type {
  BedParams,
  CabinetParams,
  CarcassTemplateId,
  CustomParams,
  ProjectItem,
  PropParams,
  WorkbenchTemplateId,
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

export const CUSTOM: CabinetTemplate<CustomParams> = {
  id: 'custom',
  name: 'Móvel livre (do zero)',
  description: 'Comece com a tela em branco e monte o móvel peça por peça, com medidas e posições livres.',
  kind: 'custom',
  limits: { width: [0, 5000], height: [0, 3000], depth: [0, 1500] },
  defaults: { panels: [], assembly: 'screw' },
};

export const NIGHTSTAND: CabinetTemplate<CabinetParams> = {
  id: 'nightstand',
  name: 'Criado-mudo',
  description: 'Mesa de cabeceira com duas gavetas, sobre pés.',
  kind: 'carcass',
  limits: { width: [300, 800], height: [350, 800], depth: [300, 600] },
  defaults: {
    ...carcassBase,
    width: 450,
    height: 550,
    depth: 400,
    baseType: 'feet',
    plinthHeight: 100,
    plinthSetback: 0,
    columns: [{ id: 'ns-c1', widthRatio: 1, drawers: 2, doors: 0, shelves: 0, hangingRod: false, drawerPosition: 'top' }],
  },
};

export const DRESSER: CabinetTemplate<CabinetParams> = {
  id: 'dresser',
  name: 'Cômoda',
  description: 'Cômoda com quatro gavetas largas e rodapé.',
  kind: 'carcass',
  limits: { width: [500, 1800], height: [600, 1300], depth: [350, 600] },
  defaults: {
    ...carcassBase,
    width: 900,
    height: 850,
    depth: 450,
    plinthHeight: 80,
    plinthSetback: 20,
    columns: [{ id: 'dr-c1', widthRatio: 1, drawers: 4, doors: 0, shelves: 0, hangingRod: false, drawerPosition: 'top' }],
  },
};

export const BOOKSHELF: CabinetTemplate<CabinetParams> = {
  id: 'bookshelf',
  name: 'Estante',
  description: 'Estante aberta com dois vãos de prateleiras.',
  kind: 'carcass',
  limits: { width: [400, 2400], height: [600, 2600], depth: [200, 500] },
  defaults: {
    ...carcassBase,
    width: 900,
    height: 1800,
    depth: 300,
    plinthHeight: 60,
    plinthSetback: 0,
    columns: [
      { id: 'bs-c1', widthRatio: 1, drawers: 0, doors: 0, shelves: 4, hangingRod: false, drawerPosition: 'top' },
      { id: 'bs-c2', widthRatio: 1, drawers: 0, doors: 0, shelves: 4, hangingRod: false, drawerPosition: 'top' },
    ],
  },
};

export const TV_RACK: CabinetTemplate<CabinetParams> = {
  id: 'tv-rack',
  name: 'Rack de TV',
  description: 'Rack baixo com portas nas pontas e nicho aberto no centro.',
  kind: 'carcass',
  limits: { width: [800, 3000], height: [300, 800], depth: [300, 600] },
  defaults: {
    ...carcassBase,
    width: 1800,
    height: 500,
    depth: 420,
    baseType: 'feet',
    plinthHeight: 100,
    plinthSetback: 0,
    columns: [
      { id: 'tv-c1', widthRatio: 1, drawers: 0, doors: 1, shelves: 0, hangingRod: false, drawerPosition: 'top' },
      { id: 'tv-c2', widthRatio: 1.4, drawers: 0, doors: 0, shelves: 0, hangingRod: false, drawerPosition: 'top' },
      { id: 'tv-c3', widthRatio: 1, drawers: 0, doors: 1, shelves: 0, hangingRod: false, drawerPosition: 'top' },
    ],
  },
};

export const DESK: CabinetTemplate<WorkbenchParams> = {
  id: 'desk',
  name: 'Escrivaninha',
  description: 'Mesa de estudo/escritório com tampo, painéis laterais e saia traseira.',
  kind: 'workbench',
  limits: { width: [700, 2000], height: [650, 800], depth: [400, 800] },
  defaults: {
    width: 1200,
    height: 750,
    depth: 600,
    topThickness: 25,
    panelThickness: 18,
    sideOverhang: 30,
    apronHeight: 200,
    lowerShelf: false,
    lowerShelfHeight: 150,
    assembly: 'minifix',
  },
};

export const BED: CabinetTemplate<BedParams> = {
  id: 'bed',
  name: 'Cama',
  description: 'Cama de MDF com cabeceira, laterais e estrado, calculada pelo tamanho do colchão.',
  kind: 'bed',
  limits: { width: [800, 2200], height: [300, 1500], depth: [1800, 2300] },
  defaults: {
    mattressWidth: 1380,
    mattressLength: 1880,
    mattressHeight: 250,
    deckHeight: 300,
    railHeight: 200,
    headboardHeight: 1000,
    footboard: true,
    footboardHeight: 400,
    thickness: 18,
    deck: 'ripas',
    assembly: 'screw',
  },
};

/** Tamanhos comerciais de colchão (largura × comprimento, mm). */
export const MATTRESS_SIZES: Array<{ label: string; width: number; length: number }> = [
  { label: 'Solteiro', width: 880, length: 1880 },
  { label: 'Viúva', width: 1280, length: 1880 },
  { label: 'Casal', width: 1380, length: 1880 },
  { label: 'Queen', width: 1580, length: 1980 },
  { label: 'King', width: 1930, length: 2030 },
];

export const PROP: CabinetTemplate<PropParams> = {
  id: 'prop',
  name: 'Objeto do ambiente',
  description: 'Eletrodoméstico, sofá, mesa, cadeira, TV... só para compor o ambiente (fora da produção).',
  kind: 'prop',
  limits: { width: [100, 4000], height: [5, 2500], depth: [100, 4000] },
  defaults: { type: 'geladeira', width: 700, height: 1850, depth: 700, color: '#eef0f2' },
};

export const TEMPLATES = {
  'base-cabinet': BASE_CABINET,
  'wall-cabinet': WALL_CABINET,
  wardrobe: WARDROBE,
  nightstand: NIGHTSTAND,
  dresser: DRESSER,
  bookshelf: BOOKSHELF,
  'tv-rack': TV_RACK,
  workbench: WORKBENCH,
  desk: DESK,
  bed: BED,
  custom: CUSTOM,
  prop: PROP,
} as const satisfies Record<TemplateId, CabinetTemplate>;

/** Móveis que podem ser produzidos (os objetos do ambiente ficam de fora). */
export const TEMPLATE_LIST: CabinetTemplate[] = Object.values(TEMPLATES).filter((t) => t.kind !== 'prop');

export const templateKind = (id: TemplateId) => TEMPLATES[id].kind;
export const isCarcassId = (id: TemplateId): id is CarcassTemplateId => TEMPLATES[id].kind === 'carcass';
export const isWorkbenchId = (id: TemplateId): id is WorkbenchTemplateId => TEMPLATES[id].kind === 'workbench';

/** Cópia profunda dos parâmetros padrão (evita mutar o template). */
export function defaultParamsFor(id: WorkbenchTemplateId): WorkbenchParams;
export function defaultParamsFor(id: 'custom'): CustomParams;
export function defaultParamsFor(id: 'bed'): BedParams;
export function defaultParamsFor(id: 'prop'): PropParams;
export function defaultParamsFor(id: CarcassTemplateId): CabinetParams;
export function defaultParamsFor(id: TemplateId): ProjectItem['params'];
export function defaultParamsFor(id: TemplateId): ProjectItem['params'] {
  return structuredClone(TEMPLATES[id].defaults);
}

// Guardas de tipo por família de móvel.
export type CarcassItem = Extract<ProjectItem, { templateId: CarcassTemplateId }>;
export type WorkbenchItem = Extract<ProjectItem, { templateId: WorkbenchTemplateId }>;
export const isCarcassItem = (i: ProjectItem): i is CarcassItem => isCarcassId(i.templateId);
export const isWorkbenchItem = (i: ProjectItem): i is WorkbenchItem => isWorkbenchId(i.templateId);

/** Cria o par templateId/params com os valores padrão do template (tipado como `ProjectItem`). */
export function defaultItemParams(id: TemplateId): Pick<ProjectItem, 'templateId' | 'params'> {
  return { templateId: id, params: defaultParamsFor(id) } as Pick<ProjectItem, 'templateId' | 'params'>;
}
