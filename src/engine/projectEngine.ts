/**
 * Agregação de um projeto com vários móveis.
 *
 * Cada móvel é calculado pelo `cabinetEngine`; aqui os resultados são combinados:
 * - ids das peças ganham o prefixo do móvel (`<itemId>/<pieceId>`) para serem únicos no projeto,
 * - a lista de corte multiplica as quantidades pela quantidade de móveis iguais,
 * - o plano de corte usa as peças de TODOS os móveis (dividem as mesmas chapas),
 * - ferragens e ferramentas são somadas/unidas.
 */
import type {
  AssembledModel,
  HardwareItem,
  MaterialRole,
  MaterialSpec,
  ProjectItem,
  ProjectPiece,
  ServiceSettings,
  ToolRequirement,
} from '@/types/woodcraft';
import { buildModel } from './cabinetEngine';
import { computeHardware, consumableItems, mergeHardware } from './hardwareEngine';
import { computeTools, mergeTools } from './toolsEngine';

export interface ItemResult {
  item: ProjectItem;
  model: AssembledModel;
}

/** Calcula o modelo de um móvel com ids de peça únicos no projeto. */
export function buildItemModel(item: ProjectItem): AssembledModel {
  const model = buildModel(item.templateId === 'workbench' ? { templateId: item.templateId, params: item.params } : { templateId: item.templateId, params: item.params });
  const prefix = (id: string) => `${item.id}/${id}`;
  return {
    ...model,
    pieces: model.pieces.map((p) => ({ ...p, id: prefix(p.id) })),
    doors: model.doors.map((d) => ({ ...d, pieceId: d.pieceId ? prefix(d.pieceId) : '' })),
  };
}

export function buildItemResults(items: ProjectItem[]): ItemResult[] {
  return items.map((item) => ({ item, model: buildItemModel(item) }));
}

const qty = (item: ProjectItem) => Math.max(1, Math.floor(item.quantity || 1));

/** Lista de corte do projeto: peças de todos os móveis, com quantidades multiplicadas. */
export function projectPieces(results: ItemResult[]): ProjectPiece[] {
  return results.flatMap(({ item, model }) =>
    model.pieces.map((p) => ({ ...p, quantity: p.quantity * qty(item), itemId: item.id, itemName: item.name })),
  );
}

/** Insumos do projeto (fita de borda, lixa e cola calculadas uma vez sobre o total). */
export function projectHardware(
  results: ItemResult[],
  pieces: ProjectPiece[],
  materials: Record<MaterialRole, MaterialSpec>,
): HardwareItem[] {
  const perItem = results.map(({ item, model }) => ({
    items: computeHardware(model, materials, { includeConsumables: false }),
    quantity: qty(item),
    label: item.name,
  }));
  const needsGlue = results.some(({ model }) => model.assembly === 'dowel');
  const consumables = consumableItems(pieces, materials, needsGlue).map((c) => ({ ...c, id: `${c.category}:${c.name}:${c.specification}` }));
  return mergeHardware([...perItem, { items: consumables, quantity: 1 }]);
}

export function projectTools(results: ItemResult[], services: ServiceSettings): ToolRequirement[] {
  return mergeTools(results.map(({ model }) => computeTools(model, services)));
}
