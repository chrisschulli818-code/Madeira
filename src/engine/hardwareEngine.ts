/**
 * Quantitativo de ferragens, fixadores e insumos.
 *
 * Todas as quantidades são estimativas derivadas do `AssembledModel`:
 * - fixadores estruturais a partir das junções (comprimento de cada junção),
 * - corrediças a partir da profundidade interna,
 * - dobradiças a partir da altura de cada porta,
 * - fita de borda a partir da lista de corte (+10% de sobra).
 */
import type { AssembledModel, HardwareItem, MaterialRole, MaterialSpec } from '@/types/woodcraft';
import { BACK_NAIL_SPACING, EDGE_BANDING_WASTE, FASTENER_SPACING } from './constants';
import { edgeBandingMeters } from './cabinetEngine';

/** Sobra de 10% em itens miúdos (parafusos, cavilhas, pregos). */
const withSpare = (n: number) => (n > 0 ? Math.ceil(n * 1.1) : 0);

/** Dobradiças por porta conforme a altura (regra usual de fabricantes). */
export function hingesForDoorHeight(height: number): number {
  if (height <= 900) return 2;
  if (height <= 1500) return 3;
  if (height <= 2000) return 4;
  return 5;
}

/** Parafuso estrutural indicado para a espessura da chapa. */
export function structuralScrewFor(thickness: number): string {
  if (thickness <= 15) return '4,0 × 40 mm';
  if (thickness <= 18) return '4,0 × 50 mm';
  return '5,0 × 60 mm';
}

/** Largura comercial de fita de borda para a espessura da chapa. */
export function edgeBandWidthFor(thickness: number): number {
  if (thickness <= 15) return 19;
  if (thickness <= 18) return 22;
  if (thickness <= 25) return 35;
  return 45;
}

class ItemList {
  private readonly items = new Map<string, HardwareItem>();

  add(item: Omit<HardwareItem, 'id'>): void {
    if (item.quantity <= 0) return;
    const id = `${item.category}:${item.name}:${item.specification}`;
    const existing = this.items.get(id);
    if (existing) {
      existing.quantity = Math.round((existing.quantity + item.quantity) * 10) / 10;
      if (!existing.application.includes(item.application)) existing.application += `; ${item.application}`;
      return;
    }
    this.items.set(id, { ...item, id });
  }

  list(): HardwareItem[] {
    const order = { fixacao: 0, ferragem: 1, acabamento: 2, insumo: 3 } as const;
    return [...this.items.values()].sort((a, b) => order[a.category] - order[b.category]);
  }
}

export function computeHardware(model: AssembledModel, materials: Record<MaterialRole, MaterialSpec>): HardwareItem[] {
  const items = new ItemList();
  const structural = model.pieces.find((p) => p.role === 'side' || p.role === 'leg-panel');
  const T = structural?.thickness ?? 18;

  // --- Fixação estrutural ---------------------------------------------------------
  const carcassJoints = model.joints.filter((j) => !j.bracket && j.label !== 'Canto de gaveta');
  const drawerJoints = model.joints.filter((j) => j.label === 'Canto de gaveta');
  const bracketJoints = model.joints.filter((j) => j.bracket);

  if (model.assembly === 'screw') {
    const screws = carcassJoints.reduce((acc, j) => acc + Math.max(2, Math.ceil(j.length / FASTENER_SPACING)), 0);
    items.add({
      category: 'fixacao',
      name: 'Parafuso chipboard cabeça chata',
      specification: `${structuralScrewFor(T)} (inclui 10% de sobra)`,
      quantity: withSpare(screws),
      unit: 'un',
      application: `Estrutura: ${carcassJoints.length} junções, ~1 a cada ${FASTENER_SPACING} mm`,
    });
    items.add({
      category: 'acabamento',
      name: 'Tapa-furo adesivo',
      specification: 'Ø 13 mm, na cor da chapa',
      quantity: withSpare(screws),
      unit: 'un',
      application: 'Cobrir cabeças de parafuso aparentes',
    });
  } else if (model.assembly === 'minifix') {
    const minifix = carcassJoints.reduce((acc, j) => acc + Math.max(2, Math.round(j.length / 250)), 0);
    items.add({
      category: 'ferragem',
      name: 'Minifix (tambor Ø15 + haste)',
      specification: `Para chapa de ${T} mm`,
      quantity: withSpare(minifix),
      unit: 'un',
      application: `Estrutura: ${carcassJoints.length} junções desmontáveis`,
    });
    items.add({
      category: 'fixacao',
      name: 'Cavilha de madeira estriada',
      specification: '8 × 30 mm',
      quantity: withSpare(minifix),
      unit: 'un',
      application: 'Alinhamento entre minifix',
    });
  } else {
    const dowels = carcassJoints.reduce((acc, j) => acc + Math.max(2, Math.ceil(j.length / 128)), 0);
    items.add({
      category: 'fixacao',
      name: 'Cavilha de madeira estriada',
      specification: '8 × 30 mm',
      quantity: withSpare(dowels),
      unit: 'un',
      application: `Estrutura: ${carcassJoints.length} junções coladas, ~1 a cada 128 mm`,
    });
    items.add({
      category: 'insumo',
      name: 'Cola PVA para madeira',
      specification: 'Frasco 500 g',
      quantity: 1,
      unit: 'un',
      application: 'Colagem das cavilhas',
    });
  }

  if (drawerJoints.length) {
    const screws = drawerJoints.reduce((acc, j) => acc + Math.max(2, Math.ceil(j.length / 100)), 0);
    items.add({
      category: 'fixacao',
      name: 'Parafuso chipboard cabeça chata',
      specification: '3,5 × 40 mm',
      quantity: withSpare(screws),
      unit: 'un',
      application: `Montagem de ${model.drawers.length} caixa(s) de gaveta`,
    });
  }

  // --- Fundo (pregos/grampos) -----------------------------------------------------------
  let nails = model.backPerimeter > 0 ? Math.ceil(model.backPerimeter / BACK_NAIL_SPACING) : 0;
  for (const d of model.drawers) nails += Math.ceil((2 * (d.boxWidth + d.slideLength)) / 100);
  items.add({
    category: 'fixacao',
    name: 'Prego sem cabeça / grampo',
    specification: '12 × 12 mm ou grampo 14 mm',
    quantity: withSpare(nails),
    unit: 'un',
    application: model.drawers.length ? 'Fixação do fundo e dos fundos de gaveta' : 'Fixação do fundo',
  });

  // --- Corrediças --------------------------------------------------------------------
  const bySlide = new Map<number, number>();
  for (const d of model.drawers) bySlide.set(d.slideLength, (bySlide.get(d.slideLength) ?? 0) + 1);
  for (const [length, qty] of bySlide) {
    items.add({
      category: 'ferragem',
      name: 'Corrediça telescópica',
      specification: `${length} mm, carga 30–35 kg`,
      quantity: qty,
      unit: 'par',
      application: `${qty} gaveta(s)`,
    });
  }

  // --- Dobradiças ----------------------------------------------------------------------
  let hingeCount = 0;
  for (const overlay of ['full', 'half'] as const) {
    const doors = model.doors.filter((d) => d.overlay === overlay);
    const qty = doors.reduce((acc, d) => acc + hingesForDoorHeight(d.height), 0);
    hingeCount += qty;
    items.add({
      category: 'ferragem',
      name: overlay === 'full' ? 'Dobradiça caneco 35 mm reta' : 'Dobradiça caneco 35 mm curva',
      specification: `${overlay === 'full' ? 'Sobreposição total' : 'Meia sobreposição (sobre divisória)'}, com amortecedor e calço`,
      quantity: qty,
      unit: 'un',
      application: `${doors.length} porta(s): 2 até 900 mm, 3 até 1500 mm, 4 até 2000 mm`,
    });
  }

  const slidePairs = model.drawers.length;
  const smallScrews = hingeCount * 4 + slidePairs * 12;
  items.add({
    category: 'fixacao',
    name: 'Parafuso chipboard cabeça panela',
    specification: '3,5 × 14 mm',
    quantity: withSpare(smallScrews),
    unit: 'un',
    application: 'Fixação de dobradiças (4/un) e corrediças (12/par)',
  });

  // --- Puxadores e suportes --------------------------------------------------------------
  items.add({
    category: 'ferragem',
    name: 'Puxador',
    specification: 'Furação 128 mm (parafusos M4 inclusos)',
    quantity: model.doors.length + model.drawers.length,
    unit: 'un',
    application: `${model.doors.length} porta(s) + ${model.drawers.length} gaveta(s)`,
  });
  items.add({
    category: 'ferragem',
    name: 'Suporte de prateleira (pino)',
    specification: 'Ø 5 mm metálico',
    quantity: model.adjustableShelves * 4,
    unit: 'un',
    application: `${model.adjustableShelves} prateleira(s) móvel(is), 4 por prateleira`,
  });

  // --- Base, rodapé e fixação na parede ---------------------------------------------------
  const plinth = model.pieces.find((p) => p.role === 'plinth');
  if (plinth) {
    items.add({
      category: 'ferragem',
      name: 'Cantoneira L',
      specification: '25 × 25 mm com parafusos 3,5 × 14',
      quantity: Math.max(2, Math.ceil(plinth.length / 400)),
      unit: 'un',
      application: 'Fixação do rodapé sob a base',
    });
    items.add({
      category: 'ferragem',
      name: 'Calço / sapata niveladora',
      specification: 'Plástico, para laterais apoiadas no piso',
      quantity: 4,
      unit: 'un',
      application: 'Proteção e nivelamento das laterais',
    });
  }
  if (model.baseType === 'feet') {
    const extra = model.overall.width > 1000 ? 2 * Math.ceil((model.overall.width - 1000) / 600) : 0;
    items.add({
      category: 'ferragem',
      name: 'Pé regulável plástico',
      specification: `Altura ${model.layout.plinthHeight} mm (+ regulagem)`,
      quantity: 4 + extra,
      unit: 'un',
      application: 'Apoio da caixa',
    });
  }
  if (model.templateId === 'wall-cabinet') {
    items.add({
      category: 'ferragem',
      name: 'Suspensor para armário aéreo',
      specification: 'Regulável, com trilho de parede',
      quantity: 2,
      unit: 'un',
      application: 'Fixação na parede (1 por lateral)',
    });
    items.add({
      category: 'fixacao',
      name: 'Bucha + parafuso',
      specification: 'Bucha S8 + parafuso 5,5 × 60 mm',
      quantity: 4,
      unit: 'un',
      application: 'Trilho/suspensores na parede',
    });
  }
  if (model.templateId === 'wardrobe' || model.templateId === 'base-cabinet') {
    items.add({
      category: 'ferragem',
      name: 'Cantoneira L',
      specification: '40 × 40 mm metálica',
      quantity: 2,
      unit: 'un',
      application: 'Travamento anti-tombamento na parede',
    });
    items.add({
      category: 'fixacao',
      name: 'Bucha + parafuso',
      specification: 'Bucha S6 + parafuso 4,2 × 45 mm',
      quantity: 2,
      unit: 'un',
      application: 'Cantoneiras na parede',
    });
  }

  // --- Cabideiro ---------------------------------------------------------------------
  if (model.hangingRods.length) {
    const meters = model.hangingRods.reduce((a, b) => a + b, 0) / 1000;
    items.add({
      category: 'ferragem',
      name: 'Tubo oblongo cromado',
      specification: `Cortes: ${model.hangingRods.map((r) => `${r} mm`).join(', ')}`,
      quantity: Math.ceil(meters * 10) / 10,
      unit: 'm',
      application: 'Cabideiro',
    });
    items.add({
      category: 'ferragem',
      name: 'Suporte para tubo oblongo',
      specification: 'Flange lateral com parafusos',
      quantity: model.hangingRods.length * 2,
      unit: 'un',
      application: 'Fixação do cabideiro',
    });
  }

  // --- Cantoneiras de tampo (mesa) -----------------------------------------------------
  if (bracketJoints.length) {
    const brackets = bracketJoints.reduce((acc, j) => acc + Math.max(2, Math.ceil(j.length / 400)), 0);
    items.add({
      category: 'ferragem',
      name: 'Cantoneira L',
      specification: '40 × 40 mm metálica',
      quantity: brackets,
      unit: 'un',
      application: 'Fixação do tampo por baixo',
    });
    items.add({
      category: 'fixacao',
      name: 'Parafuso chipboard cabeça panela',
      specification: '3,5 × 16 mm',
      quantity: withSpare(brackets * 4),
      unit: 'un',
      application: 'Cantoneiras do tampo (4/un)',
    });
    items.add({
      category: 'ferragem',
      name: 'Calço / sapata niveladora',
      specification: 'Rosca M8 com base de feltro',
      quantity: 4,
      unit: 'un',
      application: 'Pés da mesa',
    });
  }

  // --- Fita de borda ----------------------------------------------------------------
  const bands = new Map<string, { label: string; width: number; meters: number }>();
  for (const piece of model.pieces) {
    const meters = edgeBandingMeters(piece);
    if (meters <= 0) continue;
    const label = materials[piece.material].label;
    const width = edgeBandWidthFor(piece.thickness);
    const key = `${label}|${width}`;
    const entry = bands.get(key) ?? { label, width, meters: 0 };
    entry.meters += meters;
    bands.set(key, entry);
  }
  for (const b of bands.values()) {
    items.add({
      category: 'acabamento',
      name: `Fita de borda ${b.width} mm`,
      specification: `${b.label} — ${b.meters.toFixed(1)} m líquidos + ${EDGE_BANDING_WASTE * 100}% de sobra (pré-colada p/ ferro)`,
      quantity: Math.ceil(b.meters * (1 + EDGE_BANDING_WASTE)),
      unit: 'm',
      application: 'Bordas aparentes conforme lista de corte',
    });
  }

  items.add({
    category: 'insumo',
    name: 'Lixa para madeira',
    specification: 'Grãos 120 e 220',
    quantity: 4,
    unit: 'un',
    application: 'Acabamento das bordas após refilar a fita',
  });

  return items.list();
}
