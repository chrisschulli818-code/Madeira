/**
 * Partes móveis do móvel montado: portas (giram na dobradiça) e gavetas (deslizam com a caixa).
 * Usado para abrir e fechar portas e gavetas no 3D. Tudo em mm, no espaço do modelo.
 *
 * - Porta: cada unidade de peça com papel `door`. O lado da dobradiça vem da especificação da
 *   porta (quando existe) ou do lado mais próximo da borda do móvel.
 * - Gaveta: cada frente (`drawer-front`) leva junto as peças da caixa (laterais, contra-frente,
 *   traseira e fundo) que ficam atrás dela, dentro da sua largura e altura.
 */
import type { AssembledModel, Box3D } from '@/types/woodcraft';

/** Referência a uma unidade de peça: `${pieceId}#${índice da instância}`. */
export type InstanceRef = string;
export const instanceRef = (pieceId: string, index: number): InstanceRef => `${pieceId}#${index}`;

export interface DoorMotion {
  kind: 'door';
  id: string;
  label: string;
  parts: InstanceRef[];
  /** Eixo vertical da dobradiça (canto externo da folha). */
  pivot: { x: number; z: number };
  /** Sentido da rotação em torno de Y que leva a folha para fora (+1 ou −1). */
  sign: 1 | -1;
  /** Abertura máxima (graus). */
  angle: number;
}

export interface DrawerMotion {
  kind: 'drawer';
  id: string;
  label: string;
  parts: InstanceRef[];
  axis: 'x' | 'z';
  /** Sentido de abertura no eixo (+1 ou −1). */
  dir: 1 | -1;
  /** Quanto a gaveta sai (mm). */
  travel: number;
}

export type Motion = DoorMotion | DrawerMotion;

const DRAWER_BOX_ROLES = new Set(['drawer-side', 'drawer-back', 'drawer-bottom']);
const center = (b: Box3D) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2, z: b.z + b.d / 2 });

export function computeMotions(model: AssembledModel): Motion[] {
  const motions: Motion[] = [];
  const W = model.overall.width;
  const D = model.overall.depth;
  const mid = { x: W / 2, z: D / 2 };

  // --- Portas -----------------------------------------------------------------------------
  let doorN = 0;
  for (const piece of model.pieces) {
    if (piece.role !== 'door') continue;
    piece.instances.forEach((box, i) => {
      doorN++;
      // Folha "de frente" (espessura em Z) ou "de lado" (espessura em X, porta lateral).
      const facesZ = box.d <= box.w;
      const spec = model.doors.find((d) => d.box === box);
      if (facesZ) {
        const hinge = spec?.hingeSide ?? (box.x + box.w / 2 < mid.x ? 'left' : 'right');
        const out = box.z + box.d / 2 >= mid.z ? 1 : -1;
        const pivotZ = out > 0 ? box.z + box.d : box.z;
        const pivotX = hinge === 'left' ? box.x : box.x + box.w;
        // Rotação +θ em Y leva +X para −Z. Dobradiça à esquerda abrindo para +Z: θ negativo.
        const sign = ((hinge === 'left' ? -1 : 1) * out) as 1 | -1;
        motions.push({ kind: 'door', id: `porta-${doorN}`, label: `Porta ${doorN}`, parts: [instanceRef(piece.id, i)], pivot: { x: pivotX, z: pivotZ }, sign, angle: 100 });
      } else {
        // Porta lateral: dobradiça na borda de trás, abrindo para fora em X.
        const out = box.x + box.w / 2 >= mid.x ? 1 : -1;
        const pivotX = out > 0 ? box.x + box.w : box.x;
        const pivotZ = box.z;
        // Rotação +θ em Y leva +Z para +X.
        const sign = out as 1 | -1;
        motions.push({ kind: 'door', id: `porta-${doorN}`, label: `Porta ${doorN}`, parts: [instanceRef(piece.id, i)], pivot: { x: pivotX, z: pivotZ }, sign, angle: 100 });
      }
    });
  }

  // --- Gavetas ----------------------------------------------------------------------------
  const fronts: Array<{ ref: InstanceRef; box: Box3D; axis: 'x' | 'z'; dir: 1 | -1; parts: InstanceRef[]; far: number }> = [];
  for (const piece of model.pieces) {
    if (piece.role !== 'drawer-front') continue;
    piece.instances.forEach((box, i) => {
      const axis: 'x' | 'z' = box.d <= box.w ? 'z' : 'x';
      const c = center(box);
      const dir = (axis === 'z' ? (c.z >= mid.z ? 1 : -1) : c.x >= mid.x ? 1 : -1) as 1 | -1;
      fronts.push({ ref: instanceRef(piece.id, i), box, axis, dir, parts: [instanceRef(piece.id, i)], far: 0 });
    });
  }
  for (const piece of model.pieces) {
    if (!DRAWER_BOX_ROLES.has(piece.role)) continue;
    piece.instances.forEach((box, i) => {
      const c = center(box);
      let best: (typeof fronts)[number] | null = null;
      let bestDist = Infinity;
      for (const f of fronts) {
        const lateral = f.axis === 'z' ? [f.box.x, f.box.x + f.box.w, c.x] : [f.box.z, f.box.z + f.box.d, c.z];
        if (c.y < f.box.y - 60 || c.y > f.box.y + f.box.h + 10) continue;
        if (lateral[2]! < lateral[0]! - 1 || lateral[2]! > lateral[1]! + 1) continue;
        // A caixa fica atrás da frente (do lado de dentro).
        const fc = f.axis === 'z' ? f.box.z : f.box.x;
        const pc = f.axis === 'z' ? c.z : c.x;
        const behind = f.dir > 0 ? fc - pc : pc - fc;
        if (behind < -1) continue;
        if (behind < bestDist) {
          bestDist = behind;
          best = f;
        }
      }
      if (!best) return;
      best.parts.push(instanceRef(piece.id, i));
      const depth = best.axis === 'z' ? (best.dir > 0 ? best.box.z - box.z : box.z + box.d - best.box.z) : best.dir > 0 ? best.box.x - box.x : box.x + box.w - best.box.x;
      best.far = Math.max(best.far, depth);
    });
  }
  fronts
    .sort((a, b) => b.box.y - a.box.y || a.box.x - b.box.x || a.box.z - b.box.z)
    .forEach((f, k) => {
      motions.push({
        kind: 'drawer',
        id: `gaveta-${k + 1}`,
        label: `Gaveta ${k + 1}`,
        parts: f.parts,
        axis: f.axis,
        dir: f.dir,
        // Corrediça comum abre ~3/4 do comprimento; sem caixa (frente solta), 150 mm.
        travel: f.far > 0 ? Math.round(f.far * 0.75) : 150,
      });
    });
  return motions;
}

/** Índice: unidade de peça → movimento a que pertence. */
export function motionIndex(motions: Motion[]): Map<InstanceRef, Motion> {
  const map = new Map<InstanceRef, Motion>();
  for (const m of motions) for (const r of m.parts) map.set(r, m);
  return map;
}

/** Distância entre dois pontos (mm, arredondada). */
export function distanceMm(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
}

/** Aproxima um ponto clicado dos cantos e bordas da peça (tolerância em mm). */
export function snapToBox(p: { x: number; y: number; z: number }, box: Box3D, tol = 12) {
  const snap = (v: number, lo: number, hi: number) => (Math.abs(v - lo) <= tol ? lo : Math.abs(v - hi) <= tol ? hi : Math.round(v));
  return { x: snap(p.x, box.x, box.x + box.w), y: snap(p.y, box.y, box.y + box.h), z: snap(p.z, box.z, box.z + box.d) };
}
