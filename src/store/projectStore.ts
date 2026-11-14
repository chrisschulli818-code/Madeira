/**
 * Estado global do projeto (Zustand).
 *
 * Guarda apenas as ENTRADAS do usuário: móveis do projeto (template + parâmetros),
 * chapa, materiais, serviços e preços. Tudo que é derivado (peças, plano de corte,
 * insumos, ferramentas, orçamento) é recalculado pelos motores puros em
 * `ProjectResultsProvider`, garantindo uma única fonte de verdade.
 * O estado persiste no localStorage.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Annotation,
  BedParams,
  PropParams,
  PropType,
  LibraryEntry,
  FurniturePlacement,
  RoomOpening,
  RoomSettings,
  CabinetParams,
  CustomPanel,
  CustomParams,
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
import { defaultItemParams, isCarcassItem, isWorkbenchItem, makeColumn, TEMPLATES } from '@/engine/templates';
import { propInfo } from '@/engine/propEngine';
import { DEFAULT_PRICES } from '@/engine/budgetEngine';
import { createPanel, newPanelId, type PanelPreset } from '@/engine/customEngine';
import { DEFAULT_ROOM, newOpeningId } from '@/engine/roomEngine';
import {
  createItem,
  DEFAULT_MATERIALS,
  DEFAULT_SERVICES,
  DEFAULT_SHEET,
  newItemId,
  parseItem,
  type ProjectData,
} from '@/engine/projectFile';

export { DEFAULT_MATERIALS, DEFAULT_SHEET };
export type { CarcassTemplateId } from '@/types/woodcraft';

/** Imagem do ambiente montado, gerada a partir de um ponto de vista. */
export interface RoomSnapshot {
  id: string;
  label: string;
  /** PNG em data URL. */
  dataUrl: string;
  width: number;
  height: number;
}

export interface ProjectState extends ProjectData {
  activeItemId: string;
  /** Itens marcados no checklist de ferramentas. */
  toolChecks: Record<string, boolean>;

  // Estado de interação (não persistido)
  selectedPieceId: string | null;
  hoveredPieceId: string | null;
  /** Tela expandida: só o painel de edição e o viewport, sem cabeçalho nem abas de resultados. */
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  /** Tela principal: editar um móvel ou organizar o ambiente. */
  viewMode: 'furniture' | 'room';
  setViewMode: (mode: 'furniture' | 'room') => void;
  selectedPlacement: string | null;
  selectPlacement: (key: string | null) => void;
  /** Imagens geradas do ambiente (só nesta sessão; entram no PDF). */
  snapshots: RoomSnapshot[];
  addSnapshot: (snap: Omit<RoomSnapshot, 'id'>) => void;
  removeSnapshot: (id: string) => void;
  // Ambiente
  setRoom: (patch: Partial<Omit<RoomSettings, 'openings'>>) => void;
  addOpening: (kind: RoomOpening['kind']) => void;
  updateOpening: (id: string, patch: Partial<RoomOpening>) => void;
  removeOpening: (id: string) => void;
  /** Grava a posição de uma unidade de móvel no cômodo. */
  setPlacement: (placement: FurniturePlacement) => void;
  /** Volta todos os móveis para a organização automática. */
  resetPlacements: () => void;
  // Meus móveis (biblioteca pessoal, salva no navegador)
  library: LibraryEntry[];
  /** Salva uma cópia do móvel na biblioteca. */
  saveToLibrary: (itemId: string) => void;
  removeFromLibrary: (entryId: string) => void;
  /** Guarda na biblioteca móveis vindos de um arquivo de projeto. */
  addToLibrary: (items: ProjectItem[]) => number;
  /** Coloca cópias de móveis (da biblioteca ou de um arquivo) no projeto; devolve os novos ids. */
  insertItems: (items: ProjectItem[]) => string[];
  /** Troca o modelo e as medidas do móvel ativo (mantém id e marcações). */
  replaceActiveItem: (item: ProjectItem) => void;

  setProjectName: (name: string) => void;
  // Móveis
  addItem: (templateId: TemplateId) => void;
  duplicateItem: (id: string) => void;
  removeItem: (id: string) => void;
  setActiveItem: (id: string) => void;
  updateItem: (id: string, patch: { name?: string; quantity?: number }) => void;
  /** Substitui um móvel inteiro (usado ao arrastar e encaixar peças). */
  replaceItem: (item: ProjectItem) => void;
  // Parâmetros do móvel ativo
  updateCabinet: (patch: Partial<CabinetParams>) => void;
  updateColumn: (columnId: string, patch: Partial<ColumnConfig>) => void;
  addColumn: () => void;
  removeColumn: (columnId: string) => void;
  updateWorkbench: (patch: Partial<WorkbenchParams>) => void;
  updateBed: (patch: Partial<BedParams>) => void;
  // Marcações do móvel ativo
  /** Cria uma marcação (nota ou medida) no móvel ativo e devolve o id. */
  addAnnotation: (a: Omit<Annotation, 'id'>) => string;
  updateAnnotation: (id: string, patch: Partial<Omit<Annotation, 'id'>>) => void;
  removeAnnotation: (id: string) => void;
  clearAnnotations: () => void;
  updateProp: (patch: Partial<PropParams>) => void;
  /** Coloca um objeto do ambiente (geladeira, sofá...) no projeto; devolve o id. */
  addProp: (type: PropType) => string;
  resetActiveItem: () => void;
  // Móvel livre (painéis)
  /** Cria um painel no móvel livre ativo e devolve o painel criado. */
  addPanel: (preset: PanelPreset) => CustomPanel | null;
  updatePanel: (panelId: string, patch: Partial<CustomPanel>) => void;
  duplicatePanel: (panelId: string) => void;
  removePanel: (panelId: string) => void;
  updateCustom: (patch: Partial<CustomParams>) => void;
  // Configurações do projeto
  setSheet: (patch: Partial<SheetSettings>) => void;
  setMaterial: (role: MaterialRole, patch: Partial<MaterialSpec>) => void;
  setServices: (patch: Partial<ServiceSettings>) => void;
  setPrices: (patch: Partial<Omit<PriceSettings, 'sheetPrices' | 'itemPrices'>>) => void;
  /** Define (ou remove, com null) o preço de uma chapa ou insumo. */
  setSheetPrice: (materialKey: string, price: number | null) => void;
  setItemPrice: (itemId: string, price: number | null) => void;
  // Arquivo
  loadProject: (data: ProjectData) => void;
  /** Projeto novo: a partir do balcão padrão, ou do zero (móvel livre vazio + tela expandida). */
  newProject: (fromScratch?: boolean) => void;
  toggleTool: (id: string) => void;
  selectPiece: (id: string | null) => void;
  hoverPiece: (id: string | null) => void;
}

function initialProject(fromScratch = false): ProjectData & { activeItemId: string } {
  const item = fromScratch ? createItem('custom', 'Meu móvel') : createItem('base-cabinet');
  return {
    projectName: fromScratch ? 'Projeto do zero' : 'Meu projeto',
    items: [item],
    activeItemId: item.id,
    sheet: DEFAULT_SHEET,
    materials: DEFAULT_MATERIALS,
    services: DEFAULT_SERVICES,
    prices: DEFAULT_PRICES,
    room: structuredClone(DEFAULT_ROOM),
    placements: [],
  };
}

const setPrice = (map: Record<string, number>, key: string, price: number | null) => {
  const next = { ...map };
  if (price === null || !Number.isFinite(price)) delete next[key];
  else next[key] = Math.max(0, price);
  return next;
};

/** Nome único para um móvel novo ("Balcão inferior 2"...). */
function uniqueName(items: ProjectItem[], base: string) {
  const names = new Set(items.map((i) => i.name));
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => {
      const patchActive = (fn: (item: ProjectItem) => ProjectItem) =>
        set((s) => ({ items: s.items.map((i) => (i.id === s.activeItemId ? fn(i) : i)) }));
      /** Aplica uma alteração nos parâmetros do móvel ativo, se for de caixa. */
      const patchCabinet = (fn: (p: CabinetParams) => CabinetParams) =>
        patchActive((i) => (isCarcassItem(i) ? { ...i, params: fn(i.params) } : i));
      /** Aplica uma alteração nos painéis do móvel livre ativo. */
      const patchCustom = (fn: (p: CustomParams) => CustomParams) =>
        patchActive((i) => (i.templateId === 'custom' ? { ...i, params: fn(i.params) } : i));

      return {
        ...initialProject(),
        toolChecks: {},
        selectedPieceId: null,
        hoveredPieceId: null,
        expanded: false,
        viewMode: 'furniture',
        selectedPlacement: null,
        snapshots: [],
        addSnapshot: (snap) => set((st) => ({ snapshots: [...st.snapshots, { ...snap, id: `img-${Date.now().toString(36)}-${st.snapshots.length}` }] })),
        removeSnapshot: (id) => set((st) => ({ snapshots: st.snapshots.filter((x) => x.id !== id) })),

        setViewMode: (viewMode) => set({ viewMode, selectedPieceId: null, hoveredPieceId: null }),
        // Selecionar um móvel no ambiente também o torna o móvel ativo (para editar ali mesmo).
        selectPlacement: (selectedPlacement) =>
          set((s) => {
            const itemId = selectedPlacement?.split('#')[0];
            return itemId && s.items.some((i) => i.id === itemId)
              ? { selectedPlacement, activeItemId: itemId }
              : { selectedPlacement };
          }),
        setRoom: (patch) => set((s) => ({ room: { ...s.room, ...patch } })),
        addOpening: (kind) =>
          set((s) => ({
            room: {
              ...s.room,
              openings: [
                ...s.room.openings,
                kind === 'porta'
                  ? { id: newOpeningId(), kind, wall: 'frente', offset: 200, width: 800, height: 2100, sill: 0 }
                  : { id: newOpeningId(), kind, wall: 'fundo', offset: Math.max(0, s.room.width / 2 - 600), width: 1200, height: 1000, sill: 1100 },
              ],
            },
          })),
        updateOpening: (id, patch) =>
          set((s) => ({ room: { ...s.room, openings: s.room.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) } })),
        removeOpening: (id) => set((s) => ({ room: { ...s.room, openings: s.room.openings.filter((o) => o.id !== id) } })),
        setPlacement: (placement) =>
          set((s) => {
            const others = s.placements.filter((p) => !(p.itemId === placement.itemId && p.unit === placement.unit));
            return { placements: [...others, placement] };
          }),
        resetPlacements: () => set({ placements: [] }),

        library: [],
        saveToLibrary: (itemId) =>
          set((s) => {
            const item = s.items.find((i) => i.id === itemId);
            if (!item) return {};
            const entry: LibraryEntry = { id: newItemId(), savedAt: new Date().toISOString(), item: { ...structuredClone(item), quantity: 1 } };
            // Mesmo nome já salvo: substitui pela versão atual.
            return { library: [entry, ...s.library.filter((e) => e.item.name !== item.name)] };
          }),
        removeFromLibrary: (entryId) => set((s) => ({ library: s.library.filter((e) => e.id !== entryId) })),
        addToLibrary: (items) => {
          const entries = items.map((item): LibraryEntry => ({ id: newItemId(), savedAt: new Date().toISOString(), item: { ...structuredClone(item), quantity: 1 } }));
          set((s) => ({ library: [...entries, ...s.library] }));
          return entries.length;
        },
        replaceActiveItem: (next) =>
          patchActive((i) => ({ ...structuredClone(next), id: i.id, notes: i.notes }) as ProjectItem),
        insertItems: (source) => {
          const ids: string[] = [];
          set((s) => {
            const items = [...s.items];
            for (const original of source) {
              const copy = { ...structuredClone(original), id: newItemId(), name: uniqueName(items, original.name) } as ProjectItem;
              items.push(copy);
              ids.push(copy.id);
            }
            return ids.length
              ? { items, activeItemId: ids[0]!, selectedPlacement: s.viewMode === 'room' ? `${ids[0]}#0` : s.selectedPlacement }
              : {};
          });
          return ids;
        },

        setProjectName: (projectName) => set({ projectName }),

        addItem: (templateId) =>
          set((s) => {
            const item = createItem(templateId, uniqueName(s.items, TEMPLATES[templateId].name));
            return {
              items: [...s.items, item],
              activeItemId: item.id,
              selectedPieceId: null,
              // No ambiente, o móvel novo já fica selecionado para posicionar e editar.
              selectedPlacement: s.viewMode === 'room' ? `${item.id}#0` : s.selectedPlacement,
            };
          }),
        duplicateItem: (id) =>
          set((s) => {
            const source = s.items.find((i) => i.id === id);
            if (!source) return {};
            const copy = { ...structuredClone(source), id: newItemId(), name: uniqueName(s.items, `${source.name} (cópia)`) };
            const at = s.items.indexOf(source) + 1;
            return { items: [...s.items.slice(0, at), copy, ...s.items.slice(at)], activeItemId: copy.id };
          }),
        removeItem: (id) =>
          set((s) => {
            if (s.items.length <= 1) return {};
            const items = s.items.filter((i) => i.id !== id);
            return {
              items,
              placements: s.placements.filter((p) => p.itemId !== id),
              activeItemId: s.activeItemId === id ? items[0]!.id : s.activeItemId,
              selectedPieceId: null,
            };
          }),
        setActiveItem: (activeItemId) => set({ activeItemId, selectedPieceId: null, hoveredPieceId: null }),
        updateItem: (id, patch) =>
          set((s) => ({
            items: s.items.map((i) =>
              i.id === id
                ? { ...i, ...patch, quantity: patch.quantity !== undefined ? Math.max(1, Math.floor(patch.quantity)) : i.quantity }
                : i,
            ),
          })),

        replaceItem: (item) =>
          set((s) => {
            const current = s.items.find((i) => i.id === item.id);
            if (!current || current === item || JSON.stringify(current.params) === JSON.stringify(item.params)) return {};
            return { items: s.items.map((i) => (i.id === item.id ? item : i)) };
          }),

        updateCabinet: (patch) => patchCabinet((p) => ({ ...p, ...patch })),
        updateColumn: (columnId, patch) =>
          patchCabinet((p) => ({
            ...p,
            columns: p.columns.map((c) => {
              if (c.id !== columnId) return c;
              const next = { ...c, ...patch };
              // Mudou a quantidade de prateleiras: volta a distribuir automaticamente.
              if (patch.shelves !== undefined && patch.shelves !== c.shelves) delete next.shelfPositions;
              return next;
            }),
          })),
        addColumn: () => patchCabinet((p) => ({ ...p, columns: [...p.columns, makeColumn({ doors: 1, shelves: 1 })] })),
        removeColumn: (columnId) =>
          patchCabinet((p) => (p.columns.length <= 1 ? p : { ...p, columns: p.columns.filter((c) => c.id !== columnId) })),
        updateWorkbench: (patch) => patchActive((i) => (isWorkbenchItem(i) ? { ...i, params: { ...i.params, ...patch } } : i)),
        addAnnotation: (a) => {
          const id = `mk${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
          patchActive((i) => ({ ...i, notes: [...(i.notes ?? []), { ...a, id }] }));
          return id;
        },
        updateAnnotation: (id, patch) => patchActive((i) => ({ ...i, notes: (i.notes ?? []).map((n) => (n.id === id ? { ...n, ...patch } : n)) })),
        removeAnnotation: (id) => patchActive((i) => ({ ...i, notes: (i.notes ?? []).filter((n) => n.id !== id) })),
        clearAnnotations: () => patchActive((i) => ({ ...i, notes: [] })),
        updateBed: (patch) => patchActive((i) => (i.templateId === 'bed' ? { ...i, params: { ...i.params, ...patch } } : i)),
        updateProp: (patch) => patchActive((i) => (i.templateId === 'prop' ? { ...i, params: { ...i.params, ...patch } } : i)),
        addProp: (type) => {
          const info = propInfo(type);
          let id = '';
          set((s) => {
            const item = { ...createItem('prop', uniqueName(s.items, info.label)), params: { type, width: info.width, height: info.height, depth: info.depth, color: info.color } } as ProjectItem;
            id = item.id;
            return {
              items: [...s.items, item],
              activeItemId: item.id,
              selectedPlacement: s.viewMode === 'room' ? `${item.id}#0` : s.selectedPlacement,
            };
          });
          return id;
        },
        resetActiveItem: () =>
          patchActive((i) => {
            // Objetos mantêm o tipo; voltam às medidas padrão do catálogo.
            if (i.templateId === 'prop') {
              const info = propInfo(i.params.type);
              return { ...i, params: { type: info.type, width: info.width, height: info.height, depth: info.depth, color: info.color } };
            }
            return { ...i, ...defaultItemParams(i.templateId) } as ProjectItem;
          }),

        addPanel: (preset) => {
          let created: CustomPanel | null = null;
          patchCustom((p) => {
            created = createPanel(preset, p.panels);
            return { ...p, panels: [...p.panels, created] };
          });
          return created;
        },
        updatePanel: (panelId, patch) =>
          patchCustom((p) => ({ ...p, panels: p.panels.map((panel) => (panel.id === panelId ? { ...panel, ...patch } : panel)) })),
        duplicatePanel: (panelId) =>
          patchCustom((p) => {
            const source = p.panels.find((panel) => panel.id === panelId);
            if (!source) return p;
            // A cópia é deslocada para o lado, no eixo da espessura, para não ficar sobreposta.
            const offset = source.thickness + 50;
            const copy: CustomPanel = {
              ...structuredClone(source),
              id: newPanelId(),
              name: `${source.name} (cópia)`,
              x: source.orientation === 'side' ? source.x + offset : source.x,
              y: source.orientation === 'horizontal' ? source.y + offset : source.y,
              z: source.orientation === 'front' ? source.z + offset : source.z,
            };
            return { ...p, panels: [...p.panels, copy] };
          }),
        removePanel: (panelId) => patchCustom((p) => ({ ...p, panels: p.panels.filter((panel) => panel.id !== panelId) })),
        updateCustom: (patch) => patchCustom((p) => ({ ...p, ...patch })),

        setSheet: (patch) => set((s) => ({ sheet: { ...s.sheet, ...patch } })),
        setMaterial: (role, patch) => set((s) => ({ materials: { ...s.materials, [role]: { ...s.materials[role], ...patch } } })),
        setServices: (patch) => set((s) => ({ services: { ...s.services, ...patch } })),
        setPrices: (patch) => set((s) => ({ prices: { ...s.prices, ...patch } })),
        setSheetPrice: (key, price) => set((s) => ({ prices: { ...s.prices, sheetPrices: setPrice(s.prices.sheetPrices, key, price) } })),
        setItemPrice: (key, price) => set((s) => ({ prices: { ...s.prices, itemPrices: setPrice(s.prices.itemPrices, key, price) } })),

        loadProject: (data) =>
          set({ ...data, activeItemId: data.items[0]!.id, toolChecks: {}, selectedPieceId: null, hoveredPieceId: null }),
        newProject: (fromScratch = false) =>
          set({ ...initialProject(fromScratch), toolChecks: {}, selectedPieceId: null, hoveredPieceId: null, expanded: fromScratch }),
        setExpanded: (expanded) => set({ expanded }),
        toggleTool: (id) => set((s) => ({ toolChecks: { ...s.toolChecks, [id]: !s.toolChecks[id] } })),
        selectPiece: (selectedPieceId) => set({ selectedPieceId }),
        hoverPiece: (hoveredPieceId) => set({ hoveredPieceId }),
      };
    },
    {
      name: 'woodcraft-planner:v1',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ selectedPieceId: _s, hoveredPieceId: _h, expanded: _e, viewMode: _v, selectedPlacement: _p, snapshots: _i, ...rest }) => rest,
      migrate: (persisted, version) => migrateState(persisted, version) as unknown as ProjectState,
    },
  ),
);

/**
 * Migra o estado salvo da versão 1 (um móvel por vez, parâmetros por template)
 * para a versão 2 (lista de móveis).
 */
export function migrateState(persisted: unknown, version: number): Partial<ProjectState> {
  const s = (persisted ?? {}) as Record<string, unknown>;
  if (version >= 2) return s as Partial<ProjectState>;
  const templateId = (typeof s.templateId === 'string' && s.templateId in TEMPLATES ? s.templateId : 'base-cabinet') as TemplateId;
  const params =
    templateId === 'workbench'
      ? s.workbenchParams
      : (s.cabinetParams as Record<string, unknown> | undefined)?.[templateId];
  const item = parseItem({ templateId, params, name: TEMPLATES[templateId].name, quantity: 1 }) ?? createItem(templateId);
  const { templateId: _t, cabinetParams: _c, workbenchParams: _w, ...rest } = s;
  return {
    ...(rest as Partial<ProjectState>),
    projectName: typeof s.projectName === 'string' ? s.projectName : 'Meu projeto',
    items: [item],
    activeItemId: item.id,
    prices: DEFAULT_PRICES,
  };
}

/** Móvel ativo (sempre existe). */
export const useActiveItem = () =>
  useProjectStore((s) => s.items.find((i) => i.id === s.activeItemId) ?? s.items[0]!);
