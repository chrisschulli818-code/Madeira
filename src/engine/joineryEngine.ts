/**
 * Encaixes, furação e passo a passo de montagem.
 *
 * A partir das peças posicionadas (`AssembledModel`), o motor:
 * 1. detecta onde as peças de estrutura se encostam — a borda de uma peça contra a face da
 *    outra (junção de topo) — e distribui os fixadores ao longo da junção conforme o método
 *    de montagem (parafuso com pré-furo, minifix + cavilha, ou cavilhas coladas);
 * 2. acrescenta furação de ferragens: caneco Ø35 e base das dobradiças, pinos das prateleiras
 *    móveis (a 37 mm das bordas, sistema 32) e o rasgo do fundo encaixado;
 * 3. traduz cada furo para coordenadas da peça (u ao longo do comprimento, v ao longo da largura,
 *    a partir do canto de referência) — o "mapa de furação" — e também para o móvel (3D);
 * 4. gera o passo a passo de montagem na ordem certa.
 *
 * As posições seguem as mesmas regras de quantidade da lista de compras (hardwareEngine).
 */
import type {
  AssembledModel,
  AssemblyStep,
  Box3D,
  CutPiece,
  JoineryPlan,
  MachiningKind,
  MachiningOp,
  MachiningSurface,
  PieceRole,
} from '@/types/woodcraft';
import { FASTENER_SPACING } from './constants';
import { hingesForDoorHeight, structuralScrewFor } from './hardwareEngine';
import { edgeBandingMeters } from './cabinetEngine';

type Axis = 'x' | 'y' | 'z';
const AXES: Axis[] = ['x', 'y', 'z'];
type Point = Record<Axis, number>;

const size = (b: Box3D, a: Axis) => (a === 'x' ? b.w : a === 'y' ? b.h : b.d);
const min = (b: Box3D, a: Axis) => b[a];
const max = (b: Box3D, a: Axis) => b[a] + size(b, a);
const mid = (b: Box3D, a: Axis) => b[a] + size(b, a) / 2;
const overlap = (a: Box3D, b: Box3D, ax: Axis) => Math.min(max(a, ax), max(b, ax)) - Math.max(min(a, ax), min(b, ax));
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Papéis que formam a estrutura (unidos por parafuso/minifix/cavilha). */
const STRUCTURAL: ReadonlySet<PieceRole> = new Set(['side', 'bottom', 'top', 'rail', 'divider', 'fixed-shelf', 'leg-panel', 'apron']);

/** Ordem de montagem: base primeiro, depois divisórias, prateleiras fixas, tampo/travessas, saia. */
const ROLE_ORDER: Partial<Record<PieceRole, number>> = { bottom: 1, 'leg-panel': 1, divider: 2, 'fixed-shelf': 3, top: 4, rail: 4, apron: 5, side: 9 };

export const MACHINING_LABELS: Record<MachiningKind, string> = {
  parafuso: 'Furo passante p/ parafuso (escarear)',
  prefuro: 'Pré-furo p/ parafuso',
  'minifix-tambor': 'Minifix — tambor',
  'minifix-pino': 'Minifix — pino (haste)',
  'minifix-furo-borda': 'Minifix — furo na borda',
  cavilha: 'Cavilha',
  'pino-prateleira': 'Pino de prateleira',
  'caneco-dobradica': 'Caneco da dobradiça',
  'base-dobradica': 'Base da dobradiça (pré-furo)',
  rasgo: 'Rasgo p/ fundo',
};

export const MACHINING_COLORS: Record<MachiningKind, string> = {
  parafuso: '#b91c1c',
  prefuro: '#ef4444',
  'minifix-tambor': '#7c3aed',
  'minifix-pino': '#a78bfa',
  'minifix-furo-borda': '#8b5cf6',
  cavilha: '#2563eb',
  'pino-prateleira': '#059669',
  'caneco-dobradica': '#d97706',
  'base-dobradica': '#f59e0b',
  rasgo: '#6b7280',
};

interface Inst {
  piece: CutPiece;
  index: number;
  box: Box3D;
  /** Eixo da espessura (menor medida). */
  t: Axis;
  /** Eixos do comprimento (veio) e da largura da peça de corte. */
  L: Axis;
  W: Axis;
}

function instOf(piece: CutPiece, index: number, box: Box3D): Inst {
  const t = AXES.reduce((a, b) => (size(box, b) < size(box, a) ? b : a));
  const inPlane = AXES.filter((a) => a !== t) as [Axis, Axis];
  const byLength = inPlane.find((a) => Math.abs(size(box, a) - piece.length) < 1.5);
  const L = byLength ?? (size(box, inPlane[0]) >= size(box, inPlane[1]) ? inPlane[0] : inPlane[1]);
  const W = inPlane.find((a) => a !== L)!;
  return { piece, index, box, t, L, W };
}

/** Posições ao longo de um trecho de comprimento `len`, com `n` fixadores e recuo `inset` das pontas. */
export function spread(len: number, n: number, inset: number): number[] {
  if (n <= 1) return [len / 2];
  const a = Math.min(inset, len / 4);
  return Array.from({ length: n }, (_, k) => a + (k * (len - 2 * a)) / (n - 1));
}

class OpList {
  readonly ops: MachiningOp[] = [];
  add(inst: Inst, kind: MachiningKind, surface: MachiningSurface, world: Point, diameter: number, depth: number, axis: Axis, joint: string, extra: Partial<MachiningOp> = {}) {
    this.ops.push({
      kind,
      pieceId: inst.piece.id,
      instance: inst.index,
      surface,
      u: r1(world[inst.L] - min(inst.box, inst.L)),
      v: r1(world[inst.W] - min(inst.box, inst.W)),
      diameter,
      depth,
      world: { x: r1(world.x), y: r1(world.y), z: r1(world.z) },
      axis,
      joint,
      ...extra,
    });
  }
}

/** Face da peça no eixo da espessura mais próxima da coordenada informada. */
const faceAt = (inst: Inst, coord: number): MachiningSurface =>
  Math.abs(coord - min(inst.box, inst.t)) <= Math.abs(coord - max(inst.box, inst.t)) ? 'face-a' : 'face-b';

interface ButtJoint {
  label: string;
  /** Peça que recebe na face. */
  a: Inst;
  /** Peça que encosta com a borda. */
  b: Inst;
  length: number;
  fasteners: number;
  order: number;
}

export function computeJoinery(model: AssembledModel): JoineryPlan {
  const list = new OpList();
  const all: Inst[] = model.pieces.flatMap((piece) => piece.instances.map((box, i) => instOf(piece, i, box)));
  const structural = all.filter((i) => STRUCTURAL.has(i.piece.role));
  const center: Point = { x: model.overall.width / 2, y: model.overall.height / 2, z: model.overall.depth / 2 };
  const T = structural[0]?.box ? size(structural[0].box, structural[0].t) : 18;
  const joints: ButtJoint[] = [];

  // --- 1. Junções de topo entre peças de estrutura ------------------------------------------
  for (let i = 0; i < structural.length; i++) {
    for (let j = i + 1; j < structural.length; j++) {
      const p = structural[i]!;
      const q = structural[j]!;
      const o = { x: overlap(p.box, q.box, 'x'), y: overlap(p.box, q.box, 'y'), z: overlap(p.box, q.box, 'z') };
      const c = AXES.find((ax) => Math.abs(o[ax]) <= 0.5 && AXES.filter((other) => other !== ax).every((other) => o[other] > 0.5));
      if (!c) continue;
      // Borda de uma peça contra a face da outra.
      let a: Inst;
      let b: Inst;
      if (p.t === c && q.t !== c) [a, b] = [p, q];
      else if (q.t === c && p.t !== c) [a, b] = [q, p];
      else continue;
      const jAxis = AXES.find((ax) => ax !== c && ax !== b.t)!;
      const j0 = Math.max(min(a.box, jAxis), min(b.box, jAxis));
      const len = o[jAxis];
      const contact = Math.abs(max(a.box, c) - min(b.box, c)) <= 0.5 ? max(a.box, c) : min(a.box, c);
      const dirB = mid(b.box, c) > contact ? 1 : -1;
      const midB = mid(b.box, b.t);
      const label = `${a.piece.name} × ${b.piece.name}`;
      const aContact = faceAt(a, contact);
      const aOuterCoord = aContact === 'face-a' ? max(a.box, a.t) : min(a.box, a.t);
      const at = (along: number, cCoord: number, tCoord = midB): Point => {
        const pt = { x: 0, y: 0, z: 0 } as Point;
        pt[c] = cCoord;
        pt[jAxis] = j0 + along;
        pt[b.t] = tCoord;
        return pt;
      };

      let fasteners = 0;
      if (model.assembly === 'screw') {
        const n = Math.max(2, Math.ceil(len / FASTENER_SPACING));
        for (const s of spread(len, n, 50)) {
          list.add(a, 'parafuso', aContact === 'face-a' ? 'face-b' : 'face-a', at(s, aOuterCoord), 4, size(a.box, a.t), c, label);
          list.add(b, 'prefuro', 'borda', at(s, contact), 3, 35, c, label);
        }
        fasteners = n;
      } else if (model.assembly === 'minifix') {
        const n = Math.max(2, Math.round(len / 250));
        // Tambor na face interna da peça que encosta com a borda (voltada para dentro do móvel).
        const innerCoord = mid(b.box, b.t) < center[b.t] ? max(b.box, b.t) : min(b.box, b.t);
        for (const s of spread(len, n, 50)) {
          list.add(a, 'minifix-pino', aContact, at(s, contact), 5, 12, c, label);
          list.add(b, 'minifix-furo-borda', 'borda', at(s, contact), 8, 34, c, label);
          list.add(b, 'minifix-tambor', faceAt(b, innerCoord), at(s, contact + dirB * 34, innerCoord), 15, 13, b.t, label);
          // Cavilha de alinhamento 32 mm para dentro de cada minifix.
          const sd = s + (s < len / 2 ? 32 : -32);
          if (sd > 0 && sd < len) {
            list.add(a, 'cavilha', aContact, at(sd, contact), 8, Math.min(12, T - 6), c, label);
            list.add(b, 'cavilha', 'borda', at(sd, contact), 8, 20, c, label);
          }
        }
        fasteners = n;
      } else {
        const n = Math.max(2, Math.ceil(len / 128));
        for (const s of spread(len, n, 32)) {
          list.add(a, 'cavilha', aContact, at(s, contact), 8, Math.min(12, T - 6), c, label);
          list.add(b, 'cavilha', 'borda', at(s, contact), 8, 20, c, label);
        }
        fasteners = n;
      }
      const order = Math.min(ROLE_ORDER[a.piece.role] ?? 6, ROLE_ORDER[b.piece.role] ?? 6);
      joints.push({ label, a, b, length: len, fasteners, order });
    }
  }

  // --- 2. Dobradiças: caneco na porta e base na lateral ------------------------------------------
  const verticals = structural.filter((s) => s.t === 'x');
  let hingeCount = 0;
  for (const door of model.doors) {
    const box = door.box;
    if (!box) continue;
    const piece = model.pieces.find((p) => p.instances.includes(box));
    if (!piece) continue;
    const inst = instOf(piece, piece.instances.indexOf(box), box);
    const edgeX = door.hingeSide === 'left' ? box.x : box.x + box.w;
    const inward = door.hingeSide === 'left' ? 1 : -1;
    const n = hingesForDoorHeight(box.h);
    hingeCount += n;
    // Lateral/divisória atrás da borda das dobradiças (frente rente à porta).
    const side = verticals
      .filter((s) => Math.abs(max(s.box, 'z') - box.z) <= 2 && edgeX >= s.box.x - 25 && edgeX <= s.box.x + s.box.w + 25 && overlap(s.box, box, 'y') > 0)
      .sort((p, q) => Math.abs(mid(p.box, 'x') - edgeX) - Math.abs(mid(q.box, 'x') - edgeX))[0];
    for (const s of spread(box.h, n, 100)) {
      const y = box.y + s;
      list.add(inst, 'caneco-dobradica', faceAt(inst, box.z), { x: edgeX + inward * 22.5, y, z: box.z }, 35, 12.5, 'z', 'Dobradiças');
      if (side) {
        const faceX = mid(box, 'x') > mid(side.box, 'x') ? max(side.box, 'x') : min(side.box, 'x');
        for (const dy of [-16, 16]) {
          list.add(side, 'base-dobradica', faceAt(side, faceX), { x: faceX, y: y + dy, z: max(side.box, 'z') - 37 }, 3, 10, 'x', 'Dobradiças');
        }
      }
    }
  }

  // --- 3. Pinos das prateleiras móveis ---------------------------------------------------------
  let pinCount = 0;
  for (const shelf of all.filter((i) => i.piece.role === 'shelf')) {
    const s = shelf.box;
    for (const v of verticals) {
      const leftFace = Math.abs(max(v.box, 'x') - s.x) <= 3;
      const rightFace = Math.abs(min(v.box, 'x') - (s.x + s.w)) <= 3;
      if (!leftFace && !rightFace) continue;
      if (!(s.y >= v.box.y && s.y <= v.box.y + v.box.h) || overlap(v.box, s, 'z') <= 0) continue;
      const faceX = leftFace ? max(v.box, 'x') : min(v.box, 'x');
      for (const z of [s.z + 37, s.z + s.d - 37]) {
        list.add(v, 'pino-prateleira', faceAt(v, faceX), { x: faceX, y: s.y - 5, z }, 5, 10, 'x', 'Pinos de prateleira');
        pinCount++;
      }
    }
  }

  // --- 4. Rasgo do fundo encaixado -------------------------------------------------------------------
  for (const back of all.filter((i) => i.piece.role === 'back')) {
    for (const p of structural) {
      const o = { x: overlap(back.box, p.box, 'x'), y: overlap(back.box, p.box, 'y'), z: overlap(back.box, p.box, 'z') };
      if (!AXES.every((ax) => o[ax] > 0.5)) continue;
      const inPlane: Axis[] = [p.L, p.W];
      const along = inPlane.reduce((a, b) => (o[b] > o[a] ? b : a));
      const across = inPlane.find((ax) => ax !== along)!;
      const start: Point = { x: Math.max(back.box.x, p.box.x), y: Math.max(back.box.y, p.box.y), z: Math.max(back.box.z, p.box.z) };
      const faceCoord = mid(back.box, p.t) > mid(p.box, p.t) ? max(p.box, p.t) : min(p.box, p.t);
      start[p.t] = faceCoord;
      list.add(p, 'rasgo', faceAt(p, faceCoord), start, r1(o[across] + 1), 8, p.t, 'Rasgo do fundo', {
        length: r1(o[along]),
        alongWidth: along === p.W,
      });
    }
  }

  return { ops: list.ops, steps: assemblySteps(model, list.ops, joints, { hingeCount, pinCount }) };
}

// ---------------------------------------------------------------------------
// Passo a passo
// ---------------------------------------------------------------------------

function assemblySteps(
  model: AssembledModel,
  ops: MachiningOp[],
  joints: ButtJoint[],
  counts: { hingeCount: number; pinCount: number },
): AssemblyStep[] {
  const steps: AssemblyStep[] = [];
  const T = model.pieces.find((p) => p.role === 'side' || p.role === 'leg-panel')?.thickness ?? 18;
  const band = model.pieces.reduce((n, p) => n + edgeBandingMeters(p), 0);

  steps.push({
    title: 'Identifique as peças',
    detail:
      'Escreva a lápis, numa borda que não aparece, o número de cada peça da lista de corte e a letra da unidade (1a, 1b...). ' +
      'No mapa de furação, a face A é o lado voltado para a esquerda, o fundo ou o chão do móvel; a face B é o oposto. ' +
      'As cotas u (comprimento) e v (largura) partem do canto de referência da peça.',
  });
  if (band > 0) {
    steps.push({ title: 'Aplique a fita de borda', detail: `Antes de furar, aplique ${band.toFixed(1)} m de fita nas bordas indicadas na lista de corte e refile.` });
  }

  const byKind = new Map<MachiningKind, number>();
  for (const op of ops) byKind.set(op.kind, (byKind.get(op.kind) ?? 0) + 1);
  if (ops.length) {
    const summary = [...byKind.entries()].map(([k, n]) => `${n} × ${MACHINING_LABELS[k].toLowerCase()}`).join('; ');
    steps.push({
      title: 'Fure as peças',
      detail: `Marque e fure conforme o mapa de furação (${ops.length} operações): ${summary}. Use limitador de profundidade e mantenha a broca a 90°.`,
    });
  }

  // Junções agrupadas por par de peças, na ordem de montagem.
  const groups = new Map<string, ButtJoint[]>();
  for (const j of [...joints].sort((a, b) => a.order - b.order)) groups.set(j.label, [...(groups.get(j.label) ?? []), j]);
  const backGrooved = ops.some((o) => o.kind === 'rasgo');
  let backInserted = false;
  for (const [label, js] of groups) {
    const first = js[0]!;
    const isTop = ['top', 'rail'].includes(first.a.piece.role) || ['top', 'rail'].includes(first.b.piece.role);
    if (backGrooved && isTop && !backInserted) {
      steps.push({ title: 'Encaixe o fundo', detail: 'Deslize o fundo nos rasgos das laterais e da base antes de fechar a parte de cima.' });
      backInserted = true;
    }
    const n = js.reduce((acc, j) => acc + j.fasteners, 0);
    const how =
      model.assembly === 'screw'
        ? `prenda com grampos, confira o esquadro e aperte ${n} parafuso(s) ${structuralScrewFor(T)} pelos furos escareados`
        : model.assembly === 'minifix'
          ? `rosqueie os ${n} pinos de minifix, coloque as cavilhas com cola, encaixe e trave girando os tambores ¼ de volta`
          : `passe cola nos furos e nas ${js.reduce((acc, j) => acc + Math.max(2, Math.ceil(j.length / 128)), 0)} cavilhas, encaixe e deixe sob grampos por 30 min`;
    steps.push({
      title: `Una ${label.toLowerCase()}`,
      detail: `${js.length} junção(ões): encoste a borda da peça "${first.b.piece.name}" na face da "${first.a.piece.name}" e ${how}.`,
    });
  }

  if (model.backPerimeter > 0) {
    steps.push({ title: 'Esquadreje e feche o fundo', detail: 'Meça as duas diagonais da caixa (devem ser iguais) e pregue ou grampeie o fundo a cada 15 cm.' });
  }
  if (model.pieces.some((p) => p.role === 'plinth')) {
    steps.push({ title: 'Fixe o rodapé', detail: 'Prenda o rodapé por baixo da base com as cantoneiras, respeitando o recuo.' });
  }
  if (model.drawers.length) {
    steps.push({
      title: 'Monte e instale as gavetas',
      detail: `Monte as ${model.drawers.length} caixa(s) de gaveta (4 cantos parafusados), pregue o fundo por baixo, fixe a parte fixa das corrediças nas laterais do vão (niveladas, rentes à frente) e a parte móvel na caixa. Encaixe e fixe as frentes com folga de 3 mm.`,
    });
  }
  if (counts.hingeCount) {
    steps.push({
      title: 'Instale as portas',
      detail: `Encaixe as ${counts.hingeCount} dobradiças nos canecos (Ø35) das portas, parafuse as bases nos pré-furos das laterais e regule altura, profundidade e folga pelos parafusos da dobradiça.`,
    });
  }
  if (counts.pinCount || model.adjustableShelves) {
    steps.push({ title: 'Coloque as prateleiras', detail: `Encaixe ${counts.pinCount || model.adjustableShelves * 4} pinos nos furos Ø5 e apoie as prateleiras móveis.` });
  }
  if (model.hangingRods.length) steps.push({ title: 'Instale o cabideiro', detail: 'Fixe os suportes nas laterais e encaixe o tubo cortado na medida.' });
  if (model.doors.length || model.drawers.length) {
    steps.push({ title: 'Fixe os puxadores', detail: 'Use um gabarito para repetir a mesma furação (128 mm) em todas as frentes.' });
  }
  if (model.joints.some((j) => j.bracket)) {
    steps.push({ title: 'Fixe o tampo', detail: 'Com o tampo virado para baixo sobre uma superfície limpa, prenda-o por baixo com as cantoneiras.' });
  }
  steps.push({
    title: 'Instale e nivele',
    detail:
      model.templateId === 'wall-cabinet'
        ? 'Marque a altura na parede com nível, fixe o trilho/suspensores com buchas e pendure o armário; regule até ficar nivelado.'
        : 'Posicione o móvel, nivele (calços ou pés reguláveis) e prenda na parede com as cantoneiras anti-tombamento.',
  });
  return steps;
}

/** Operações agrupadas por peça/unidade, na ordem da lista de corte. */
export function opsByPiece(model: AssembledModel, ops: MachiningOp[]) {
  const groups: Array<{ piece: CutPiece; instance: number; ops: MachiningOp[] }> = [];
  for (const piece of model.pieces) {
    piece.instances.forEach((_, instance) => {
      const list = ops.filter((o) => o.pieceId === piece.id && o.instance === instance);
      if (list.length) groups.push({ piece, instance, ops: list });
    });
  }
  return groups;
}

export const instanceLetter = (i: number) => String.fromCharCode(97 + (i % 26));
