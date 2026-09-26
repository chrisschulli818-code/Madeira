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
export type CarcassTemplateId = 'base-cabinet' | 'wall-cabinet' | 'wardrobe' | 'nightstand' | 'dresser' | 'bookshelf' | 'tv-rack';
/** Mesas: tampo sobre painéis laterais. */
export type WorkbenchTemplateId = 'workbench' | 'desk';
/**
 * `custom` = móvel livre, montado peça por peça a partir do zero.
 * `bed` = cama de MDF (cabeceira, laterais, estrado).
 * `prop` = objeto do ambiente (eletrodoméstico, sofá, mesa...) — só para compor o cômodo, fora da produção.
 */
export type TemplateId = CarcassTemplateId | WorkbenchTemplateId | 'custom' | 'bed' | 'prop';

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
  /**
   * Posições manuais das prateleiras móveis (mm, da face de cima da peça de baixo do vão até a
   * face de baixo da prateleira). Definidas ao arrastar; ignoradas se não baterem com `shelves`.
   */
  shelfPositions?: number[];
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
  /** Gaveteiro sob o tampo, encostado num dos painéis (opcional em projetos antigos = sem gaveteiro). */
  pedestal?: 'none' | 'left' | 'right';
  /** Largura interna do gaveteiro. */
  pedestalWidth?: number;
  /** Quantidade de gavetas do gaveteiro. */
  pedestalDrawers?: number;
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
export type CustomPanelKind = 'estrutura' | 'prateleira' | 'fundo' | 'porta' | 'frente' | 'gaveta';

/**
 * Painel do móvel livre, posicionado manualmente.
 * Para `kind: 'gaveta'` o registro descreve o módulo de gaveta: largura do vão (width),
 * altura da frente (height), profundidade do vão (depth) e espessura da frente (thickness).
 */
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
/** Cama de MDF: cabeceira e peseira até o chão, laterais entre elas, sarrafos e estrado. */
export interface BedParams {
  /** Medidas do colchão (a cama é calculada em volta dele). */
  mattressWidth: number;
  mattressLength: number;
  mattressHeight: number;
  /** Altura do estrado (topo das ripas) em relação ao piso. */
  deckHeight: number;
  /** Altura das laterais (saia). */
  railHeight: number;
  headboardHeight: number;
  footboard: boolean;
  footboardHeight: number;
  thickness: number;
  /** Estrado de ripas (MDF) ou chapa inteira. */
  deck: 'ripas' | 'chapa';
  /** Gavetões com rodízios sob o estrado: por lado (0 = sem gavetas). */
  drawersPerSide?: number;
  /** De que lado(s) ficam os gavetões. */
  drawerSides?: 'ambos' | 'esquerda' | 'direita';
  assembly: AssemblyMethod;
}

export type PropType =
  | 'geladeira'
  | 'fogao'
  | 'lavadora'
  | 'sofa'
  | 'poltrona'
  | 'mesa'
  | 'cadeira'
  | 'tv'
  | 'tapete'
  | 'planta';

/** Objeto do ambiente (não entra na lista de corte, compras nem orçamento). */
export interface PropParams {
  type: PropType;
  width: number;
  height: number;
  depth: number;
  color: string;
}

export interface CabinetTemplate<P = CabinetParams | WorkbenchParams | CustomParams | BedParams | PropParams> {
  id: TemplateId;
  name: string;
  description: string;
  kind: 'carcass' | 'workbench' | 'custom' | 'bed' | 'prop';
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
  | 'apron'
  | 'headboard'
  | 'footboard'
  | 'bed-rail'
  | 'cleat'
  | 'slat'
  | 'decor';

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
  /** Peça só visual (colchão, objetos do ambiente): fora da lista de corte, compras e montagem. */
  decorative?: boolean;
  /** Cor própria para o 3D (peças decorativas). */
  color?: string;
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
  /** Instância 3D da folha (mesma referência de `CutPiece.instances`), para furação das dobradiças. */
  box?: Box3D;
}

export interface DrawerSpec {
  frontWidth: number;
  frontHeight: number;
  boxWidth: number;
  boxHeight: number;
  /** Comprimento comercial da corrediça (mm); nos gavetões com rodízios, a profundidade da caixa. */
  slideLength: number;
  /** Como a gaveta corre: corrediça telescópica (padrão) ou rodízios no piso (gavetão de cama). */
  runner?: 'corredica' | 'rodizio';
}

/** Junção estrutural entre duas peças da caixa (define parafusos/minifix/cavilhas). */
export interface Joint {
  label: string;
  /** Comprimento da linha de junção (mm). */
  length: number;
  /** Junção fixada por cantoneiras (ex.: tampo solto de mesa), não pelo método de montagem. */
  bracket?: boolean;
}

/** Faixa vertical onde as prateleiras móveis de um vão podem ficar. */
export interface ShelfRegion {
  /** Face de cima da peça de baixo (base ou prateleira fixa). */
  bottom: number;
  /** Face de baixo da peça de cima (tampo, travessa ou prateleira fixa). */
  top: number;
  /** Aceita prateleiras (vão só de gavetas não aceita). */
  acceptsShelves: boolean;
  /** Posições atuais das prateleiras (offset a partir de `bottom`, crescente). */
  shelves: number[];
}

/** Peça que pode ser arrastada no viewport (prateleira, gaveta ou painel do móvel livre). */
export interface DragHandle {
  kind: 'shelf' | 'drawer' | 'panel';
  /** Instância 3D correspondente (mesma referência de `CutPiece.instances`). */
  box: Box3D;
  /** Vão (móveis de caixa). */
  column?: number;
  /** Índice da prateleira/gaveta dentro do vão. */
  index?: number;
  /** Painel do móvel livre. */
  panelId?: string;
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
    /** Região de prateleiras de cada vão (móveis de caixa). */
    regions?: ShelfRegion[];
  };
  /** Peças que podem ser arrastadas e encaixadas no viewport. */
  handles?: DragHandle[];
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
  | (ProjectItemBase & { templateId: WorkbenchTemplateId; params: WorkbenchParams })
  | (ProjectItemBase & { templateId: 'custom'; params: CustomParams })
  | (ProjectItemBase & { templateId: 'bed'; params: BedParams })
  | (ProjectItemBase & { templateId: 'prop'; params: PropParams })
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

// ---------------------------------------------------------------------------
// Ambiente (cômodo com vários móveis)
// ---------------------------------------------------------------------------

/**
 * Paredes do cômodo vistas de cima (planta): `fundo` no topo da planta (z = 0),
 * `frente` embaixo (z = profundidade), `esquerda` (x = 0) e `direita` (x = largura).
 */
export type WallSide = 'fundo' | 'frente' | 'esquerda' | 'direita';

/** Porta ou janela numa parede. */
export interface RoomOpening {
  id: string;
  kind: 'porta' | 'janela';
  wall: WallSide;
  /**
   * Posição ao longo da parede na planta (mm): a partir de x = 0 nas paredes do fundo e da frente,
   * e a partir de z = 0 nas paredes esquerda e direita.
   */
  offset: number;
  width: number;
  height: number;
  /** Altura do peitoril (janelas); portas começam no piso. */
  sill: number;
}

export interface RoomSettings {
  name: string;
  /** Medida interna no eixo X (parede do fundo), mm. */
  width: number;
  /** Medida interna no eixo Z (parede esquerda), mm. */
  depth: number;
  height: number;
  openings: RoomOpening[];
  /** Cores das paredes e do piso nas imagens 3D. */
  wallColor?: string;
  floorColor?: string;
}

/** Rotação do móvel vista de cima. 0 = costas para a parede do fundo, frente para a frente do cômodo. */
export type Rotation = 0 | 90 | 180 | 270;

/** Posição de uma unidade de móvel no cômodo (salva no projeto). */
export interface FurniturePlacement {
  itemId: string;
  /** Qual das unidades iguais (0 .. quantidade − 1). */
  unit: number;
  /** Canto da projeção no piso (mm), já considerando a rotação. */
  x: number;
  z: number;
  rotation: Rotation;
  /** Altura da base do móvel em relação ao piso (aéreos ficam pendurados). */
  elevation: number;
}

/** Posição resolvida (com medidas do móvel), usada pelas vistas do ambiente. */
export interface ResolvedPlacement extends FurniturePlacement {
  key: string;
  name: string;
  templateId: TemplateId;
  /** Medidas do móvel sem rotação (largura X, altura Y, profundidade Z incluindo frentes). */
  size: { w: number; h: number; d: number };
  /** Canto mínimo do conjunto de peças no sistema do móvel (para alinhar as peças ao posicionar). */
  origin: { x: number; y: number; z: number };
  /** Projeção no piso já rotacionada. */
  footprint: { w: number; d: number };
  /** Parede em que as costas do móvel estão encostadas, se houver. */
  wall: WallSide | null;
  /** Posição definida automaticamente (ainda não arrastada). */
  auto: boolean;
}

/** Móvel salvo na biblioteca pessoal ("Meus móveis"), reutilizável em qualquer projeto/ambiente. */
export interface LibraryEntry {
  id: string;
  savedAt: string;
  item: ProjectItem;
}

// ---------------------------------------------------------------------------
// Encaixes, furação e montagem
// ---------------------------------------------------------------------------

export type MachiningKind =
  | 'parafuso'
  | 'prefuro'
  | 'minifix-tambor'
  | 'minifix-pino'
  | 'minifix-furo-borda'
  | 'cavilha'
  | 'pino-prateleira'
  | 'caneco-dobradica'
  | 'base-dobradica'
  | 'rasgo';

/** Superfície da peça onde a operação é feita. Face A = lado de menor coordenada no móvel; face B = oposto. */
export type MachiningSurface = 'face-a' | 'face-b' | 'borda';

/** Uma furação/usinagem numa peça. */
export interface MachiningOp {
  kind: MachiningKind;
  pieceId: string;
  /** Índice da unidade da peça (0 = a, 1 = b...). */
  instance: number;
  surface: MachiningSurface;
  /** Posição na peça (mm): u ao longo do comprimento, v ao longo da largura, a partir do canto de referência. */
  u: number;
  v: number;
  diameter: number;
  depth: number;
  /** Rasgo: extensão ao longo do comprimento (u) — ou da largura, se `alongWidth`. */
  length?: number;
  alongWidth?: boolean;
  /** Posição no móvel (mm) e eixo da broca, para mostrar no 3D. */
  world: { x: number; y: number; z: number };
  axis: 'x' | 'y' | 'z';
  /** Junção ou ferragem a que pertence (ex.: "Base × Lateral"). */
  joint: string;
}

export interface AssemblyStep {
  title: string;
  detail: string;
}

export interface JoineryPlan {
  ops: MachiningOp[];
  steps: AssemblyStep[];
}
