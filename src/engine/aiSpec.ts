/**
 * Converte o pedido do assistente ("quero um guarda-roupa de 1,80 × 2,10 com 3 portas")
 * em móveis do projeto.
 *
 * - `planToItems`: transforma a resposta estruturada da IA (`aiSchema.ts`) em itens, passando
 *   tudo pelo mesmo leitor dos arquivos de projeto (`parseItem`), que valida e completa os campos.
 * - `parsePedido`: leitor simples, sem IA, usado quando o servidor não tem chave da API.
 *   Entende o tipo de móvel, as medidas (m, cm ou mm) e quantidades de portas, gavetas,
 *   prateleiras e vãos.
 */
import type { AiPlan, ColumnSpec, FurnitureSpec } from './aiSchema';
import type { ProjectItem } from '@/types/woodcraft';
import { parseItem } from './projectFile';
import { defaultItemParams, MATTRESS_SIZES, TEMPLATES } from './templates';

type Obj = Record<string, unknown>;

const columnFromSpec = (c: ColumnSpec): Obj => ({
  widthRatio: c.largura_relativa > 0 ? c.largura_relativa : 1,
  drawers: Math.max(0, Math.min(6, Math.round(c.gavetas))),
  drawerPosition: c.gavetas_embaixo ? 'bottom' : 'top',
  doors: Math.max(0, Math.min(2, Math.round(c.portas))),
  shelves: Math.max(0, Math.min(10, Math.round(c.prateleiras))),
  hangingRod: c.cabideiro,
});

/** Um móvel da resposta → item do projeto (ou null se não der para montar). */
export function specToItem(spec: FurnitureSpec): ProjectItem | null {
  const templateId = spec.modelo;
  const defaults = defaultItemParams(templateId).params as unknown as Obj;
  const params: Obj = { ...defaults };
  const dims = { width: spec.largura, height: spec.altura, depth: spec.profundidade };
  const kind = TEMPLATES[templateId].kind;

  if (kind === 'carcass') {
    Object.assign(params, dims, { assembly: spec.montagem });
    const c = spec.caixa;
    if (c) {
      Object.assign(params, {
        baseType: c.apoio,
        topType: c.tampo,
        backMode: c.fundo,
        ...(c.altura_apoio != null && { plinthHeight: c.altura_apoio }),
        ...(c.espessura_caixa != null && { carcassThickness: c.espessura_caixa }),
        ...(c.espessura_frentes != null && { frontThickness: c.espessura_frentes }),
        ...(c.altura_frente_gaveta != null && { drawerFrontHeight: c.altura_frente_gaveta }),
      });
      if (c.colunas.length) params.columns = c.colunas.slice(0, 12).map(columnFromSpec);
    }
  } else if (kind === 'workbench') {
    Object.assign(params, dims, { assembly: spec.montagem });
    const m = spec.mesa;
    if (m) {
      Object.assign(params, {
        pedestal: m.gaveteiro,
        pedestalDrawers: Math.round(m.gavetas),
        pedestalWidth: m.largura_gaveteiro,
        lowerShelf: m.prateleira_inferior,
        ...(m.espessura_tampo != null && { topThickness: m.espessura_tampo }),
      });
    }
  } else if (kind === 'bed') {
    params.assembly = spec.montagem;
    const b = spec.cama;
    if (b) {
      Object.assign(params, {
        mattressWidth: b.largura_colchao,
        mattressLength: b.comprimento_colchao,
        deckHeight: b.altura_estrado,
        headboardHeight: b.altura_cabeceira,
        footboard: b.peseira_alta,
        deck: b.estrado,
        drawersPerSide: Math.round(b.gavetoes_por_lado),
        drawerSides: b.lado_gavetoes,
      });
    }
  } else if (kind === 'custom') {
    params.assembly = spec.montagem;
    params.panels = (spec.livre?.paineis ?? []).slice(0, 80).map((p) => ({
      name: p.nome,
      kind: p.funcao,
      orientation: p.orientacao,
      width: p.largura,
      height: p.altura,
      depth: p.profundidade,
      thickness: p.espessura,
      x: p.x,
      y: p.y,
      z: p.z,
    }));
  } else {
    return null;
  }

  return parseItem({ templateId, name: spec.nome || TEMPLATES[templateId].name, quantity: Math.max(1, Math.round(spec.quantidade || 1)), params });
}

export function planToItems(plan: AiPlan): ProjectItem[] {
  return plan.moveis.map(specToItem).filter((i): i is ProjectItem => i !== null);
}

// ---------------------------------------------------------------------------
// Leitor simples (sem IA)
// ---------------------------------------------------------------------------

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const WORD_NUMBERS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
};

const KEYWORDS: Array<[RegExp, FurnitureSpec['modelo']]> = [
  [/guarda[- ]?roupa|roupeiro|closet/, 'wardrobe'],
  [/criado[- ]?mudo|mesa de cabeceira/, 'nightstand'],
  [/comoda|gaveteiro/, 'dresser'],
  [/aereo|armario suspenso|armario de parede/, 'wall-cabinet'],
  [/estante|livreiro|prateleira/, 'bookshelf'],
  [/rack|painel de tv|movel de tv/, 'tv-rack'],
  [/escrivaninha|mesa de estudo|mesa de escritorio|home office/, 'desk'],
  [/bancada|mesa de trabalho|mesa/, 'workbench'],
  [/cama/, 'bed'],
  [/balcao|gabinete|pia|armario/, 'base-cabinet'],
];

/** Converte "1,80 m", "180 cm", "1800 mm" ou um número solto (pela ordem de grandeza) para mm. */
export function toMm(value: string, unit?: string): number {
  const n = parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(n)) return NaN;
  const u = unit?.trim();
  if (u === 'mm') return Math.round(n);
  if (u === 'cm') return Math.round(n * 10);
  if (u === 'm' || u === 'metro' || u === 'metros') return Math.round(n * 1000);
  // Sem unidade: até 10 = metros, até 400 = centímetros, acima = milímetros.
  return Math.round(n < 10 ? n * 1000 : n <= 400 ? n * 10 : n);
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)\s*(mm|cm|metros?|m)?\b`;

function countOf(text: string, word: string): number | null {
  const m = text.match(new RegExp(String.raw`(\d+|${Object.keys(WORD_NUMBERS).join('|')})\s+(?:\w+\s+)?${word}`));
  if (!m) return null;
  return /^\d+$/.test(m[1]!) ? parseInt(m[1]!, 10) : (WORD_NUMBERS[m[1]!] ?? null);
}

/** "largura de 1,80", "largura: 180 cm" ou "1,80 de largura", "60 cm de profundidade". */
function dimension(text: string, names: string): number | null {
  const after = text.match(new RegExp(String.raw`(?:${names})\s*(?:de|:|=)?\s*${NUM}`));
  if (after) return toMm(after[1]!, after[2]);
  const before = text.match(new RegExp(String.raw`${NUM}\s*(?:de\s+)?(?:${names})`));
  return before ? toMm(before[1]!, before[2]) : null;
}

/** Interpreta um pedido em português sem usar IA. */
export function parsePedido(raw: string): AiPlan {
  const text = norm(raw);
  const modelo = KEYWORDS.find(([re]) => re.test(text))?.[1] ?? 'base-cabinet';
  const tpl = TEMPLATES[modelo];
  const defaults = defaultItemParams(modelo).params as unknown as Obj;
  const notes: string[] = [];

  // Medidas: "180 x 210 x 60" (L × A × P) ou "largura 1,80", "altura 210 cm", "profundidade 60".
  let width = defaults.width as number | undefined;
  let height = defaults.height as number | undefined;
  let depth = defaults.depth as number | undefined;
  const triple = text.match(new RegExp(String.raw`${NUM}\s*[x×]\s*${NUM}(?:\s*[x×]\s*${NUM})?`));
  if (triple) {
    const unit = triple[6] ?? triple[4] ?? triple[2];
    width = toMm(triple[1]!, triple[2] ?? unit);
    height = toMm(triple[3]!, triple[4] ?? unit);
    if (triple[5]) depth = toMm(triple[5], triple[6] ?? unit);
  }
  const w = dimension(text, 'largura|larg\\.?|comprimento|largo');
  height = dimension(text, 'altura|alt\\.?|alto') ?? height;
  depth = dimension(text, 'profundidade|prof\\.?|fundo') ?? depth;
  if (w != null) width = w;
  else if (!triple) {
    // "escrivaninha de 1,40 m": a primeira medida com unidade (ou decimal) sem nome é a largura.
    const loose = text.match(/(?:^|\s)(\d+,\d+|\d+(?:\.\d+)?\s*(?:mm|cm|m|metros?)\b)/);
    if (loose) {
      const [, v] = loose;
      const unit = v!.match(/(mm|cm|metros?|m)\b/)?.[1];
      width = toMm(v!.replace(/[a-z\s]+$/, ''), unit);
    }
  }

  const portas = countOf(text, 'portas?');
  const gavetas = countOf(text, 'gavet(?:as?|oes|ao)');
  const prateleiras = countOf(text, 'prateleiras?');
  const vaos = countOf(text, '(?:vaos?|colunas?|modulos?)');
  const cabideiro = /cabide/.test(text);
  const montagem: FurnitureSpec['montagem'] = /minifix/.test(text) ? 'minifix' : /cavilha/.test(text) ? 'dowel' : 'screw';
  const quantidade = countOf(text, `(?:${norm(tpl.name).split(' ')[0]}|unidades|iguais)`) ?? 1;

  const spec: FurnitureSpec = {
    modelo,
    nome: tpl.name,
    quantidade: Math.min(20, Math.max(1, quantidade)),
    largura: width ?? 800,
    altura: height ?? 800,
    profundidade: depth ?? 500,
    montagem,
    caixa: null,
    mesa: null,
    cama: null,
    livre: null,
  };

  if (tpl.kind === 'carcass') {
    const baseCols = (defaults.columns as Array<Obj>) ?? [];
    let colunas: ColumnSpec[] = baseCols.map((c) => ({
      largura_relativa: (c.widthRatio as number) ?? 1,
      gavetas: (c.drawers as number) ?? 0,
      gavetas_embaixo: c.drawerPosition === 'bottom',
      portas: (c.doors as number) ?? 0,
      prateleiras: (c.shelves as number) ?? 0,
      cabideiro: Boolean(c.hangingRod),
    }));
    if (portas != null || gavetas != null || vaos != null || prateleiras != null) {
      // Uma coluna para cada 2 portas, a não ser que o número de vãos tenha sido dito.
      // Portas em pares quando o número é par e cada folha fica com até 600 mm; senão uma por vão.
      const W = width ?? 800;
      const paired = portas != null && portas % 2 === 0 && W / portas <= 600;
      const n = Math.max(1, Math.min(8, vaos ?? (portas ? (paired ? portas / 2 : portas) : colunas.length || 1)));
      let doorsLeft = portas ?? colunas.reduce((s, c) => s + c.portas, 0);
      const perCol = Math.ceil(doorsLeft / n);
      colunas = Array.from({ length: n }, (_, i) => {
        const d = Math.max(0, Math.min(2, Math.min(perCol, doorsLeft)));
        doorsLeft -= d;
        return {
          largura_relativa: 1,
          // Gavetas no primeiro vão (gaveteiro); em guarda-roupa ficam embaixo da porta.
          gavetas: i === 0 ? Math.min(6, gavetas ?? 0) : 0,
          gavetas_embaixo: modelo === 'wardrobe',
          portas: d,
          prateleiras: prateleiras != null ? Math.ceil(prateleiras / n) : modelo === 'wardrobe' ? 1 : d > 0 ? 1 : 0,
          cabideiro: modelo === 'wardrobe' ? cabideiro || i === n - 1 : cabideiro,
        };
      });
      if (portas && portas > n * 2) notes.push(`Coloquei ${n * 2} portas (no máximo 2 por vão).`);
    }
    spec.caixa = {
      colunas,
      apoio: /\bpes\b|pezinho/.test(text) ? 'feet' : /suspens|aereo/.test(text) ? 'none' : ((defaults.baseType as 'plinth' | 'feet' | 'none') ?? 'plinth'),
      altura_apoio: null,
      tampo: (defaults.topType as 'full' | 'rails') ?? 'full',
      fundo: /rasgo|canal/.test(text) ? 'groove' : ((defaults.backMode as 'overlay' | 'groove') ?? 'overlay'),
      espessura_caixa: /\b15\s*mm\b/.test(text) ? 15 : null,
      espessura_frentes: null,
      altura_frente_gaveta: null,
    };
  } else if (tpl.kind === 'workbench') {
    spec.mesa = {
      gaveteiro: gavetas ? (/esquerd/.test(text) ? 'left' : 'right') : modelo === 'desk' && !/sem gaveta/.test(text) ? 'right' : 'none',
      gavetas: gavetas ?? 3,
      largura_gaveteiro: 400,
      prateleira_inferior: /prateleira/.test(text) || Boolean(defaults.lowerShelf),
      espessura_tampo: null,
    };
  } else if (tpl.kind === 'bed') {
    const size =
      MATTRESS_SIZES.find((s) => new RegExp(norm(s.label)).test(text)) ??
      (width && width < 1000 ? MATTRESS_SIZES[0] : MATTRESS_SIZES.find((s) => s.label === 'Casal'))!;
    const perSide = gavetas != null ? Math.min(3, Math.max(1, Math.ceil(gavetas / 2))) : /gavet/.test(text) ? 1 : 0;
    spec.cama = {
      largura_colchao: size.width,
      comprimento_colchao: size.length,
      // Com gavetões, o estrado sobe para caber a caixa.
      altura_estrado: perSide > 0 ? 400 : 300,
      altura_cabeceira: dimension(text, 'cabeceira') ?? 1000,
      peseira_alta: !/sem peseira|peseira baixa/.test(text),
      estrado: /chapa|estrado inteiro/.test(text) ? 'chapa' : 'ripas',
      gavetoes_por_lado: perSide,
      lado_gavetoes: /lado esquerdo|a esquerda/.test(text) ? 'esquerda' : /lado direito|a direita/.test(text) ? 'direita' : 'ambos',
    };
    notes.push(`Cama calculada para colchão ${size.label.toLowerCase()} (${size.width / 10} × ${size.length / 10} cm).`);
  }

  const medidas = tpl.kind === 'bed' ? '' : ` de ${spec.largura} × ${spec.altura} × ${spec.profundidade} mm`;
  return {
    acao: 'criar',
    resposta: [`Montei ${spec.quantidade > 1 ? `${spec.quantidade}× ` : ''}${tpl.name.toLowerCase()}${medidas}.`, ...notes].join(' '),
    moveis: [spec],
  };
}
