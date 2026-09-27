/**
 * Ambiente: um cômodo retangular com portas/janelas onde os móveis do projeto são posicionados.
 *
 * Coordenadas da planta (vista de cima), em mm: X da parede esquerda para a direita,
 * Z da parede do fundo (topo da planta) para a frente do cômodo; Y é a altura.
 * Cada móvel tem a frente no +Z do seu próprio sistema; a rotação (0/90/180/270) indica
 * para onde as costas apontam — 0 = costas na parede do fundo.
 *
 * O motor resolve posições automáticas para móveis ainda não posicionados, encaixa o móvel
 * arrastado (encosta e gira para a parede, alinha lado a lado com os vizinhos, evita sobreposição)
 * e aponta problemas (móveis sobrepostos, porta bloqueada, móvel fora do cômodo).
 */
import type {
  AssembledModel,
  FurniturePlacement,
  HardwareItem,
  ProjectItem,
  ResolvedPlacement,
  RoomOpening,
  RoomSettings,
  Rotation,
  WallSide,
} from '@/types/woodcraft';
import { propInfo } from './propEngine';
import { templateKind } from './templates';

/** Distância em que o móvel "gruda" na parede (mm). */
export const WALL_SNAP = 300;
/** Distância em que o móvel encosta no vizinho (mm). */
export const FURNITURE_SNAP = 100;
/** Altura padrão da base de um armário aéreo em relação ao piso (mm). */
export const WALL_CABINET_ELEVATION = 1500;

export const DEFAULT_ROOM: RoomSettings = {
  name: 'Cozinha',
  width: 4000,
  depth: 3000,
  height: 2700,
  openings: [{ id: 'porta-1', kind: 'porta', wall: 'frente', offset: 400, width: 800, height: 2100, sill: 0 }],
};

export const WALL_LABELS: Record<WallSide, string> = {
  fundo: 'Parede do fundo',
  frente: 'Parede da frente',
  esquerda: 'Parede esquerda',
  direita: 'Parede direita',
};

/** Rotação que deixa as costas do móvel encostadas em cada parede. */
export const ROTATION_FOR_WALL: Record<WallSide, Rotation> = { fundo: 0, esquerda: 90, frente: 180, direita: 270 };

export const placementKey = (itemId: string, unit: number) => `${itemId}#${unit}`;

export const wallLength = (room: RoomSettings, wall: WallSide) => (wall === 'fundo' || wall === 'frente' ? room.width : room.depth);

/** Medidas e origem do conjunto de peças do móvel (inclui frentes e peças fora da caixa). */
export function furnitureExtent(model: AssembledModel): { size: ResolvedPlacement['size']; origin: ResolvedPlacement['origin'] } {
  const boxes = model.pieces.flatMap((p) => p.instances);
  if (!boxes.length) return { size: { w: 300, h: 300, d: 300 }, origin: { x: 0, y: 0, z: 0 } };
  const min = (f: (b: (typeof boxes)[number]) => number) => Math.min(...boxes.map(f));
  const max = (f: (b: (typeof boxes)[number]) => number) => Math.max(...boxes.map(f));
  const origin = { x: min((b) => b.x), y: Math.min(0, min((b) => b.y)), z: min((b) => b.z) };
  return {
    origin,
    size: { w: max((b) => b.x + b.w) - origin.x, h: max((b) => b.y + b.h) - origin.y, d: max((b) => b.z + b.d) - origin.z },
  };
}

export const footprintOf = (size: { w: number; d: number }, rotation: Rotation) =>
  rotation % 180 === 0 ? { w: size.w, d: size.d } : { w: size.d, d: size.w };

/** Parede em que as costas do móvel estão encostadas (tolerância de 1 mm). */
export function wallOf(p: { x: number; z: number; rotation: Rotation }, fp: { w: number; d: number }, room: RoomSettings): WallSide | null {
  const t = 1;
  if (p.rotation === 0 && Math.abs(p.z) <= t) return 'fundo';
  if (p.rotation === 90 && Math.abs(p.x) <= t) return 'esquerda';
  if (p.rotation === 180 && Math.abs(p.z + fp.d - room.depth) <= t) return 'frente';
  if (p.rotation === 270 && Math.abs(p.x + fp.w - room.width) <= t) return 'direita';
  return null;
}

/** Altura padrão da base do móvel/objeto em relação ao piso (aéreos e TV ficam pendurados). */
function defaultElevation(item: ProjectItem): number {
  if (item.templateId === 'wall-cabinet') return WALL_CABINET_ELEVATION;
  if (item.templateId === 'prop') return propInfo(item.params.type).elevation ?? 0;
  return 0;
}

/** Peças baixinhas (tapete) não atrapalham ninguém: ficam fora das colisões. */
const isFlat = (p: { size: { h: number } }) => p.size.h <= 30;

/**
 * Posições de todas as unidades de móveis do projeto. As que o usuário já posicionou
 * vêm de `saved`; as demais vão para o primeiro lugar livre ao longo das paredes
 * (fundo, esquerda, direita, frente), de costas para a parede, sem sobrepor outros móveis
 * nem bloquear portas. Aéreos ficam pendurados a 1500 mm do piso.
 */
export function resolvePlacements(
  entries: Array<{ item: ProjectItem; model: AssembledModel }>,
  room: RoomSettings,
  saved: FurniturePlacement[],
): ResolvedPlacement[] {
  const savedByKey = new Map(saved.map((p) => [placementKey(p.itemId, p.unit), p]));
  type Slot = { item: ProjectItem; unit: number; units: number; size: ResolvedPlacement['size']; origin: ResolvedPlacement['origin'] };
  const slots: Slot[] = entries.flatMap(({ item, model }) => {
    const { size, origin } = furnitureExtent(model);
    const units = Math.max(1, Math.floor(item.quantity || 1));
    return Array.from({ length: units }, (_, unit) => ({ item, unit, units, size, origin }));
  });

  const resolve = (slot: Slot, placement: FurniturePlacement, auto: boolean): ResolvedPlacement => {
    const footprint = footprintOf(slot.size, placement.rotation);
    return {
      ...placement,
      key: placementKey(slot.item.id, slot.unit),
      name: slot.units > 1 ? `${slot.item.name} (${slot.unit + 1})` : slot.item.name,
      templateId: slot.item.templateId,
      size: slot.size,
      origin: slot.origin,
      footprint,
      wall: wallOf(placement, footprint, room),
      auto,
    };
  };

  // 1) Posições já definidas pelo usuário.
  const byKey = new Map<string, ResolvedPlacement>();
  for (const slot of slots) {
    const s = savedByKey.get(placementKey(slot.item.id, slot.unit));
    if (s) byKey.set(placementKey(slot.item.id, slot.unit), resolve(slot, s, false));
  }
  // 2) Demais: primeiro lugar livre.
  for (const slot of slots) {
    const key = placementKey(slot.item.id, slot.unit);
    if (byKey.has(key)) continue;
    const elevation = defaultElevation(slot.item);
    // Tapete vai para o meio do cômodo; o resto, para junto das paredes.
    const spot =
      slot.size.h <= 30
        ? { x: Math.max(0, Math.round((room.width - slot.size.w) / 2)), z: Math.max(0, Math.round((room.depth - slot.size.d) / 2)), rotation: 0 as Rotation }
        : findFreeSpot(slot.size, elevation, room, [...byKey.values()]);
    byKey.set(key, resolve(slot, { itemId: slot.item.id, unit: slot.unit, elevation, ...spot }, true));
  }
  return slots.map((slot) => byKey.get(placementKey(slot.item.id, slot.unit))!);
}

/**
 * Primeiro lugar livre ao longo das paredes para um móvel de medidas `size` na altura `elevation`.
 * Não sobrepõe móveis da mesma faixa de altura e, no piso, não bloqueia a abertura das portas.
 */
export function findFreeSpot(
  size: ResolvedPlacement['size'],
  elevation: number,
  room: RoomSettings,
  placed: ResolvedPlacement[],
): { x: number; z: number; rotation: Rotation } {
  const step = 10;
  const blockers = placed.filter((o) => !isFlat(o) && rangesOverlap(elevation, elevation + size.h, o.elevation, o.elevation + o.size.h));
  const doors = room.openings.filter((o) => o.kind === 'porta' && elevation < o.height).map((o) => doorSwingZone(o, room));
  const free = (x: number, z: number, fp: { w: number; d: number }) =>
    !blockers.some((o) => rangesOverlap(x, x + fp.w, o.x, o.x + o.footprint.w) && rangesOverlap(z, z + fp.d, o.z, o.z + o.footprint.d)) &&
    !doors.some((d) => rangesOverlap(x, x + fp.w, d.x, d.x + d.w) && rangesOverlap(z, z + fp.d, d.z, d.z + d.d));

  for (const wall of ['fundo', 'esquerda', 'direita', 'frente'] as WallSide[]) {
    const rotation = ROTATION_FOR_WALL[wall];
    const fp = footprintOf(size, rotation);
    const alongSize = wall === 'fundo' || wall === 'frente' ? fp.w : fp.d;
    if (fp.w > room.width || fp.d > room.depth) continue;
    for (let t = 0; t + alongSize <= wallLength(room, wall) + 0.5; t += step) {
      const x = wall === 'fundo' || wall === 'frente' ? t : wall === 'esquerda' ? 0 : room.width - fp.w;
      const z = wall === 'esquerda' || wall === 'direita' ? t : wall === 'fundo' ? 0 : room.depth - fp.d;
      if (free(x, z, fp)) return { x: Math.round(x), z: Math.round(z), rotation };
    }
  }
  // Sem espaço nas paredes: no meio do cômodo.
  return { x: Math.max(0, Math.round((room.width - size.w) / 2)), z: Math.max(0, Math.round((room.depth - size.d) / 2)), rotation: 0 };
}

const rangesOverlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 0.5;
const verticalOverlap = (a: ResolvedPlacement, b: ResolvedPlacement) =>
  rangesOverlap(a.elevation, a.elevation + a.size.h, b.elevation, b.elevation + b.size.h);
const planOverlap = (a: { x: number; z: number; footprint: { w: number; d: number } }, b: ResolvedPlacement) =>
  rangesOverlap(a.x, a.x + a.footprint.w, b.x, b.x + b.footprint.w) && rangesOverlap(a.z, a.z + a.footprint.d, b.z, b.z + b.footprint.d);

const round = (v: number, step = 10) => Math.round(v / step) * step || 0;

/**
 * Encaixa o móvel arrastado: `target` é o canto desejado (x, z) com a rotação atual.
 * - Perto de uma parede: encosta e gira para ficar de costas para ela (se `autoRotate`).
 * - Perto de um vizinho (na mesma faixa de altura): encosta lado a lado.
 * - Nunca sai do cômodo e, se cair em cima de outro móvel, vai para o lado livre mais próximo.
 */
export function snapPlacement(
  current: ResolvedPlacement,
  target: { x: number; z: number },
  room: RoomSettings,
  others: ResolvedPlacement[],
  autoRotate = true,
): { x: number; z: number; rotation: Rotation } {
  let rotation = current.rotation;
  let fp = footprintOf(current.size, rotation);
  const cx = target.x + fp.w / 2;
  const cz = target.z + fp.d / 2;
  let x = target.x;
  let z = target.z;

  // 1) Parede mais próxima (pelas bordas do móvel). Passar da parede conta como encostado nela.
  const distances: Array<[WallSide, number]> = [
    ['fundo', target.z],
    ['frente', room.depth - (target.z + fp.d)],
    ['esquerda', target.x],
    ['direita', room.width - (target.x + fp.w)],
  ];
  const [wall, dist] = distances.map(([w, d]): [WallSide, number] => [w, Math.max(0, d)]).reduce((a, b) => (b[1] < a[1] ? b : a));
  let snappedWall: WallSide | null = null;
  if (dist <= WALL_SNAP) {
    snappedWall = wall;
    if (autoRotate) rotation = ROTATION_FOR_WALL[wall];
    fp = footprintOf(current.size, rotation);
    // Ao longo da parede, perto de um canto, encaixa no canto.
    const toCorner = (v: number, size: number, total: number) => (v < WALL_SNAP ? 0 : total - (v + size) < WALL_SNAP ? total - size : round(v));
    if (wall === 'fundo' || wall === 'frente') {
      x = toCorner(cx - fp.w / 2, fp.w, room.width);
      z = wall === 'fundo' ? 0 : room.depth - fp.d;
    } else {
      z = toCorner(cz - fp.d / 2, fp.d, room.depth);
      x = wall === 'esquerda' ? 0 : room.width - fp.w;
    }
  } else {
    x = round(x);
    z = round(z);
  }

  // 2) Encosta nos vizinhos da mesma faixa de altura.
  const me = { ...current, rotation, footprint: fp };
  const neighbours = isFlat(current) ? [] : others.filter((o) => o.key !== current.key && !isFlat(o) && verticalOverlap(me, o));
  const snapTo = (value: number, candidates: number[]) => {
    let best = value;
    let bestDist = FURNITURE_SNAP;
    for (const c of candidates) if (Math.abs(c - value) <= bestDist) (best = c), (bestDist = Math.abs(c - value));
    return best;
  };
  const alongX = snappedWall !== 'esquerda' && snappedWall !== 'direita';
  const alongZ = snappedWall !== 'fundo' && snappedWall !== 'frente';
  if (alongX) {
    const inRow = neighbours.filter((o) => rangesOverlap(z, z + fp.d, o.z, o.z + o.footprint.d));
    x = snapTo(x, inRow.flatMap((o) => [o.x + o.footprint.w, o.x - fp.w, o.x, o.x + o.footprint.w - fp.w]));
  }
  if (alongZ) {
    const inCol = neighbours.filter((o) => rangesOverlap(x, x + fp.w, o.x, o.x + o.footprint.w));
    z = snapTo(z, inCol.flatMap((o) => [o.z + o.footprint.d, o.z - fp.d, o.z, o.z + o.footprint.d - fp.d]));
  }

  // 3) Dentro do cômodo.
  const clampIn = (v: number, size: number, total: number) => (size >= total ? 0 : Math.min(Math.max(v, 0), total - size));
  x = clampIn(x, fp.w, room.width);
  z = clampIn(z, fp.d, room.depth);

  // 4) Sem sobreposição: vai para o lado livre mais próximo do vizinho em que bateu.
  const collides = (xx: number, zz: number) => neighbours.some((o) => planOverlap({ x: xx, z: zz, footprint: fp }, o));
  if (collides(x, z)) {
    const options: Array<[number, number]> = [];
    for (const o of neighbours.filter((n) => planOverlap({ x, z, footprint: fp }, n))) {
      if (alongX) options.push([o.x + o.footprint.w, z], [o.x - fp.w, z]);
      if (alongZ) options.push([x, o.z + o.footprint.d], [x, o.z - fp.d]);
    }
    const valid = options.filter(([xx, zz]) => xx >= -0.5 && zz >= -0.5 && xx + fp.w <= room.width + 0.5 && zz + fp.d <= room.depth + 0.5 && !collides(xx, zz));
    if (valid.length) [x, z] = valid.reduce((a, b) => (Math.hypot(b[0] - x, b[1] - z) < Math.hypot(a[0] - x, a[1] - z) ? b : a));
  }

  return { x: Math.round(x), z: Math.round(z), rotation };
}

/** Faixa do piso que a porta precisa livre para abrir (quadrado da largura da folha). */
export function doorSwingZone(o: RoomOpening, room: RoomSettings): { x: number; z: number; w: number; d: number } {
  switch (o.wall) {
    case 'fundo':
      return { x: o.offset, z: 0, w: o.width, d: o.width };
    case 'frente':
      return { x: o.offset, z: room.depth - o.width, w: o.width, d: o.width };
    case 'esquerda':
      return { x: 0, z: o.offset, w: o.width, d: o.width };
    case 'direita':
      return { x: room.width - o.width, z: o.offset, w: o.width, d: o.width };
  }
}

/** Avisos do ambiente: sobreposição, porta bloqueada, móvel fora do cômodo ou acima do teto. */
export function roomWarnings(placements: ResolvedPlacement[], room: RoomSettings): string[] {
  const warnings: string[] = [];
  placements.forEach((a, i) => {
    if (a.x < -0.5 || a.z < -0.5 || a.x + a.footprint.w > room.width + 0.5 || a.z + a.footprint.d > room.depth + 0.5) {
      warnings.push(`"${a.name}" está fora do cômodo.`);
    }
    if (a.elevation + a.size.h > room.height + 0.5) warnings.push(`"${a.name}" passa da altura do teto (${room.height} mm).`);
    if (isFlat(a)) return;
    for (const b of placements.slice(i + 1)) {
      if (!isFlat(b) && planOverlap(a, b) && verticalOverlap(a, b)) warnings.push(`"${a.name}" e "${b.name}" estão sobrepostos.`);
    }
    for (const o of room.openings) {
      if (o.kind !== 'porta' || a.elevation >= o.height) continue;
      const zone = doorSwingZone(o, room);
      if (rangesOverlap(a.x, a.x + a.footprint.w, zone.x, zone.x + zone.w) && rangesOverlap(a.z, a.z + a.footprint.d, zone.z, zone.z + zone.d)) {
        warnings.push(`"${a.name}" bloqueia a abertura da porta (${WALL_LABELS[o.wall].toLowerCase()}).`);
      }
    }
  });
  return warnings;
}

/** Transformação 3D de um móvel no cômodo (centro da projeção, rotação e deslocamento das peças). */
export function placementTransform(p: ResolvedPlacement) {
  return {
    /** Centro da projeção no piso e altura da base (mm). */
    position: { x: p.x + p.footprint.w / 2, y: p.elevation, z: p.z + p.footprint.d / 2 },
    /** Rotação em torno de Y (rad): 90° leva a frente do móvel (+Z) para +X. */
    rotationY: (p.rotation * Math.PI) / 180,
    /** Deslocamento aplicado às peças (sistema do móvel) para centralizá-las no pivô. */
    pieceOffset: { x: -(p.origin.x + p.size.w / 2), y: -p.origin.y, z: -(p.origin.z + p.size.d / 2) },
  };
}

// ---------------------------------------------------------------------------
// Pontos de vista para as imagens do ambiente
// ---------------------------------------------------------------------------

export interface Viewpoint {
  id: string;
  label: string;
  /** Posição da câmera e ponto observado, em mm do cômodo (x, altura, z). */
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
  /** Câmera dentro do cômodo (paredes opacas). */
  inside: boolean;
}

/** Altura dos olhos de uma pessoa em pé (mm). */
export const EYE_HEIGHT = 1600;

/**
 * Pontos de vista prontos: visão geral e de cima (por fora), um de cada parede olhando para a
 * oposta, dos quatro cantos e de cada porta — todos na altura dos olhos.
 */
export function roomViewpoints(room: RoomSettings): Viewpoint[] {
  const { width: W, depth: D, height: H } = room;
  const S = Math.max(W, D, H);
  const c = { x: W / 2, y: H / 3, z: D / 2 };
  const eye = Math.min(EYE_HEIGHT, H - 200);
  const inset = 250;
  const look = 1000;
  const views: Viewpoint[] = [
    { id: 'geral', label: 'Visão geral (por fora)', position: { x: W / 2 + S * 0.35, y: S * 1.05, z: D / 2 + S * 1.25 }, target: c, fov: 40, inside: false },
    { id: 'cima', label: 'De cima', position: { x: W / 2, y: S * 2.1, z: D / 2 + 1 }, target: { x: W / 2, y: 0, z: D / 2 }, fov: 45, inside: false },
    { id: 'olha-fundo', label: 'Olhando para a parede do fundo', position: { x: W / 2, y: eye, z: D - inset }, target: { x: W / 2, y: look, z: 0 }, fov: 65, inside: true },
    { id: 'olha-frente', label: 'Olhando para a parede da frente', position: { x: W / 2, y: eye, z: inset }, target: { x: W / 2, y: look, z: D }, fov: 65, inside: true },
    { id: 'olha-esquerda', label: 'Olhando para a parede esquerda', position: { x: W - inset, y: eye, z: D / 2 }, target: { x: 0, y: look, z: D / 2 }, fov: 65, inside: true },
    { id: 'olha-direita', label: 'Olhando para a parede direita', position: { x: inset, y: eye, z: D / 2 }, target: { x: W, y: look, z: D / 2 }, fov: 65, inside: true },
    { id: 'canto-fe', label: 'Do canto frente-esquerda', position: { x: inset, y: eye, z: D - inset }, target: { x: W - inset, y: look, z: inset }, fov: 70, inside: true },
    { id: 'canto-fd', label: 'Do canto frente-direita', position: { x: W - inset, y: eye, z: D - inset }, target: { x: inset, y: look, z: inset }, fov: 70, inside: true },
    { id: 'canto-te', label: 'Do canto fundo-esquerda', position: { x: inset, y: eye, z: inset }, target: { x: W - inset, y: look, z: D - inset }, fov: 70, inside: true },
    { id: 'canto-td', label: 'Do canto fundo-direita', position: { x: W - inset, y: eye, z: inset }, target: { x: inset, y: look, z: D - inset }, fov: 70, inside: true },
  ];
  room.openings
    .filter((o) => o.kind === 'porta')
    .forEach((o, i) => {
      const along = o.offset + o.width / 2;
      const position =
        o.wall === 'fundo'
          ? { x: along, y: eye, z: 400 }
          : o.wall === 'frente'
            ? { x: along, y: eye, z: D - 400 }
            : o.wall === 'esquerda'
              ? { x: 400, y: eye, z: along }
              : { x: W - 400, y: eye, z: along };
      views.push({ id: `porta-${o.id}`, label: `Entrando pela porta ${i + 1} (${WALL_LABELS[o.wall].toLowerCase()})`, position, target: { x: W / 2, y: look, z: D / 2 }, fov: 70, inside: true });
    });
  return views;
}

/** Ponto de vista personalizado: em pé no ponto (x, z) da planta, olhando para (tx, tz). */
export function customViewpoint(room: RoomSettings, from: { x: number; z: number }, to: { x: number; z: number }): Viewpoint {
  const eye = Math.min(EYE_HEIGHT, room.height - 200);
  return {
    id: 'personalizado',
    label: 'Ponto de vista personalizado',
    position: { x: from.x, y: eye, z: from.z },
    target: { x: to.x, y: 1000, z: to.z },
    fov: 65,
    inside: from.x > 0 && from.x < room.width && from.z > 0 && from.z < room.depth,
  };
}

let openingSeq = 0;
export const newOpeningId = () => `ab${Date.now().toString(36)}${(openingSeq++).toString(36)}`;

/** Versão do móvel com outra rotação (projeção recalculada). */
const withRotation = (p: ResolvedPlacement, rotation: Rotation): ResolvedPlacement => ({ ...p, rotation, footprint: footprintOf(p.size, rotation) });

/** Gira o móvel 90° em torno do próprio centro e reencaixa (sem girar de novo para a parede). */
export function rotatePlacement(p: ResolvedPlacement, room: RoomSettings, others: ResolvedPlacement[], direction: 1 | -1 = 1) {
  const rotation = (((p.rotation + direction * 90) % 360) + 360) % 360 as Rotation;
  const turned = withRotation(p, rotation);
  const cx = p.x + p.footprint.w / 2;
  const cz = p.z + p.footprint.d / 2;
  return snapPlacement(turned, { x: cx - turned.footprint.w / 2, z: cz - turned.footprint.d / 2 }, room, others, false);
}

/** Encosta o móvel numa parede escolhida, de costas para ela, mantendo a posição ao longo da parede. */
export function moveToWall(p: ResolvedPlacement, wall: WallSide, room: RoomSettings, others: ResolvedPlacement[]) {
  const turned = withRotation(p, ROTATION_FOR_WALL[wall]);
  const cx = p.x + p.footprint.w / 2;
  const cz = p.z + p.footprint.d / 2;
  const fp = turned.footprint;
  const target =
    wall === 'fundo'
      ? { x: cx - fp.w / 2, z: 0 }
      : wall === 'frente'
        ? { x: cx - fp.w / 2, z: room.depth - fp.d }
        : wall === 'esquerda'
          ? { x: 0, z: cz - fp.d / 2 }
          : { x: room.width - fp.w, z: cz - fp.d / 2 };
  return snapPlacement(turned, target, room, others, false);
}

// ---------------------------------------------------------------------------
// União entre módulos vizinhos
// ---------------------------------------------------------------------------

export interface ModuleConnection {
  a: ResolvedPlacement;
  b: ResolvedPlacement;
  /** Parafusos de união entre os dois módulos. */
  connectors: number;
}

/**
 * Módulos encostados lado a lado (laterais se tocando, mesma faixa de altura) devem ser unidos
 * entre si com parafusos de união: 4 por par (2 em cima, 2 embaixo), ou 2 em módulos baixos.
 */
export function moduleConnections(placements: ResolvedPlacement[]): ModuleConnection[] {
  const out: ModuleConnection[] = [];
  const touch = (a0: number, a1: number, b0: number, b1: number) => Math.abs(a1 - b0) <= 2 || Math.abs(b1 - a0) <= 2;
  // Só módulos de caixa se unem entre si (camas, mesas e objetos ficam de fora).
  const eligible = placements.filter((p) => templateKind(p.templateId) === 'carcass');
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i]!;
      const b = eligible[j]!;
      const vertical = Math.min(a.elevation + a.size.h, b.elevation + b.size.h) - Math.max(a.elevation, b.elevation);
      if (vertical < 200) continue;
      const sideBySide =
        (touch(a.x, a.x + a.footprint.w, b.x, b.x + b.footprint.w) &&
          Math.min(a.z + a.footprint.d, b.z + b.footprint.d) - Math.max(a.z, b.z) >= 100) ||
        (touch(a.z, a.z + a.footprint.d, b.z, b.z + b.footprint.d) &&
          Math.min(a.x + a.footprint.w, b.x + b.footprint.w) - Math.max(a.x, b.x) >= 100);
      if (sideBySide) out.push({ a, b, connectors: vertical >= 600 ? 4 : 2 });
    }
  }
  return out;
}

/** Item da lista de compras para unir os módulos do ambiente. */
export function connectorHardware(connections: ModuleConnection[]): HardwareItem[] {
  const qty = connections.reduce((n, c) => n + c.connectors, 0);
  if (!qty) return [];
  const name = 'Parafuso de união para módulos';
  const specification = 'Conector Ø5 × 30 mm (macho e fêmea)';
  return [
    {
      id: `fixacao:${name}:${specification}`,
      category: 'fixacao',
      name,
      specification,
      quantity: qty,
      unit: 'un',
      application: `Unir ${connections.length} par(es) de módulos vizinhos no ambiente`,
    },
  ];
}
