/**
 * Resultados derivados do projeto, calculados UMA vez e compartilhados via contexto.
 *
 * `useDeferredValue` mantém sliders fluidos: o recálculo mais pesado (nesting) acompanha
 * em segundo plano enquanto a lista de corte e o 3D respondem imediatamente.
 */
import { createContext, useContext, useDeferredValue, useMemo, type ReactNode } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { buildModel, type ModelInput } from '@/engine/cabinetEngine';
import { planCutting } from '@/engine/nestingEngine';
import { computeHardware } from '@/engine/hardwareEngine';
import { computeTools } from '@/engine/toolsEngine';
import type {
  AssembledModel,
  HardwareItem,
  MaterialRole,
  MaterialSpec,
  NestingResult,
  SheetSettings,
  ToolRequirement,
} from '@/types/woodcraft';

export interface ProjectResults {
  model: AssembledModel;
  nesting: NestingResult[];
  hardware: HardwareItem[];
  tools: ToolRequirement[];
  materials: Record<MaterialRole, MaterialSpec>;
  sheet: SheetSettings;
}

const ResultsContext = createContext<ProjectResults | null>(null);

export function ProjectResultsProvider({ children }: { children: ReactNode }) {
  const templateId = useProjectStore((s) => s.templateId);
  const cabinetParams = useProjectStore((s) => s.cabinetParams);
  const workbenchParams = useProjectStore((s) => s.workbenchParams);
  const sheet = useDeferredValue(useProjectStore((s) => s.sheet));
  const materials = useProjectStore((s) => s.materials);
  const services = useProjectStore((s) => s.services);

  const input: ModelInput = useMemo(
    () =>
      templateId === 'workbench'
        ? { templateId, params: workbenchParams }
        : { templateId, params: cabinetParams[templateId] },
    [templateId, cabinetParams, workbenchParams],
  );

  const model = useMemo(() => buildModel(input), [input]);
  const deferredModel = useDeferredValue(model);
  const nesting = useMemo(() => planCutting(deferredModel.pieces, materials, sheet), [deferredModel, materials, sheet]);
  const hardware = useMemo(() => computeHardware(model, materials), [model, materials]);
  const tools = useMemo(() => computeTools(model, services), [model, services]);

  const value = useMemo(
    () => ({ model, nesting, hardware, tools, materials, sheet }),
    [model, nesting, hardware, tools, materials, sheet],
  );
  return <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>;
}

export function useResults(): ProjectResults {
  const ctx = useContext(ResultsContext);
  if (!ctx) throw new Error('useResults deve ser usado dentro de <ProjectResultsProvider>');
  return ctx;
}
