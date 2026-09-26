/**
 * Arquivo de projeto (.woodcraft.json): salvar e abrir projetos em outro computador
 * ou compartilhar com outra pessoa.
 *
 * `parseProjectFile` valida e completa os dados com os padrões dos templates, de modo que
 * arquivos antigos ou editados à mão não quebrem o app.
 */
import type {
  BedParams,
  PropParams,
  FurniturePlacement,
  RoomSettings,
  Rotation,
  CabinetParams,
  CustomPanel,
  ColumnConfig,
  MaterialRole,
  MaterialSpec,
  PriceSettings,
  ProjectItem,
  ServiceSettings,
  SheetSettings,
  TemplateId,
  WorkbenchParams,
} from '@/types/woodcraft';
import { DEFAULT_PRICES } from './budgetEngine';
import { defaultItemParams, defaultParamsFor, isCarcassId, isWorkbenchId, makeColumn, TEMPLATES } from './templates';
import { PROP_CATALOG, propInfo } from './propEngine';
import { newPanelId } from './customEngine';
import { DEFAULT_ROOM, newOpeningId } from './roomEngine';

export const PROJECT_FILE_APP = 'woodcraft-planner';
export const PROJECT_FILE_VERSION = 2;
export const PROJECT_FILE_EXTENSION = '.woodcraft.json';

export interface ProjectData {
  projectName: string;
  items: ProjectItem[];
  sheet: SheetSettings;
  materials: Record<MaterialRole, MaterialSpec>;
  services: ServiceSettings;
  prices: PriceSettings;
  /** Cômodo onde os móveis são posicionados. */
  room: RoomSettings;
  /** Posições dos móveis no cômodo (só as que o usuário ajustou; o resto é automático). */
  placements: FurniturePlacement[];
}

export interface ProjectFile extends ProjectData {
  app: typeof PROJECT_FILE_APP;
  version: number;
  savedAt: string;
}

export const DEFAULT_SHEET: SheetSettings = { length: 2750, width: 1830, kerf: 4, trim: 10 };

export const DEFAULT_MATERIALS: Record<MaterialRole, MaterialSpec> = {
  carcass: { role: 'carcass', label: 'MDF Branco TX', hasGrain: false },
  front: { role: 'front', label: 'MDF Branco TX', hasGrain: false },
  back: { role: 'back', label: 'HDF Branco', hasGrain: false },
  drawer: { role: 'drawer', label: 'MDF Branco TX', hasGrain: false },
};

export const DEFAULT_SERVICES: ServiceSettings = { outsourcedCutting: true, outsourcedEdgeBanding: false };

let itemSeq = 0;
export const newItemId = () => `m${Date.now().toString(36)}${(itemSeq++).toString(36)}`;

/** Cria um novo móvel a partir de um template. */
export function createItem(templateId: TemplateId, name?: string): ProjectItem {
  const base = { id: newItemId(), name: name ?? TEMPLATES[templateId].name, quantity: 1 };
  return { ...base, ...defaultItemParams(templateId) } as ProjectItem;
}

export function serializeProject(data: ProjectData): string {
  const file: ProjectFile = { app: PROJECT_FILE_APP, version: PROJECT_FILE_VERSION, savedAt: new Date().toISOString(), ...data };
  return JSON.stringify(file, null, 2);
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const numOr = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const strOr = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
const boolOr = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/** Mescla valores conhecidos sobre os padrões, respeitando o tipo de cada campo. */
function mergeKnown<T extends object>(defaults: T, raw: unknown): T {
  if (!isObj(raw)) return { ...defaults };
  const out = { ...defaults } as Record<string, unknown>;
  for (const [key, def] of Object.entries(defaults)) {
    const v = raw[key];
    if (typeof def === 'number') out[key] = numOr(v, def);
    else if (typeof def === 'string') out[key] = typeof v === 'string' ? v : def;
    else if (typeof def === 'boolean') out[key] = boolOr(v, def);
  }
  return out as T;
}

function parseColumn(raw: unknown): ColumnConfig {
  const c = isObj(raw) ? raw : {};
  const doors = numOr(c.doors, 1);
  return makeColumn({
    ...(typeof c.id === 'string' ? { id: c.id } : {}),
    widthRatio: Math.max(0.1, numOr(c.widthRatio, 1)),
    drawers: Math.max(0, Math.floor(numOr(c.drawers, 0))),
    doors: doors === 0 || doors === 2 ? doors : 1,
    shelves: Math.max(0, Math.floor(numOr(c.shelves, 0))),
    hangingRod: boolOr(c.hangingRod, false),
    drawerPosition: c.drawerPosition === 'bottom' ? 'bottom' : 'top',
    ...(Array.isArray(c.shelfPositions) && c.shelfPositions.every((v) => typeof v === 'number' && Number.isFinite(v))
      ? { shelfPositions: c.shelfPositions as number[] }
      : {}),
  });
}

const PANEL_KINDS = ['estrutura', 'prateleira', 'fundo', 'porta', 'frente', 'gaveta'] as const;
const ORIENTATIONS = ['side', 'front', 'horizontal'] as const;
const edgeCount = (v: unknown): 0 | 1 | 2 => (v === 1 || v === 2 ? v : 0);

function parsePanel(raw: unknown): CustomPanel | null {
  if (!isObj(raw)) return null;
  const kind = PANEL_KINDS.find((k) => k === raw.kind) ?? 'estrutura';
  const orientation = ORIENTATIONS.find((o) => o === raw.orientation) ?? 'side';
  const edge = isObj(raw.edgeBanding) ? raw.edgeBanding : {};
  const dim = (v: unknown, d: number) => Math.max(0, numOr(v, d));
  return {
    id: strOr(raw.id, newPanelId()),
    name: strOr(raw.name, 'Painel'),
    kind,
    orientation,
    width: dim(raw.width, 600),
    height: dim(raw.height, 600),
    depth: dim(raw.depth, 400),
    thickness: Math.max(1, numOr(raw.thickness, 18)),
    x: numOr(raw.x, 0),
    y: numOr(raw.y, 0),
    z: numOr(raw.z, 0),
    edgeBanding: { length: edgeCount(edge.length), width: edgeCount(edge.width) },
    grainLocked: boolOr(raw.grainLocked, kind !== 'fundo'),
  };
}

const ENUMS: Partial<Record<keyof CabinetParams, readonly string[]>> = {
  backMode: ['overlay', 'groove'],
  baseType: ['plinth', 'feet', 'none'],
  topType: ['full', 'rails'],
  assembly: ['screw', 'minifix', 'dowel'],
};

export function parseItem(raw: unknown): ProjectItem | null {
  if (!isObj(raw) || typeof raw.templateId !== 'string' || !(raw.templateId in TEMPLATES)) return null;
  const templateId = raw.templateId as TemplateId;
  const base = {
    id: strOr(raw.id, newItemId()),
    name: strOr(raw.name, TEMPLATES[templateId].name),
    quantity: Math.max(1, Math.floor(numOr(raw.quantity, 1))),
  };
  if (templateId === 'bed') {
    const params = mergeKnown<BedParams>(defaultParamsFor('bed'), raw.params);
    if (!['ripas', 'chapa'].includes(params.deck)) params.deck = 'ripas';
    if (!['screw', 'minifix', 'dowel'].includes(params.assembly)) params.assembly = 'screw';
    return { ...base, templateId, params };
  }
  if (templateId === 'prop') {
    const params = mergeKnown<PropParams>(defaultParamsFor('prop'), raw.params);
    if (!PROP_CATALOG.some((c) => c.type === params.type)) params.type = 'geladeira';
    if (!/^#[0-9a-f]{6}$/i.test(params.color)) params.color = propInfo(params.type).color;
    return { ...base, templateId, params };
  }
  if (isWorkbenchId(templateId)) {
    const params = mergeKnown<WorkbenchParams>(defaultParamsFor(templateId), raw.params);
    if (!['screw', 'minifix', 'dowel'].includes(params.assembly)) params.assembly = 'screw';
    return { ...base, templateId, params };
  }
  if (templateId === 'custom') {
    const rawPanels = isObj(raw.params) && Array.isArray(raw.params.panels) ? raw.params.panels : [];
    const assembly = isObj(raw.params) ? raw.params.assembly : undefined;
    return {
      ...base,
      templateId,
      params: {
        panels: rawPanels.map(parsePanel).filter((p): p is CustomPanel => p !== null),
        assembly: assembly === 'minifix' || assembly === 'dowel' ? assembly : 'screw',
      },
    };
  }
  if (!isCarcassId(templateId)) return null;
  const defaults = defaultParamsFor(templateId);
  const params = mergeKnown<CabinetParams>(defaults, raw.params);
  for (const [key, allowed] of Object.entries(ENUMS) as Array<[keyof CabinetParams, readonly string[]]>) {
    if (!allowed.includes(params[key] as string)) (params as unknown as Obj)[key] = defaults[key];
  }
  const cols = isObj(raw.params) && Array.isArray(raw.params.columns) ? raw.params.columns : null;
  params.columns = cols && cols.length ? cols.map(parseColumn) : defaults.columns;
  return { ...base, templateId, params };
}

function parseMaterials(raw: unknown): Record<MaterialRole, MaterialSpec> {
  const out = structuredClone(DEFAULT_MATERIALS);
  if (!isObj(raw)) return out;
  for (const role of Object.keys(out) as MaterialRole[]) {
    const m = raw[role];
    if (isObj(m)) out[role] = { role, label: strOr(m.label, out[role].label), hasGrain: boolOr(m.hasGrain, out[role].hasGrain) };
  }
  return out;
}

function parsePriceMap(raw: unknown): Record<string, number> {
  if (!isObj(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]) && e[1] >= 0));
}

const WALLS = ['fundo', 'frente', 'esquerda', 'direita'] as const;

function parseRoom(raw: unknown): RoomSettings {
  const base = mergeKnown({ name: DEFAULT_ROOM.name, width: DEFAULT_ROOM.width, depth: DEFAULT_ROOM.depth, height: DEFAULT_ROOM.height }, raw);
  const room: RoomSettings = {
    ...base,
    width: Math.max(500, base.width),
    depth: Math.max(500, base.depth),
    height: Math.max(1000, base.height),
    openings: structuredClone(DEFAULT_ROOM.openings),
  };
  if (isObj(raw) && Array.isArray(raw.openings)) {
    room.openings = raw.openings.filter(isObj).map((o) => ({
      id: strOr(o.id, newOpeningId()),
      kind: o.kind === 'janela' ? 'janela' : 'porta',
      wall: WALLS.find((w) => w === o.wall) ?? 'fundo',
      offset: Math.max(0, numOr(o.offset, 0)),
      width: Math.max(100, numOr(o.width, 800)),
      height: Math.max(100, numOr(o.height, 2100)),
      sill: Math.max(0, numOr(o.sill, 0)),
    }));
  }
  if (isObj(raw)) {
    for (const key of ['wallColor', 'floorColor'] as const) {
      const c = raw[key];
      if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) room[key] = c;
    }
  }
  return room;
}

function parsePlacement(raw: unknown): FurniturePlacement | null {
  if (!isObj(raw) || typeof raw.itemId !== 'string') return null;
  const rotation = [0, 90, 180, 270].includes(raw.rotation as number) ? (raw.rotation as Rotation) : 0;
  return {
    itemId: raw.itemId,
    unit: Math.max(0, Math.floor(numOr(raw.unit, 0))),
    x: numOr(raw.x, 0),
    z: numOr(raw.z, 0),
    rotation,
    elevation: numOr(raw.elevation, 0),
  };
}

export type ParseResult = { ok: true; data: ProjectData } | { ok: false; error: string };

/** Lê o conteúdo de um arquivo de projeto. */
export function parseProjectFile(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' };
  }
  if (!isObj(raw) || raw.app !== PROJECT_FILE_APP) {
    return { ok: false, error: 'Este arquivo não é um projeto do WoodCraft Planner.' };
  }
  if (numOr(raw.version, 0) > PROJECT_FILE_VERSION) {
    return { ok: false, error: 'O projeto foi salvo por uma versão mais nova do WoodCraft Planner.' };
  }
  const items = Array.isArray(raw.items) ? raw.items.map(parseItem).filter((i): i is ProjectItem => i !== null) : [];
  if (!items.length) return { ok: false, error: 'O projeto não tem nenhum móvel válido.' };

  const prices = mergeKnown(DEFAULT_PRICES, raw.prices);
  const rawPrices = isObj(raw.prices) ? raw.prices : {};
  prices.sheetPrices = parsePriceMap(rawPrices.sheetPrices);
  prices.itemPrices = parsePriceMap(rawPrices.itemPrices);

  const itemIds = new Set(items.map((i) => i.id));
  const placements = (Array.isArray(raw.placements) ? raw.placements : [])
    .map(parsePlacement)
    .filter((p): p is FurniturePlacement => p !== null && itemIds.has(p.itemId));

  const sheet = mergeKnown(DEFAULT_SHEET, raw.sheet);
  if (sheet.length < 300 || sheet.width < 300) Object.assign(sheet, DEFAULT_SHEET);

  return {
    ok: true,
    data: {
      projectName: strOr(raw.projectName, 'Projeto'),
      items,
      sheet,
      materials: parseMaterials(raw.materials),
      services: mergeKnown(DEFAULT_SERVICES, raw.services),
      prices,
      room: parseRoom(raw.room),
      placements,
    },
  };
}
