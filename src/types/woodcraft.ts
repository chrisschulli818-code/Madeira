/**
 * Tipos centrais do WoodCraft Planner.
 *
 * Convenções de unidades e eixos (valem para todo o projeto):
 * - Todas as medidas são em milímetros (mm).
 * - Eixo X: largura (esquerda → direita), Y: altura (chão → cima),
 *   Z: profundidade (fundo/parede → frente). A face frontal da caixa fica em z = depth.
 * - Em uma peça, `length` (comprimento) é SEMPRE a dimensão no sentido do veio,
 *   e `width` (largura) a dimensão perpendicular. Isso é o que a madeireira espera.
 */

// ---------------------------------------------------------------------------
// Parâmetros de projeto
// ---------------------------------------------------------------------------

/** Templates de móveis de caixa (laterais, base, tampo, vãos). */
export type CarcassTemplateId = 'base-cabinet' | 'wall-cabinet' | 'wardrobe';
/** `custom` = móvel livre, montado peça por peça a partir do zero. */
export type TemplateId = CarcassTemplateId | 'workbench' | 'custom';

/** Tipo de montagem estrutural da caixa. */
export type AssemblyMethod = 'screw' | 'minifix' | 'dowel';

/** Como o fundo é fixado na caixa. */
export type BackMode =
  /** Fundo sobreposto, pregado/grampeado na traseira da caixa. */
  | 'overlay'
  /** Fundo encaixado em rasgo (canal) usinado nas laterais, base e tampo. */
  | 'groove';

/** Como a caixa se apoia no chão. */
export type BaseType =
  /** Laterais até o chão com rodapé frontal recuado. */
  | 'plinth'
  /** Caixa suspensa sobre pés reguláveis plásticos. */
  | 'feet'
  /** Sem rodapé (armário aéreo, módulo sobre bancada). */
  | 'none';

/** Tampo da caixa: painel inteiro ou duas travessas (padrão em balcões com pedra/tampo solto). */
export type TopType = 'full' | 'rails';

/**
 * Configuração de um vão (coluna) da caixa. As colunas são separadas por divisórias verticais.
 * Uma coluna pode ter gavetas (em cima ou embaixo), portas e prateleiras móveis na região das portas.
 */
export interface ColumnConfig {
  id: string;
  /** Peso relativo da largura do vão (1 = igual aos demais). */
  widthRatio: number;
  /** Quantidade de gavetas empilhadas. */
  drawers: number;
  /**
   * Posição do gaveteiro quando o vão também tem porta: no topo (padrão de cozinha)
   * ou embaixo (gaveteiro interno de guarda-roupa, balcão com porta em cima).
   * Opcional para compatibilidade com projetos salvos antes deste campo (= 'top').
   */
  drawerPosition?: 'top' | 'bottom';
  /** Folhas de porta: 0 (vão aberto/sem porta), 1 ou 2. */
  doors: 0 | 1 | 2;
  /** Prateleiras móveis na região das portas (ou do vão aberto). */
  shelves: number;
  /** Cabideiro (tubo oblongo) — usado em guarda-roupas. */
  hangingRod: boolean;
}

/** Parâmetros globais de um móvel de caixa (balcão, aéreo, guarda-roupa). */
export interface CabinetParams {
  width: number;
  height: number;
  depth: number;
  /** Espessura da chapa da caixa (laterais, base, tampo, divisórias). */
  carcassThickness: number;
  /** Espessura do fundo. */
  backThickness: number;
  /** Espessura das frentes (portas e frentes de gaveta). */
  frontThickness: number;
  /** Espessura da chapa da caixa de gaveta. */
  drawerBoxThickness: number;
  backMode: BackMode;
  baseType: BaseType;
  /** Altura do rodapé ou dos pés reguláveis. */
  plinthHeight: number;
  /** Recuo do rodapé em relação à frente da caixa. */
  plinthSetback: number;
  topType: TopType;
  /** Altura da frente de cada gaveta quando o vão mistura gavetas e porta. */
  drawerFrontHeight: number;
  /** Folga entre frentes (portas/gavetas), tipicamente 2–3 mm. */
  frontGap: number;
  assembly: AssemblyMethod;
  columns: ColumnConfig[];
}

/** Parâmetros da mesa de trabalho (tampo apoiado em dois painéis laterais). */
export interface WorkbenchParams {
  width: number;
  height: number;
  depth: number;
  /** Espessura do tampo. */
  topThickness: number;
  /** Espessura dos painéis (pés) e travessas. */
  panelThickness: number;
  /** Balanço do tampo além dos painéis nas laterais. */
  sideOverhang: number;
  /** Altura da travessa traseira (saia) que trava a estrutura. */
  apronHeight: number;
  /** Prateleira inferior entre os painéis. */
  lowerShelf: boolean;
  /** Altura da prateleira inferior em relação ao chão. */
  lowerShelfHeight: number;
  assembly: AssemblyMethod;
}

/** Orientação de um painel do móvel livre (qual eixo é a espessura). */
export type PanelOrientation =
  /** Em pé, de lado (como uma lateral): espessura no eixo X. */
  | 'side'
  /** Em pé, de frente (como fundo ou porta): espessura no eixo Z. */
  | 'front'
  /** Deitado (como base, tampo ou prateleira): espessura no eixo Y. */
  | 'horizontal';

/** Função do painel no móvel livre (define material, fita e ferragens). */
export type CustomPanelKind = 'estrutura' | 'prateleira' | 'fundo' | 'porta' | 'frente';

/** Painel do móvel livre, posicionado manualmente. */
export interface CustomPanel {
  id: string;
  name: string;
  kind: CustomPanelKind;
  orientation: PanelOrientation;
  /** Medida no eixo X (ignorada quando a orientação é `side`: vira a espessura). */
  width: number;
  /** Medida no eixo Y (ignorada quando `horizontal`). */
  height: number;
  /** Medida no eixo Z (ignorada quando `front`). */
  depth: number;
  thickness: number;
  /** Canto inferior-esquerdo-traseiro do painel (mm). */
  x: number;
  y: number;
  z: number;
  edgeBanding: EdgeBanding;
  /** Veio travado no comprimento (não gira no plano de corte em chapa amadeirada). */
  grainLocked: boolean;
}

/** Parâmetros do móvel livre: uma lista de painéis posicionados à mão. */
export interface CustomParams {
  panels: CustomPanel[];
  assembly: AssemblyMethod;
}

/** Descrição de um template paramétrico para a interface. */
export interface CabinetTemplate<P = CabinetParams | WorkbenchParams | CustomParams> {
  id: TemplateId;
  name: string;
  description: string;
  kind: 'carcass' | 'workbench' | 'custom';
  defaults: P;
  /** Limites sugeridos para sliders (mm). */
  limits: {
    width: [number, number];
    height: [number, number];
    depth: [number, number];
  };
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

/** Papel funcional da peça (usado para cores, fita de borda e ferragens). */
export type PieceRole =
  | 'side'
  | 'bottom'
  | 'top'
  | 'rail'
  | 'plinth'
  | 'divider'
  | 'fixed-shelf'
  | 'shelf'
  | 'back'
  | 'door'
  | 'drawer-front'
  | 'drawer-side'
  | 'drawer-back'
  | 'drawer-bottom'
  | 'worktop'
  | 'leg-panel'
  | 'apron';

/** Grupo de material — cada grupo vira um conjunto de chapas no plano de corte. */
export type MaterialRole = 'carcass' | 'front' | 'back' | 'drawer';

/** Fita de borda: quantos lados de comprimento (C) e de largura (L) recebem fita (0, 1 ou 2). */
export interface EdgeBanding {
  length: 0 | 1 | 2;
  width: 0 | 1 | 2;
}

/**
 * Orientação do veio: `length` = o veio deve correr ao longo do comprimento da peça
 * (não pode girar em chapas com veio), `free` = pode girar livremente.
 */
export type GrainDirection = 'length' | 'free';

/** Caixa 3D (canto mínimo + dimensões) de uma instância de peça, em mm. */
export interface Box3D {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

/** Peça desmembrada da lista de corte. */
export interface CutPiece {
  id: string;
  name: string;
  role: PieceRole;
  material: MaterialRole;
  quantity: number;
  /** Comprimento no sentido do veio (mm). */
  length: number;
  /** Largura (mm). */
  width: number;
  /** Espessura (mm). */
  thickness: number;
  edgeBanding: EdgeBanding;
  grain: GrainDirection;
  /** Posição de cada unidade no móvel montado (quantity itens). */
  instances: Box3D[];
  notes?: string;
  /** Móvel livre: ids dos painéis que geraram esta linha (para ligar lista, 3D e editor). */
  sourceIds?: string[];
}

// ---------------------------------------------------------------------------
// Modelo montado (saída do motor de cálculo)
// ---------------------------------------------------------------------------

/** Lado da borda em que a dobradiça fica e o tipo de sobreposição resultante. */
export type HingeOverlay = 'full' | 'half';

export interface DoorSpec {
  pieceId: string;
  width: number;
  height: number;
  hingeSide: 'left' | 'right';
  /** full = porta sobre lateral externa (dobradiça reta); half = sobre divisória (curva). */
  overlay: HingeOverlay;
}

export interface DrawerSpec {
  frontWidth: number;
  frontHeight: number;
  boxWidth: number;
  boxHeight: number;
  /** Comprimento comercial da corrediça (mm). */
  slideLength: number;
}

/** Junção estrutural entre duas peças da caixa (define parafusos/minifix/cavilhas). */
export interface Joint {
  label: string;
  /** Comprimento da linha de junção (mm). */
  length: number;
  /** Junção fixada por cantoneiras (ex.: tampo solto de mesa), não pelo método de montagem. */
  bracket?: boolean;
}

export interface AssembledModel {
  templateId: TemplateId;
  overall: { width: number; height: number; depth: number };
  pieces: CutPiece[];
  doors: DoorSpec[];
  drawers: DrawerSpec[];
  joints: Joint[];
  adjustableShelves: number;
  hangingRods: number[];
  /** Perímetro do fundo sobreposto (mm) — para pregos/grampos. */
  backPerimeter: number;
  baseType: BaseType;
  assembly: AssemblyMethod;
  /** Métricas úteis para a exibição de cotas 2D. */
  layout: {
    /** Coordenada X das bordas de cada vão interno [início, fim]. */
    columns: Array<[number, number]>;
    plinthHeight: number;
    internalDepth: number;
  };
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Plano de corte
// ---------------------------------------------------------------------------

export interface SheetSettings {
  /** Comprimento da chapa no sentido do veio (ex.: 2750 mm). */
  length: number;
  /** Largura da chapa (ex.: 1830 mm). */
  width: number;
  /** Espessura do disco de serra (kerf). */
  kerf: number;
  /** Refilo das bordas da chapa (descartado em cada lado). */
  trim: number;
}

export interface MaterialSpec {
  role: MaterialRole;
  /** Nome comercial (ex.: "MDF Branco TX"). Materiais de mesmo nome e espessura dividem chapas. */
  label: string;
  /** Material com veio (amadeirado) impede a rotação das peças. */
  hasGrain: boolean;
}

export interface NestingInputPiece {
  id: string;
  label: string;
  length: number;
  width: number;
  quantity: number;
  canRotate: boolean;
}

export interface Placement {
  pieceId: string;
  label: string;
  instance: number;
  /** Posição no sistema da chapa: x ao longo do comprimento, y ao longo da largura. */
  x: number;
  y: number;
  /** Dimensão ocupada ao longo do comprimento da chapa. */
  w: number;
  /** Dimensão ocupada ao longo da largura da chapa. */
  h: number;
  rotated: boolean;
}

export interface SheetLayout {
  index: number;
  placements: Placement[];
  usedArea: number;
  /** Aproveitamento (0–1) em relação à área útil da chapa (após refilo). */
  utilization: number;
}

export interface NestingResult {
  materialKey: string;
  materialLabel: string;
  thickness: number;
  sheet: SheetSettings;
  sheets: SheetLayout[];
  /** Peças que não cabem na chapa em nenhuma orientação. */
  unplaced: Array<{ pieceId: string; label: string; length: number; width: number }>;
  totalPieceArea: number;
  /** Consumo equivalente em chapas (área de peças / área útil). */
  sheetEquivalent: number;
  /** Aproveitamento global das chapas usadas (0–1). */
  utilization: number;
  strategy: string;
}

// ---------------------------------------------------------------------------
// Insumos e ferramentas
// ---------------------------------------------------------------------------

export type HardwareCategory = 'fixacao' | 'ferragem' | 'acabamento' | 'insumo';

export interface HardwareItem {
  id: string;
  category: HardwareCategory;
  name: string;
  specification: string;
  quantity: number;
  unit: 'un' | 'par' | 'm' | 'tubo' | 'rolo';
  application: string;
}

export type ToolCategory = 'obrigatoria' | 'recomendada';

export interface ToolRequirement {
  id: string;
  name: string;
  category: ToolCategory;
  usage: string;
}

// ---------------------------------------------------------------------------
// Projeto com vários móveis
// ---------------------------------------------------------------------------

interface ProjectItemBase {
  id: string;
  /** Nome dado pelo usuário (ex.: "Balcão da pia"). */
  name: string;
  /** Quantos móveis iguais serão feitos. */
  quantity: number;
}

/** Um móvel do projeto: template + parâmetros próprios. */
export type ProjectItem =
  | (ProjectItemBase & { templateId: 'workbench'; params: WorkbenchParams })
  | (ProjectItemBase & { templateId: 'custom'; params: CustomParams })
  | (ProjectItemBase & { templateId: CarcassTemplateId; params: CabinetParams });

/** Linha da lista de corte do projeto (peça de um móvel, já multiplicada pela quantidade de móveis). */
export interface ProjectPiece extends CutPiece {
  itemId: string;
  itemName: string;
}

export interface ServiceSettings {
  /** Corte das chapas feito pela madeireira (seccionadora). */
  outsourcedCutting: boolean;
  /** Fita de borda aplicada pela madeireira (coladeira industrial). */
  outsourcedEdgeBanding: boolean;
}

// ---------------------------------------------------------------------------
// Orçamento
// ---------------------------------------------------------------------------

export interface PriceSettings {
  /** Preço por chapa, por chave de material (ver `materialKey`). Ausente = preço de referência. */
  sheetPrices: Record<string, number>;
  /** Preço unitário por id de insumo. Ausente = preço de referência. */
  itemPrices: Record<string, number>;
  /** Serviço de corte na madeireira, por chapa. */
  cuttingPerSheet: number;
  /** Serviço de fitagem na madeireira, por metro. */
  edgeBandingPerMeter: number;
  /** Mão de obra (valor fechado). */
  labor: number;
  /** Margem/lucro sobre o custo (%). */
  marginPercent: number;
}

export type BudgetCategory = 'chapas' | 'insumos' | 'servicos' | 'mao-de-obra';

export interface BudgetLine {
  /** Chave usada para editar o preço (sheet:<materialKey>, item:<id>, ou serviço). */
  key: string;
  category: BudgetCategory;
  description: string;
  detail?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  /** true quando o preço foi editado pelo usuário. */
  custom: boolean;
}

export interface Budget {
  lines: BudgetLine[];
  subtotals: Record<BudgetCategory, number>;
  /** Custo total (materiais + serviços + mão de obra). */
  cost: number;
  margin: number;
  /** Preço final sugerido (custo + margem). */
  price: number;
}
