/**
 * Resultados derivados do projeto, calculados UMA vez e compartilhados via contexto.
 *
 * Cada etapa é memoizada separadamente (modelos → peças → plano de corte → insumos → orçamento),
 * e `useDeferredValue` mantém sliders fluidos: o recálculo mais pesado (nesting) acompanha
 * em segundo plano enquanto a lista de corte e o 3D respondem imediatamente.
 */
import { createContext, useContext, useDeferredValue, useMemo, type ReactNode } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { planCutting } from '@/engine/nestingEngine';
import { buildItemResults, projectHardware, projectPieces, projectTools, type ItemResult } from '@/engine/projectEngine';
import { computeBudget } from '@/engine/budgetEngine';
import { connectorHardware, moduleConnections, resolvePlacements, roomWarnings, type ModuleConnection } from '@/engine/roomEngine';
import { mergeHardware } from '@/engine/hardwareEngine';
import { computeJoinery } from '@/engine/joineryEngine';
import type {
  AssembledModel,
  Budget,
  HardwareItem,
  JoineryPlan,
  MaterialRole,
  MaterialSpec,
  NestingResult,
  ProjectPiece,
  ResolvedPlacement,
  SheetSettings,
  ToolRequirement,
} from '@/types/woodcraft';

export interface ProjectResults {
  /** Todos os móveis do projeto com seus modelos calculados. */
  items: ItemResult[];
  /** Móvel ativo (exibido no viewport e no painel de parâmetros). */
  active: ItemResult;
  /** Atalho para o modelo do móvel ativo. */
  model: AssembledModel;
  /** Lista de corte do projeto inteiro (quantidades × móveis iguais). */
  pieces: ProjectPiece[];
  nesting: NestingResult[];
  hardware: HardwareItem[];
  tools: ToolRequirement[];
  budget: Budget;
  materials: Record<MaterialRole, MaterialSpec>;
  sheet: SheetSettings;
  /** Móveis posicionados no ambiente (automáticos + ajustados pelo usuário). */
  placements: ResolvedPlacement[];
  roomWarnings: string[];
  /** Módulos vizinhos no ambiente que devem ser unidos entre si. */
  connections: ModuleConnection[];
  /** Encaixes, furação e passo a passo do móvel ativo. */
  joinery: JoineryPlan;
}

const ResultsContext = createContext<ProjectResults | null>(null);

export function ProjectResultsProvider({ children }: { children: ReactNode }) {
  const itemsInput = useProjectStore((s) => s.items);
  const activeItemId = useProjectStore((s) => s.activeItemId);
  const sheet = useDeferredValue(useProjectStore((s) => s.sheet));
  const materials = useProjectStore((s) => s.materials);
  const services = useProjectStore((s) => s.services);
  const prices = useProjectStore((s) => s.prices);
  const room = useProjectStore((s) => s.room);
  const savedPlacements = useProjectStore((s) => s.placements);

  const items = useMemo(() => buildItemResults(itemsInput), [itemsInput]);
  const pieces = useMemo(() => projectPieces(items), [items]);
  const deferredPieces = useDeferredValue(pieces);
  const nesting = useMemo(() => planCutting(deferredPieces, materials, sheet), [deferredPieces, materials, sheet]);
  const tools = useMemo(() => projectTools(items, services), [items, services]);
  const placements = useMemo(() => resolvePlacements(items, room, savedPlacements), [items, room, savedPlacements]);
  const warnings = useMemo(() => roomWarnings(placements, room), [placements, room]);
  const connections = useMemo(() => moduleConnections(placements), [placements]);
  // Ferragens dos móveis + parafusos de união entre módulos vizinhos no ambiente.
  const hardware = useMemo(
    () => mergeHardware([{ items: projectHardware(items, pieces, materials), quantity: 1 }, { items: connectorHardware(connections), quantity: 1 }]),
    [items, pieces, materials, connections],
  );
  const budget = useMemo(() => computeBudget(nesting, hardware, services, prices), [nesting, hardware, services, prices]);

  const active = items.find((r) => r.item.id === activeItemId) ?? items[0]!;
  const joinery = useMemo(() => computeJoinery(active.model), [active.model]);

  const value = useMemo(
    () => ({ items, active, model: active.model, pieces, nesting, hardware, tools, budget, materials, sheet, placements, roomWarnings: warnings, connections, joinery }),
    [items, active, pieces, nesting, hardware, tools, budget, materials, sheet, placements, warnings, connections, joinery],
  );

  return <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>;
}

export function useResults(): ProjectResults {
  const ctx = useContext(ResultsContext);
  if (!ctx) throw new Error('useResults deve ser usado dentro de <ProjectResultsProvider>');
  return ctx;
}
