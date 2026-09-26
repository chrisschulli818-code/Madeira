import { describe, expect, it } from 'vitest';
import { buildItemResults } from '../projectEngine';
import { createItem } from '../projectFile';
import {
  DEFAULT_ROOM,
  furnitureExtent,
  moveToWall,
  placementTransform,
  rotatePlacement,
  resolvePlacements,
  roomWarnings,
  snapPlacement,
  WALL_CABINET_ELEVATION,
} from '../roomEngine';
import type { ProjectItem, RoomSettings } from '@/types/woodcraft';

const room: RoomSettings = { ...DEFAULT_ROOM, openings: [] };

function setup(items: ProjectItem[], r = room) {
  const results = buildItemResults(items);
  return { results, placements: resolvePlacements(results, r, []) };
}

describe('posições automáticas', () => {
  it('móveis de piso lado a lado na parede do fundo; aéreo pendurado a 1500 mm', () => {
    const { placements } = setup([{ ...createItem('base-cabinet'), quantity: 2 }, createItem('wall-cabinet')]);
    const [a, b, w] = placements;
    expect(a).toMatchObject({ x: 0, z: 0, rotation: 0, elevation: 0, wall: 'fundo', auto: true });
    expect(b!.x).toBeCloseTo(a!.footprint.w);
    expect(w).toMatchObject({ x: 0, rotation: 0, elevation: WALL_CABINET_ELEVATION, wall: 'fundo' });
    // Profundidade inclui as frentes (18 mm) além da caixa de 560 mm
    expect(a!.size.d).toBe(560 + 18);
  });

  it('quando a parede do fundo enche, continua pela esquerda, girado', () => {
    const { placements } = setup([{ ...createItem('base-cabinet'), quantity: 6 }]);
    const turned = placements.filter((p) => p.rotation === 90);
    expect(turned.length).toBeGreaterThan(0);
    expect(turned[0]).toMatchObject({ x: 0, wall: 'esquerda' });
    expect(roomWarnings(placements, room).filter((w) => w.includes('sobrepostos'))).toHaveLength(0);
  });


  it('móvel novo vai para um lugar livre, sem cair em cima dos que o usuário já posicionou', () => {
    const a = createItem('base-cabinet');
    const b = createItem('base-cabinet');
    const results = buildItemResults([a, b]);
    // O primeiro foi arrastado para o canto esquerdo do fundo; o segundo é novo.
    const placements = resolvePlacements(results, room, [{ itemId: a.id, unit: 0, x: 0, z: 0, rotation: 0, elevation: 0 }]);
    expect(placements[1]!.x).toBeGreaterThanOrEqual(placements[0]!.footprint.w);
    expect(roomWarnings(placements, room)).toHaveLength(0);
  });

  it('não coloca móvel na frente da porta', () => {
    const r: RoomSettings = { ...room, openings: [{ id: 'p', kind: 'porta', wall: 'fundo', offset: 0, width: 800, height: 2100, sill: 0 }] };
    const { placements } = setup([createItem('base-cabinet')], r);
    expect(placements[0]!.x).toBeGreaterThanOrEqual(800);
    expect(roomWarnings(placements, r)).toHaveLength(0);
  });
});

describe('encaixe ao arrastar', () => {
  it('perto da parede direita: encosta e gira para ficar de costas para ela', () => {
    const { placements } = setup([createItem('base-cabinet')]);
    const p = placements[0]!;
    const r = snapPlacement(p, { x: room.width - p.footprint.w - 80, z: 1200 }, room, placements);
    expect(r.rotation).toBe(270);
    // Girado, a projeção passa a ter a profundidade no eixo X
    expect(r.x).toBe(room.width - p.size.d);
  });

  it('encosta lado a lado no vizinho da mesma parede', () => {
    const { placements } = setup([createItem('base-cabinet'), createItem('base-cabinet')]);
    const [a, b] = placements;
    // Arrasta o segundo para 1 m à direita e depois de volta, a 40 mm do primeiro
    const r = snapPlacement(b!, { x: a!.footprint.w + 40, z: 0 }, room, placements);
    expect(r.x).toBe(a!.footprint.w);
  });

  it('não sobrepõe: solto em cima do vizinho, vai para o lado livre', () => {
    const { placements } = setup([createItem('base-cabinet'), createItem('base-cabinet')]);
    const [a, b] = placements;
    const r = snapPlacement(b!, { x: a!.x + 100, z: 0 }, room, placements);
    expect(r.x).toBe(a!.x + a!.footprint.w);
  });

  it('aéreo passa por cima do balcão (alturas diferentes não colidem)', () => {
    const { placements } = setup([createItem('base-cabinet'), createItem('wall-cabinet')]);
    const wall = placements[1]!;
    const r = snapPlacement(wall, { x: 50, z: 0 }, room, placements);
    expect(r).toMatchObject({ x: 0, z: 0, rotation: 0 });
  });

  it('solto além da parede: encosta nela (não em outra parede)', () => {
    const { placements } = setup([createItem('wardrobe')]);
    const p = placements[0]!;
    const r = snapPlacement(p, { x: room.width + 900, z: 1400 }, room, placements);
    expect(r.rotation).toBe(270);
    expect(r.x).toBe(room.width - p.size.d);
  });

  it('nunca sai do cômodo', () => {
    const { placements } = setup([createItem('base-cabinet')]);
    const r = snapPlacement(placements[0]!, { x: 99999, z: 99999 }, room, placements);
    expect(r.x + (r.rotation % 180 ? placements[0]!.size.d : placements[0]!.size.w)).toBeLessThanOrEqual(room.width);
  });
});

describe('avisos e transformação', () => {
  it('porta bloqueada e sobreposição', () => {
    const r: RoomSettings = { ...room, openings: [{ id: 'p', kind: 'porta', wall: 'fundo', offset: 0, width: 800, height: 2100, sill: 0 }] };
    const item = createItem('base-cabinet');
    // Usuário arrastou o balcão para a frente da porta
    const placements = resolvePlacements(buildItemResults([item]), r, [{ itemId: item.id, unit: 0, x: 0, z: 0, rotation: 0, elevation: 0 }]);
    const w = roomWarnings(placements, r);
    expect(w.some((x) => x.includes('bloqueia a abertura da porta'))).toBe(true);
    const dup = [placements[0]!, { ...placements[0]!, key: 'x', name: 'Cópia' }];
    expect(roomWarnings(dup, room).some((x) => x.includes('sobrepostos'))).toBe(true);
  });

  it('transformação 3D centraliza as peças e gira a frente para +X a 90°', () => {
    const { results, placements } = setup([createItem('base-cabinet')]);
    const p = { ...placements[0]!, rotation: 90 as const, footprint: { w: placements[0]!.size.d, d: placements[0]!.size.w } };
    const t = placementTransform(p);
    expect(t.rotationY).toBeCloseTo(Math.PI / 2);
    expect(t.position.x).toBeCloseTo(p.x + p.size.d / 2);
    const ext = furnitureExtent(results[0]!.model);
    expect(t.pieceOffset.z).toBeCloseTo(-(ext.origin.z + ext.size.d / 2));
  });
});

describe('girar e encostar na parede', () => {
  it('girar 90° mantém o centro e troca as medidas da projeção', () => {
    const { placements } = setup([createItem('base-cabinet')]);
    const p = { ...placements[0]!, x: 1500, z: 1000, wall: null };
    const r = rotatePlacement(p, room, placements.map((q) => ({ ...q, key: 'outro' })).slice(0, 0));
    expect(r.rotation).toBe(90);
    expect(r.x + p.size.d / 2).toBeCloseTo(1500 + p.size.w / 2, -1);
  });

  it('encostar na parede esquerda deixa as costas em x = 0, girado 90°', () => {
    const { placements } = setup([createItem('base-cabinet')]);
    const r = moveToWall({ ...placements[0]!, x: 1500, z: 1000 }, 'esquerda', room, []);
    expect(r).toMatchObject({ x: 0, rotation: 90 });
  });
});
