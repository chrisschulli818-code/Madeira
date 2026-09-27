import { describe, expect, it } from 'vitest';
import { buildItemResults } from '../projectEngine';
import { createItem, parseItem } from '../projectFile';
import { buildModel } from '../cabinetEngine';
import { buildBed } from '../bedEngine';
import { computeMotions, distanceMm, instanceRef, snapToBox, type DoorMotion, type DrawerMotion } from '../motionEngine';
import { defaultItemParams } from '../templates';
import type { BedParams, CabinetParams } from '@/types/woodcraft';

const modelOf = (id: Parameters<typeof createItem>[0]) => buildItemResults([createItem(id)])[0]!.model;

describe('portas e gavetas que abrem', () => {
  it('balcão: uma porta por folha e cada gaveta leva a própria caixa', () => {
    const m = modelOf('base-cabinet');
    const motions = computeMotions(m);
    const doors = motions.filter((x): x is DoorMotion => x.kind === 'door');
    const drawers = motions.filter((x): x is DrawerMotion => x.kind === 'drawer');
    expect(doors.length).toBe(m.doors.length);
    expect(drawers.length).toBe(m.drawers.length);
    for (const d of drawers) {
      // frente + 2 laterais + contra-frente + traseira + fundo
      expect(d.parts.length).toBe(6);
      expect(d.axis).toBe('z');
      expect(d.dir).toBe(1);
      expect(d.travel).toBeGreaterThan(200);
    }
    // Cada unidade de peça pertence a no máximo um movimento.
    const all = motions.flatMap((x) => x.parts);
    expect(new Set(all).size).toBe(all.length);
  });

  it('porta com dobradiça à esquerda gira para fora (+Z) pela borda esquerda', () => {
    const p = { ...(defaultItemParams('wall-cabinet').params as CabinetParams) };
    p.columns = [{ id: 'c', widthRatio: 1, drawers: 0, doors: 2, shelves: 1, hangingRod: false }];
    const m = buildModel({ templateId: 'wall-cabinet', params: p });
    const doors = computeMotions(m).filter((x): x is DoorMotion => x.kind === 'door');
    expect(doors).toHaveLength(2);
    const [left, right] = [...doors].sort((a, b) => a.pivot.x - b.pivot.x);
    // θ negativo em Y leva +X para +Z (para fora) na folha da esquerda; positivo na da direita.
    expect(left!.sign).toBe(-1);
    expect(right!.sign).toBe(1);
    expect(left!.pivot.x).toBeLessThan(10);
    expect(right!.pivot.x).toBeGreaterThan(m.overall.width - 10);
    expect(left!.pivot.z).toBeGreaterThan(m.overall.depth - 1);
  });

  it('gavetões da cama abrem para os lados (eixo X)', () => {
    const m = buildBed({ ...(defaultItemParams('bed').params as BedParams), deckHeight: 400, drawersPerSide: 1, drawerSides: 'ambos' });
    const drawers = computeMotions(m).filter((x): x is DrawerMotion => x.kind === 'drawer');
    expect(drawers).toHaveLength(2);
    expect(drawers.every((d) => d.axis === 'x' && d.parts.length === 6)).toBe(true);
    expect(new Set(drawers.map((d) => d.dir))).toEqual(new Set([1, -1]));
  });

  it('gaveteiro da escrivaninha abre; móvel sem frentes não tem movimentos', () => {
    expect(computeMotions(modelOf('desk')).filter((x) => x.kind === 'drawer')).toHaveLength(3);
    expect(computeMotions(modelOf('bookshelf')).length).toBeGreaterThanOrEqual(0);
    expect(computeMotions(modelOf('workbench'))).toHaveLength(0);
  });

  it('cômoda: gavetas empilhadas não trocam caixas entre si', () => {
    const m = modelOf('dresser');
    const drawers = computeMotions(m).filter((x): x is DrawerMotion => x.kind === 'drawer');
    expect(drawers).toHaveLength(4);
    const boxY = new Map(m.pieces.flatMap((p) => p.instances.map((b, i) => [instanceRef(p.id, i), b] as const)));
    for (const d of drawers) {
      const [front, ...rest] = d.parts.map((r) => boxY.get(r)!);
      for (const b of rest) {
        expect(b.y).toBeGreaterThanOrEqual(front!.y - 60);
        expect(b.y + b.h).toBeLessThanOrEqual(front!.y + front!.h + 1);
      }
    }
  });
});

describe('marcações', () => {
  it('distância e encaixe nos cantos da peça', () => {
    expect(distanceMm({ x: 0, y: 0, z: 0 }, { x: 300, y: 400, z: 0 })).toBe(500);
    const box = { x: 0, y: 0, z: 0, w: 600, h: 18, d: 500 };
    expect(snapToBox({ x: 8, y: 9, z: 493 }, box)).toEqual({ x: 0, y: 0, z: 500 });
    expect(snapToBox({ x: 300.4, y: 9, z: 250 }, box)).toEqual({ x: 300, y: 0, z: 250 });
  });

  it('arquivo preserva notas e medidas e descarta marcações inválidas', () => {
    const raw = {
      ...JSON.parse(JSON.stringify(createItem('base-cabinet'))),
      notes: [
        { id: 'a', kind: 'nota', text: 'Furo p/ cano', a: { x: 100, y: 200, z: 0 } },
        { id: 'b', kind: 'medida', text: '', a: { x: 0, y: 0, z: 0 }, b: { x: 0, y: 870, z: 0 } },
        { id: 'c', kind: 'medida', a: { x: 0, y: 0, z: 0 } },
        { id: 'd', kind: 'nota', a: { x: 'x' } },
        'lixo',
      ],
    };
    const item = parseItem(raw)!;
    expect(item.notes).toHaveLength(2);
    expect(item.notes![0]).toMatchObject({ kind: 'nota', text: 'Furo p/ cano' });
    expect(item.notes![1]!.b).toEqual({ x: 0, y: 870, z: 0 });
  });
});
