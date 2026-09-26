/**
 * Estado global do projeto (Zustand).
 *
 * Guarda apenas as ENTRADAS do usuário (template, parâmetros, chapa, materiais, serviços).
 * Tudo que é derivado (peças, plano de corte, ferragens, ferramentas) é recalculado
 * pelos motores puros em `useProjectResults`, garantindo uma única fonte de verdade.
 * O estado persiste no localStorage.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  CabinetParams,
  ColumnConfig,
  MaterialRole,
  MaterialSpec,
  SheetSettings,
  TemplateId,
  WorkbenchParams,
} from '@/types/woodcraft';
import { defaultParamsFor, makeColumn } from '@/engine/templates';

export type CarcassTemplateId = Exclude<TemplateId, 'workbench'>;

export interface ServiceSettings {
  outsourcedCutting: boolean;
  outsourcedEdgeBanding: boolean;
}

export interface ProjectState {
  projectName: string;
  templateId: TemplateId;
  cabinetParams: Record<CarcassTemplateId, CabinetParams>;
  workbenchParams: WorkbenchParams;
  sheet: SheetSettings;
  materials: Record<MaterialRole, MaterialSpec>;
  services: ServiceSettings;
  /** Itens marcados no checklist de ferramentas. */
  toolChecks: Record<string, boolean>;

  // Estado de interação (não persistido)
  selectedPieceId: string | null;
  hoveredPieceId: string | null;

  setProjectName: (name: string) => void;
  setTemplate: (id: TemplateId) => void;
  updateCabinet: (patch: Partial<CabinetParams>) => void;
  updateColumn: (columnId: string, patch: Partial<ColumnConfig>) => void;
  addColumn: () => void;
  removeColumn: (columnId: string) => void;
  updateWorkbench: (patch: Partial<WorkbenchParams>) => void;
  resetTemplate: () => void;
  setSheet: (patch: Partial<SheetSettings>) => void;
  setMaterial: (role: MaterialRole, patch: Partial<MaterialSpec>) => void;
  setServices: (patch: Partial<ServiceSettings>) => void;
  toggleTool: (id: string) => void;
  selectPiece: (id: string | null) => void;
  hoverPiece: (id: string | null) => void;
}

export const DEFAULT_SHEET: SheetSettings = { length: 2750, width: 1830, kerf: 4, trim: 10 };

export const DEFAULT_MATERIALS: Record<MaterialRole, MaterialSpec> = {
  carcass: { role: 'carcass', label: 'MDF Branco TX', hasGrain: false },
  front: { role: 'front', label: 'MDF Branco TX', hasGrain: false },
  back: { role: 'back', label: 'HDF Branco', hasGrain: false },
  drawer: { role: 'drawer', label: 'MDF Branco TX', hasGrain: false },
};

const isCarcass = (id: TemplateId): id is CarcassTemplateId => id !== 'workbench';

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => {
      /** Aplica uma alteração nos parâmetros do template de caixa ativo. */
      const patchCabinet = (fn: (p: CabinetParams) => CabinetParams) => {
        const id = get().templateId;
        if (!isCarcass(id)) return;
        set((s) => ({ cabinetParams: { ...s.cabinetParams, [id]: fn(s.cabinetParams[id]) } }));
      };

      return {
        projectName: 'Meu móvel',
        templateId: 'base-cabinet',
        cabinetParams: {
          'base-cabinet': defaultParamsFor('base-cabinet'),
          'wall-cabinet': defaultParamsFor('wall-cabinet'),
          wardrobe: defaultParamsFor('wardrobe'),
        },
        workbenchParams: defaultParamsFor('workbench'),
        sheet: DEFAULT_SHEET,
        materials: DEFAULT_MATERIALS,
        services: { outsourcedCutting: true, outsourcedEdgeBanding: false },
        toolChecks: {},
        selectedPieceId: null,
        hoveredPieceId: null,

        setProjectName: (projectName) => set({ projectName }),
        setTemplate: (templateId) => set({ templateId, selectedPieceId: null, hoveredPieceId: null }),
        updateCabinet: (patch) => patchCabinet((p) => ({ ...p, ...patch })),
        updateColumn: (columnId, patch) =>
          patchCabinet((p) => ({ ...p, columns: p.columns.map((c) => (c.id === columnId ? { ...c, ...patch } : c)) })),
        addColumn: () => patchCabinet((p) => ({ ...p, columns: [...p.columns, makeColumn({ doors: 1, shelves: 1 })] })),
        removeColumn: (columnId) =>
          patchCabinet((p) => (p.columns.length <= 1 ? p : { ...p, columns: p.columns.filter((c) => c.id !== columnId) })),
        updateWorkbench: (patch) => set((s) => ({ workbenchParams: { ...s.workbenchParams, ...patch } })),
        resetTemplate: () => {
          const id = get().templateId;
          if (isCarcass(id)) set((s) => ({ cabinetParams: { ...s.cabinetParams, [id]: defaultParamsFor(id) } }));
          else set({ workbenchParams: defaultParamsFor('workbench') });
        },
        setSheet: (patch) => set((s) => ({ sheet: { ...s.sheet, ...patch } })),
        setMaterial: (role, patch) => set((s) => ({ materials: { ...s.materials, [role]: { ...s.materials[role], ...patch } } })),
        setServices: (patch) => set((s) => ({ services: { ...s.services, ...patch } })),
        toggleTool: (id) => set((s) => ({ toolChecks: { ...s.toolChecks, [id]: !s.toolChecks[id] } })),
        selectPiece: (selectedPieceId) => set({ selectedPieceId }),
        hoverPiece: (hoveredPieceId) => set({ hoveredPieceId }),
      };
    },
    {
      name: 'woodcraft-planner:v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ selectedPieceId: _s, hoveredPieceId: _h, ...rest }) => rest,
    },
  ),
);

/** Seletor de conveniência: parâmetros do template de caixa ativo (ou null na mesa). */
export const useActiveCabinetParams = () =>
  useProjectStore((s) => (isCarcass(s.templateId) ? s.cabinetParams[s.templateId] : null));
