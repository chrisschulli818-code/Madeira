/**
 * Gera o relatório completo do projeto em PDF (arquivo baixado, sem depender da impressão do navegador).
 *
 * Conteúdo:
 *  1. Resumo do projeto (móveis, totais e orçamento)
 *  2. Cada móvel: especificações, desenhos cotados (frontal, interna, lateral), medidas
 *     internas, portas, gavetas e cabideiros
 *  3. Lista de corte do projeto (numerada)
 *  4. Materiais: chapas, área, aproveitamento e fita de borda por material
 *  5. Plano de corte (desenho de cada chapa, peças numeradas conforme a lista de corte)
 *  6. Lista de compras (chapas, ferragens, fixação, acabamento, insumos)
 *  7. Orçamento
 *  8. Checklist de ferramentas
 *
 * Módulo sem React: recebe os resultados já calculados e devolve um documento jsPDF.
 * É carregado sob demanda pela interface (import dinâmico) para não pesar no bundle inicial.
 */
import { jsPDF } from 'jspdf';
import { autoTable, type UserOptions } from 'jspdf-autotable';
import type {
  AssembledModel,
  Budget,
  BudgetCategory,
  ProjectPiece,
  Box3D,
  HardwareCategory,
  HardwareItem,
  MaterialRole,
  MaterialSpec,
  NestingResult,
  SheetLayout,
  SheetSettings,
  ToolRequirement,
} from '@/types/woodcraft';
import { edgeBandingLabel, edgeBandingMeters, pieceArea } from '@/engine/cabinetEngine';
import { edgeBandWidthFor, hingesForDoorHeight } from '@/engine/hardwareEngine';
import { MATERIAL_COLORS } from '@/lib/pieceColors';

/** Um móvel do projeto, com suas especificações e o modelo calculado. */
export interface PdfItem {
  name: string;
  templateName: string;
  quantity: number;
  specs: Array<[string, string]>;
  model: AssembledModel;
}

export interface PdfReportData {
  projectName: string;
  date: Date;
  items: PdfItem[];
  /** Lista de corte do projeto (todas as peças, quantidades × móveis iguais). */
  pieces: ProjectPiece[];
  nesting: NestingResult[];
  budget: Budget;
  hardware: HardwareItem[];
  tools: ToolRequirement[];
  materials: Record<MaterialRole, MaterialSpec>;
  sheet: SheetSettings;
}

// ---------------------------------------------------------------------------
// Layout e estilo
// ---------------------------------------------------------------------------

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14; // margem
const CONTENT_W = PAGE_W - 2 * M;
const BOTTOM = PAGE_H - 16;

const INK: RGB = [31, 26, 20];
const SUBTLE: RGB = [111, 101, 90];
const PRIMARY: RGB = [180, 83, 9];
const BORDER: RGB = [214, 203, 187];
const MUTED: RGB = [243, 239, 233];

type RGB = [number, number, number];

const HARDWARE_LABELS: Record<HardwareCategory, string> = {
  fixacao: 'Fixação',
  ferragem: 'Ferragens',
  acabamento: 'Acabamento',
  insumo: 'Insumos',
};

const FRONT_ROLES = new Set(['door', 'drawer-front']);

/** As fontes padrão do PDF usam WinAnsi: troca símbolos fora dessa tabela. */
export function pdfText(s: string): string {
  return s
    .replace(/≈/g, '~')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/[−–—]/g, '-')
    .replace(/[“”]/g, '"');
}

const hexToRgb = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const num = (n: number, digits = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: digits });
const pct = (n: number) => `${num(n * 100)}%`;
/** Cota em mm sem separador de milhar, como em desenho técnico. */
const mm = (n: number) => String(Math.round(n));

/** Contexto de escrita: documento + cursor vertical. */
class Writer {
  y = M;
  constructor(readonly doc: jsPDF) {}

  newPage() {
    this.doc.addPage();
    this.y = M;
  }

  /** Garante espaço vertical; senão quebra a página. */
  ensure(h: number) {
    if (this.y + h > BOTTOM) this.newPage();
  }

  section(n: number, title: string, { newPage = false } = {}) {
    if (newPage) this.newPage();
    else this.ensure(20);
    const { doc } = this;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...PRIMARY);
    doc.text(`${n}.`, M, this.y + 5);
    doc.setTextColor(...INK);
    doc.text(pdfText(title), M + 8, this.y + 5);
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.5);
    doc.line(M, this.y + 7.5, PAGE_W - M, this.y + 7.5);
    this.y += 12;
  }

  subtitle(title: string) {
    this.ensure(12);
    const { doc } = this;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...PRIMARY);
    doc.text(pdfText(title), M, this.y + 4);
    this.y += 7;
  }

  paragraph(text: string, size = 8.5, color: RGB = SUBTLE) {
    const { doc } = this;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(pdfText(text), CONTENT_W) as string[];
    const h = lines.length * size * 0.42;
    this.ensure(h + 2);
    doc.text(lines, M, this.y + size * 0.35);
    this.y += h + 2;
  }

  table(options: UserOptions) {
    autoTable(this.doc, {
      startY: this.y,
      margin: { left: M, right: M, top: M, bottom: PAGE_H - BOTTOM },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.4, textColor: INK, lineColor: BORDER, lineWidth: 0.15, overflow: 'linebreak' },
      headStyles: { fillColor: MUTED, textColor: SUBTLE, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [252, 250, 247] },
      ...options,
      body: options.body?.map((row) => (Array.isArray(row) ? row.map((c) => (typeof c === 'string' ? pdfText(c) : c)) : row)),
    });
    this.y = ((this.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? this.y) + 6;
  }
}

// ---------------------------------------------------------------------------
// Desenhos
// ---------------------------------------------------------------------------

/** Linha de cota com linhas de chamada, marcas oblíquas e texto. */
function dimension(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, offset: number, label: string, size = 7) {
  const horizontal = Math.abs(y1 - y2) < 1e-6;
  const [ax, ay, bx, by] = horizontal ? [x1, y1 + offset, x2, y2 + offset] : [x1 + offset, y1, x2 + offset, y2];
  doc.setDrawColor(...SUBTLE);
  doc.setLineWidth(0.15);
  doc.setLineDashPattern([0.6, 0.6], 0);
  doc.line(x1, y1, ax, ay);
  doc.line(x2, y2, bx, by);
  doc.setLineDashPattern([], 0);
  doc.line(ax, ay, bx, by);
  const t = 1.1;
  doc.line(ax - t, ay + t, ax + t, ay - t);
  doc.line(bx - t, by + t, bx + t, by - t);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...INK);
  if (horizontal) {
    doc.text(label, (ax + bx) / 2, ay - 1, { align: 'center' });
  } else {
    doc.text(label, ax - 1, (ay + by) / 2, { align: 'center', angle: 90 });
  }
}

type View = 'front' | 'side';

/** Vista ortogonal cotada do móvel dentro do retângulo (x, y, w, h), em mm de papel. */
function drawElevation(
  doc: jsPDF,
  model: AssembledModel,
  view: View,
  area: { x: number; y: number; w: number; h: number },
  opts: { showFronts: boolean; title: string },
) {
  const { width: W, height: H, depth: D } = model.overall;
  const tf = model.pieces.find((p) => FRONT_ROLES.has(p.role))?.thickness ?? 0;
  const spanX = view === 'front' ? W : D + tf;
  const pad = 13;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(pdfText(opts.title), area.x + area.w / 2, area.y + 3, { align: 'center' });

  const top = area.y + 6;
  const availW = area.w - 2 * pad;
  const availH = area.h - 6 - 2 * pad;
  const s = Math.min(availW / spanX, availH / H);
  const ox = area.x + (area.w - spanX * s) / 2;
  const oy = top + pad + (availH - H * s) / 2;
  const X = (v: number) => ox + v * s;
  const Y = (v: number) => oy + (H - v) * s;

  const items: Array<{ box: Box3D; color: string }> = [];
  for (const piece of model.pieces) {
    if (!opts.showFronts && FRONT_ROLES.has(piece.role)) continue;
    for (const box of piece.instances) items.push({ box, color: MATERIAL_COLORS[piece.material] });
  }
  items.sort((a, b) => (view === 'front' ? a.box.z + a.box.d - (b.box.z + b.box.d) : a.box.x + a.box.w - (b.box.x + b.box.w)));

  doc.setLineWidth(0.12);
  doc.setDrawColor(63, 54, 44);
  for (const { box, color } of items) {
    const [rx, rw] = view === 'front' ? [box.x, box.w] : [box.z, box.d];
    doc.setFillColor(...hexToRgb(color));
    doc.rect(X(rx), Y(box.y + box.h), Math.max(rw * s, 0.1), Math.max(box.h * s, 0.1), 'FD');
  }
  // piso
  doc.setLineWidth(0.4);
  doc.setDrawColor(...SUBTLE);
  doc.line(X(0) - 4, Y(0), X(spanX) + 4, Y(0));

  dimension(doc, X(0), Y(0), X(spanX), Y(0), 7, mm(view === 'front' ? W : D));
  dimension(doc, X(0), Y(H), X(0), Y(0), -7, mm(H));
  const plinth = model.layout.plinthHeight;
  if (plinth > 0) dimension(doc, X(spanX), Y(plinth), X(spanX), Y(0), 5, mm(plinth), 6.5);
  if (view === 'front' && model.layout.columns.length > 1) {
    for (const [a, b] of model.layout.columns) dimension(doc, X(a), Y(H), X(b), Y(H), -4.5, mm(b - a), 6.5);
  }
  if (view === 'side') {
    dimension(doc, X(0), Y(H), X(model.layout.internalDepth), Y(H), -4.5, `útil ${mm(model.layout.internalDepth)}`, 6.5);
  }
}

/** Desenho de uma chapa com as peças numeradas. */
function drawSheet(
  doc: jsPDF,
  layout: SheetLayout,
  sheet: SheetSettings,
  area: { x: number; y: number; w: number },
  color: string,
  numberOf: (pieceId: string) => number,
): number {
  const s = area.w / sheet.length;
  const h = sheet.width * s;
  const X = (v: number) => area.x + v * s;
  const Y = (v: number) => area.y + v * s;

  // sobra (hachurada)
  doc.setFillColor(246, 242, 236);
  doc.setDrawColor(...SUBTLE);
  doc.setLineWidth(0.3);
  doc.rect(area.x, area.y, area.w, h, 'FD');
  doc.setDrawColor(226, 216, 202);
  doc.setLineWidth(0.15);
  for (let d = -h; d < area.w; d += 4) {
    const x0 = Math.max(area.x, area.x + d);
    const y0 = area.y + h - Math.max(0, -d);
    const len = Math.min(area.x + area.w - x0, y0 - area.y);
    doc.line(x0, y0, x0 + len, y0 - len);
  }
  // refilo
  doc.setDrawColor(168, 153, 138);
  doc.setLineDashPattern([1, 0.8], 0);
  doc.rect(X(sheet.trim), Y(sheet.trim), (sheet.length - 2 * sheet.trim) * s, (sheet.width - 2 * sheet.trim) * s, 'S');
  doc.setLineDashPattern([], 0);

  const fill = hexToRgb(color);
  for (const pl of layout.placements) {
    const px = X(pl.x);
    const py = Y(pl.y);
    const pw = pl.w * s;
    const ph = pl.h * s;
    doc.setFillColor(...fill);
    doc.setDrawColor(63, 54, 44);
    doc.setLineWidth(0.15);
    doc.rect(px, py, pw, ph, 'FD');

    const n = String(numberOf(pl.pieceId));
    const dims = pl.rotated ? `${pl.h}×${pl.w}` : `${pl.w}×${pl.h}`;
    const size = Math.min(8, ph * 1.4, pw * 0.9);
    if (size < 3) continue;
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    const twoLines = ph > size * 0.9 && pw > doc.getTextWidth(dims) + 1;
    doc.text(`#${n}`, px + pw / 2, py + ph / 2 + (twoLines ? -0.2 : size * 0.12), { align: 'center' });
    if (twoLines) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(size * 0.8);
      doc.setTextColor(...SUBTLE);
      doc.text(dims, px + pw / 2, py + ph / 2 + size * 0.38, { align: 'center' });
    }
  }
  return h;
}

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const BUDGET_LABELS: Record<BudgetCategory, string> = {
  chapas: 'Chapas',
  insumos: 'Ferragens e insumos',
  servicos: 'Serviços da madeireira',
  'mao-de-obra': 'Mão de obra',
};

/** Página de um móvel: especificações, desenhos cotados e tabelas de frentes. */
function writeItem(w: Writer, n: number, item: PdfItem, index: number, total: number) {
  const { doc } = w;
  const { model } = item;
  const title = total > 1 ? `Móvel ${index + 1}: ${item.name}` : item.name;
  w.section(n, title, { newPage: true });
  w.paragraph(`${item.templateName}${item.quantity > 1 ? ` — ${item.quantity} unidades iguais` : ''}`, 9);
  w.table({
    body: item.specs,
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 62 } },
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 1.1 },
    alternateRowStyles: { fillColor: MUTED },
  });
  if (model.warnings.length) {
    for (const warning of model.warnings) w.paragraph(`• ${warning}`, 8, [146, 64, 14]);
  }

  if (!model.pieces.length) {
    w.paragraph('Este móvel ainda não tem peças.', 9);
    return;
  }

  // Desenhos: frontal + interna (ou lateral) em cima; lateral + medidas internas embaixo.
  const half = (CONTENT_W - 6) / 2;
  const hasFronts = model.pieces.some((p) => FRONT_ROLES.has(p.role));
  w.ensure(95);
  drawElevation(doc, model, 'front', { x: M, y: w.y, w: half, h: 92 }, { showFronts: true, title: 'Vista frontal' });
  drawElevation(doc, model, hasFronts ? 'front' : 'side', { x: M + half + 6, y: w.y, w: half, h: 92 }, {
    showFronts: false,
    title: hasFronts ? 'Vista frontal interna (sem frentes)' : 'Vista lateral',
  });
  w.y += 96;

  const internals: Array<[string, string]> = [
    ['Largura externa', `${model.overall.width} mm`],
    ['Altura externa', `${model.overall.height} mm`],
    ['Profundidade da caixa', `${model.overall.depth} mm`],
    ...(model.templateId === 'custom' ? [] : [['Profundidade útil interna', `${Math.round(model.layout.internalDepth)} mm`] as [string, string]]),
    ...(model.layout.plinthHeight > 0 ? [['Rodapé / pés', `${model.layout.plinthHeight} mm`] as [string, string]] : []),
    ...(model.templateId === 'custom' ? [['Junções detectadas', String(model.joints.length)] as [string, string]] : []),
    ...model.layout.columns.map(([a, b], i): [string, string] => [
      model.templateId === 'workbench' ? 'Vão livre entre painéis' : `Vão ${i + 1} (largura interna)`,
      `${Math.round(b - a)} mm`,
    ]),
  ];
  w.ensure(88);
  const blockTop = w.y;
  if (hasFronts) drawElevation(doc, model, 'side', { x: M, y: blockTop, w: half, h: 86 }, { showFronts: true, title: 'Vista lateral' });
  autoTable(doc, {
    startY: blockTop + 6,
    margin: { left: hasFronts ? M + half + 6 : M, right: M },
    theme: 'plain',
    head: [['Medida', 'Valor']],
    body: internals.map(([k, v]) => [pdfText(k), v]),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.3, textColor: INK },
    headStyles: { fillColor: MUTED, textColor: SUBTLE, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
  });
  const tableEnd = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? blockTop;
  w.y = Math.max(tableEnd, hasFronts ? blockTop + 88 : tableEnd) + 4;

  if (model.doors.length) {
    w.subtitle('Portas');
    w.table({
      head: [['#', 'Altura', 'Largura', 'Abertura', 'Dobradiça', 'Qtd dobradiças']],
      body: model.doors.map((d, i) => [
        String(i + 1),
        `${d.height} mm`,
        `${d.width} mm`,
        d.hingeSide === 'left' ? 'Dobradiças à esquerda' : 'Dobradiças à direita',
        d.overlay === 'full' ? 'Reta (sobreposição total)' : 'Curva (meia sobreposição)',
        String(hingesForDoorHeight(d.height)),
      ]),
      columnStyles: { 0: { cellWidth: 8, halign: 'right' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 5: { halign: 'right' } },
    });
  }
  if (model.drawers.length) {
    w.subtitle('Gavetas');
    w.table({
      head: [['#', 'Frente (L × A)', 'Caixa externa (L × A)', 'Corrediça', 'Profundidade da caixa']],
      body: model.drawers.map((d, i) => [
        String(i + 1),
        `${d.frontWidth} × ${d.frontHeight} mm`,
        `${d.boxWidth} × ${d.boxHeight} mm`,
        `Telescópica ${d.slideLength} mm (par)`,
        `${d.slideLength} mm`,
      ]),
      columnStyles: { 0: { cellWidth: 8, halign: 'right' } },
    });
  }
  if (model.hangingRods.length) {
    w.subtitle('Cabideiros');
    w.table({
      head: [['#', 'Comprimento do tubo oblongo']],
      body: model.hangingRods.map((r, i) => [String(i + 1), `${r} mm`]),
      columnStyles: { 0: { cellWidth: 8, halign: 'right' } },
    });
  }
}

export function buildPdfReport(data: PdfReportData): jsPDF {
  const { items, pieces, nesting, hardware, tools, budget, materials, sheet } = data;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setProperties({ title: pdfText(`${data.projectName} — WoodCraft Planner`), creator: 'WoodCraft Planner' });
  const w = new Writer(doc);

  const numberById = new Map(pieces.map((p, i) => [p.id, i + 1]));
  const numberOf = (id: string) => numberById.get(id) ?? 0;
  const matLabel = (role: MaterialRole) => materials[role].label;
  const multi = items.length > 1;
  const subtitle = multi ? `${items.length} móveis` : (items[0]?.templateName ?? '');

  // --- Cabeçalho ------------------------------------------------------------------
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, PAGE_W, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PRIMARY);
  doc.text('WOODCRAFT PLANNER', M, 13);
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text(pdfText(data.projectName), M, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...SUBTLE);
  doc.text(pdfText(subtitle), M, 28);
  doc.text(data.date.toLocaleDateString('pt-BR'), PAGE_W - M, 28, { align: 'right' });
  w.y = 36;

  // --- 1. Resumo ---------------------------------------------------------------------
  const units = pieces.reduce((n, p) => n + p.quantity, 0);
  const area = pieces.reduce((n, p) => n + pieceArea(p), 0);
  const band = pieces.reduce((n, p) => n + edgeBandingMeters(p), 0);
  const totalSheets = nesting.reduce((n, g) => n + g.sheets.length, 0);

  w.section(1, 'Resumo do projeto');
  w.table({
    head: [['#', 'Móvel', 'Tipo', 'L × A × P (mm)', 'Qtd']],
    body: items.map((it, i) => [
      String(i + 1),
      it.name,
      it.templateName,
      `${it.model.overall.width} × ${it.model.overall.height} × ${it.model.overall.depth}`,
      String(it.quantity),
    ]),
    columnStyles: { 0: { cellWidth: 8, halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold', cellWidth: 12 } },
  });
  w.table({
    body: [
      ['Peças', `${pieces.length} tipos, ${units} peças`],
      ['Área total de chapa', `${num(area, 2)} m²`],
      ['Fita de borda (líquida)', `${num(band)} m`],
      ['Chapas necessárias', `${totalSheets} chapa(s) de ${sheet.length} × ${sheet.width} mm (kerf ${sheet.kerf} mm, refilo ${sheet.trim} mm)`],
      ['Custo estimado', money(budget.cost)],
      ...(budget.margin > 0 ? [['Preço sugerido (com margem)', money(budget.price)]] : []),
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 62 } },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.6 },
    alternateRowStyles: { fillColor: MUTED },
  });
  w.paragraph(
    'Convenções: medidas em milímetros. Comprimento = sentido do veio. Fita de borda: C = lados do comprimento, L = lados da largura. ' +
      'A profundidade informada é a da caixa, sem as frentes. Quantidades da lista de corte e das compras já consideram todos os móveis iguais.',
  );

  // --- 2. Móveis ----------------------------------------------------------------------
  items.forEach((it, i) => writeItem(w, 2, it, i, items.length));

  // --- 3. Lista de corte ---------------------------------------------------------------
  w.section(3, 'Lista de corte', { newPage: true });
  const head = ['#', 'Peça', ...(multi ? ['Móvel'] : []), 'Qtd', 'Compr.', 'Larg.', 'Esp.', 'Material', 'Fita', 'Veio', 'm²'];
  const off = multi ? 1 : 0;
  w.table({
    head: [head],
    body: pieces.map((p, i) => [
      String(i + 1),
      p.notes ? `${p.name}\n${p.notes}` : p.name,
      ...(multi ? [p.itemName] : []),
      String(p.quantity),
      String(p.length),
      String(p.width),
      String(p.thickness),
      matLabel(p.material),
      edgeBandingLabel(p.edgeBanding),
      p.grain === 'length' && materials[p.material].hasGrain ? 'Travado' : 'Livre',
      num(pieceArea(p), 2),
    ]),
    foot: [['', 'Total', ...(multi ? [''] : []), String(units), '', '', '', '', `${num(band)} m`, '', num(area, 2)]],
    footStyles: { fillColor: MUTED, textColor: INK, fontStyle: 'bold' },
    styles: { fontSize: multi ? 7.5 : 8 },
    columnStyles: {
      0: { cellWidth: 7, halign: 'right', textColor: SUBTLE },
      1: { cellWidth: multi ? 40 : 52 },
      ...(multi ? { 2: { cellWidth: 24 } } : {}),
      [2 + off]: { halign: 'right', fontStyle: 'bold', cellWidth: 9 },
      [3 + off]: { halign: 'right', cellWidth: 13 },
      [4 + off]: { halign: 'right', cellWidth: 12 },
      [5 + off]: { halign: 'right', cellWidth: 9 },
      [7 + off]: { cellWidth: 12 },
      [8 + off]: { cellWidth: 13 },
      [9 + off]: { halign: 'right', cellWidth: 11 },
    },
  });

  // --- 4. Materiais ---------------------------------------------------------------------
  w.section(4, 'Materiais');
  w.table({
    head: [['Material', 'Espessura', 'Peças', 'Área de peças', 'Chapas', 'Consumo real', 'Aproveitamento', 'Perda']],
    body: nesting.map((g) => {
      const count = g.sheets.reduce((n, s) => n + s.placements.length, 0);
      return [
        g.materialLabel,
        `${g.thickness} mm`,
        String(count),
        `${num(g.totalPieceArea / 1e6, 2)} m²`,
        String(g.sheets.length),
        `~${num(g.sheetEquivalent, 2)} chapa`,
        pct(g.utilization),
        pct(1 - g.utilization),
      ];
    }),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
  });
  const bands = new Map<string, { label: string; width: number; meters: number }>();
  for (const p of pieces) {
    const meters = edgeBandingMeters(p);
    if (!meters) continue;
    const width = edgeBandWidthFor(p.thickness);
    const key = `${matLabel(p.material)}|${width}`;
    const entry = bands.get(key) ?? { label: matLabel(p.material), width, meters: 0 };
    entry.meters += meters;
    bands.set(key, entry);
  }
  if (bands.size) {
    w.subtitle('Fita de borda');
    w.table({
      head: [['Fita', 'Largura', 'Metragem líquida', 'Comprar (+10%)']],
      body: [...bands.values()].map((b) => [b.label, `${b.width} mm`, `${num(b.meters)} m`, `${Math.ceil(b.meters * 1.1)} m`]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
    });
  }

  // --- 5. Plano de corte -------------------------------------------------------------------
  w.section(5, 'Plano de corte', { newPage: true });
  w.paragraph(
    `Chapa ${sheet.length} × ${sheet.width} mm, kerf ${sheet.kerf} mm, refilo ${sheet.trim} mm. Cortes em guilhotina (de ponta a ponta). ` +
      'Os números (#) correspondem à lista de corte; a área hachurada é sobra/retalho.' +
      (multi ? ' As peças de todos os móveis dividem as mesmas chapas.' : ''),
  );
  const sheetH = sheet.width * (CONTENT_W / sheet.length);
  const pieceById = new Map(pieces.map((p) => [p.id, p]));
  for (const g of nesting) {
    w.ensure(14 + sheetH);
    w.subtitle(`${g.materialLabel} · ${g.thickness} mm — ${g.sheets.length} chapa(s), aproveitamento ${pct(g.utilization)}`);
    if (g.unplaced.length) {
      w.paragraph(`Não cabem na chapa: ${g.unplaced.map((u) => `${u.label} (${u.length}×${u.width})`).join(', ')}`, 8.5, [185, 28, 28]);
    }
    for (const layout of g.sheets) {
      w.ensure(18 + sheetH);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...SUBTLE);
      doc.text(`Chapa ${layout.index + 1}`, M, w.y + 3);
      doc.text(`${layout.placements.length} peças · ${pct(layout.utilization)}`, PAGE_W - M, w.y + 3, { align: 'right' });
      w.y += 5;
      const color = MATERIAL_COLORS[pieceById.get(layout.placements[0]?.pieceId ?? '')?.material ?? 'carcass'];
      w.y += drawSheet(doc, layout, sheet, { x: M, y: w.y, w: CONTENT_W }, color, numberOf) + 2;
      const counts = new Map<string, { label: string; qty: number }>();
      for (const pl of layout.placements) {
        const c = counts.get(pl.pieceId) ?? { label: pl.label, qty: 0 };
        c.qty += 1;
        counts.set(pl.pieceId, c);
      }
      const legend = [...counts.entries()]
        .sort(([a], [b]) => numberOf(a) - numberOf(b))
        .map(([id, c]) => `#${numberOf(id)} ${c.label}${multi ? ` (${pieceById.get(id)?.itemName ?? ''})` : ''} ×${c.qty}`)
        .join('   ·   ');
      w.paragraph(legend, 7.5);
      w.y += 3;
    }
  }

  // --- 6. Lista de compras -----------------------------------------------------------------
  w.section(6, 'Lista de compras', { newPage: true });
  w.table({
    head: [['Qtd', 'Un', 'Item', 'Especificação', 'Aplicação']],
    body: [
      ...nesting.map((g) => [String(g.sheets.length), 'un', `Chapa ${g.materialLabel}`, `${g.thickness} mm - ${sheet.length} × ${sheet.width} mm`, 'Corte das peças']),
      ...hardware.map((i) => [num(i.quantity), i.unit, `${i.name}\n(${HARDWARE_LABELS[i.category]})`, i.specification, i.application]),
    ],
    columnStyles: {
      0: { halign: 'right', fontStyle: 'bold', cellWidth: 12 },
      1: { cellWidth: 9, textColor: SUBTLE },
      2: { cellWidth: 45 },
      3: { cellWidth: 55 },
    },
  });

  // --- 7. Orçamento ------------------------------------------------------------------------
  w.section(7, 'Orçamento', { newPage: true });
  w.paragraph('Preços de referência ou informados no app. Confirme os valores com os seus fornecedores.');
  w.table({
    head: [['Item', 'Qtd', 'Un', 'Preço unit.', 'Total']],
    body: budget.lines.map((l) => [
      l.detail ? `${l.description}\n${l.detail}` : l.description,
      num(l.quantity),
      l.unit,
      money(l.unitPrice),
      money(l.total),
    ]),
    columnStyles: {
      1: { halign: 'right', cellWidth: 14 },
      2: { cellWidth: 12, textColor: SUBTLE },
      3: { halign: 'right', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
    },
  });
  w.table({
    body: [
      ...(Object.keys(BUDGET_LABELS) as BudgetCategory[])
        .filter((c) => budget.subtotals[c] > 0)
        .map((c) => [BUDGET_LABELS[c], money(budget.subtotals[c])]),
      ['Custo total', money(budget.cost)],
      ...(budget.margin > 0 ? [['Margem', money(budget.margin)], ['Preço final sugerido', money(budget.price)]] : []),
    ],
    theme: 'plain',
    margin: { left: PAGE_W - M - 100, right: M },
    styles: { fontSize: 9.5, cellPadding: 1.6 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: (hook) => {
      const label = hook.row.raw instanceof Array ? String(hook.row.raw[0]) : '';
      if (label === 'Custo total' || label === 'Preço final sugerido') {
        hook.cell.styles.fillColor = MUTED;
        hook.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // --- 8. Ferramentas ------------------------------------------------------------------------
  w.section(8, 'Checklist de ferramentas');
  for (const [category, title] of [
    ['obrigatoria', 'Essenciais'],
    ['recomendada', 'Opcionais / avançadas'],
  ] as const) {
    const list = tools.filter((t) => t.category === category);
    if (!list.length) continue;
    w.subtitle(title);
    w.table({
      body: list.map((t) => ['', t.name, t.usage]),
      theme: 'plain',
      columnStyles: { 0: { cellWidth: 7 }, 1: { cellWidth: 60, fontStyle: 'bold' }, 2: { textColor: SUBTLE } },
      didDrawCell: (hook) => {
        if (hook.section === 'body' && hook.column.index === 0) {
          hook.doc.setDrawColor(...INK);
          hook.doc.setLineWidth(0.3);
          hook.doc.rect(hook.cell.x + 1.5, hook.cell.y + 1.5, 3.2, 3.2, 'S');
        }
      },
    });
  }

  // --- Rodapé em todas as páginas ----------------------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(M, PAGE_H - 11, PAGE_W - M, PAGE_H - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...SUBTLE);
    doc.text(pdfText(`WoodCraft Planner · ${data.projectName} · ${subtitle}`), M, PAGE_H - 7);
    doc.text(`Página ${i} de ${pages}`, PAGE_W - M, PAGE_H - 7, { align: 'right' });
  }

  return doc;
}
