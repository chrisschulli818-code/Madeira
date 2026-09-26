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
  ProjectItem,
  ResolvedPlacement,
  RoomOpening,
  RoomSettings,
  Rotation,
  WallSide,
} from '@/types/woodcraft';

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

/** Móvel que fica pendurado na parede por padrão. */
const isWallMounted = (item: ProjectItem) => item.templateId === 'wall-cabinet';

/**
 * Posições de todas as unidades de móveis do projeto. As que o usuário já posicionou
 * vêm de `saved`; as demais são distribuídas automaticamente: móveis de piso ao longo da
 * parede do fundo e depois da parede esquerda; aéreos na parede do fundo a 1500 mm do piso.
 */
export function resolvePlacements(
  entries: Array<{ item: ProjectItem; model: AssembledModel }>,
  room: RoomSettings,
  saved: FurniturePlacement[],
): ResolvedPlacement[] {
  const savedByKey = new Map(saved.map((p) => [placementKey(p.itemId, p.unit), p]));
  const out: ResolvedPlacement[] = [];
  let floorX = 0;
  let wallX = 0;
  let leftZ: number | null = null;

  for (const { item, model } of entries) {
    const { size, origin } = furnitureExtent(model);
    const units = Math.max(1, Math.floor(item.quantity || 1));
    for (let unit = 0; unit < units; unit++) {
      const key = placementKey(item.id, unit);
      const s = savedByKey.get(key);
      let placement: FurniturePlacement;
      if (s) {
        placement = s;
      } else if (isWallMounted(item)) {
        placement = { itemId: item.id, unit, x: Math.min(wallX, Math.max(0, room.width - size.w)), z: 0, rotation: 0, elevation: WALL_CABINET_ELEVATION };
        wallX += size.w;
      } else if (floorX + size.w <= room.width) {
        placement = { itemId: item.id, unit, x: floorX, z: 0, rotation: 0, elevation: 0 };
        floorX += size.w;
      } else {
        // Parede do fundo cheia: continua pela parede esquerda (girado 90°), abaixo do que já está no canto.
        if (leftZ === null) leftZ = Math.max(0, ...out.filter((p) => p.elevation === 0 && p.x < 1).map((p) => p.z + p.footprint.d));
        const fp = footprintOf(size, 90);
        placement = { itemId: item.id, unit, x: 0, z: Math.min(leftZ, Math.max(0, room.depth - fp.d)), rotation: 90, elevation: 0 };
        leftZ += fp.d;
      }
      const footprint = footprintOf(size, placement.rotation);
      out.push({
        ...placement,
        key,
        name: units > 1 ? `${item.name} (${unit + 1})` : item.name,
        templateId: item.templateId,
        size,
        origin,
        footprint,
        wall: wallOf(placement, footprint, room),
        auto: !s,
      });
    }
  }
  return out;
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
  const neighbours = others.filter((o) => o.key !== current.key && verticalOverlap(me, o));
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
    for (const b of placements.slice(i + 1)) {
      if (planOverlap(a, b) && verticalOverlap(a, b)) warnings.push(`"${a.name}" e "${b.name}" estão sobrepostos.`);
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
