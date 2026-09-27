import { describe, expect, it } from 'vitest';
import { buildModel } from '../cabinetEngine';
import { buildBed } from '../bedEngine';
import { buildProp, PROP_CATALOG } from '../propEngine';
import { buildItemResults, projectHardware, projectPieces, producible } from '../projectEngine';
import { createItem, DEFAULT_MATERIALS, parseItem } from '../projectFile';
import { computeJoinery } from '../joineryEngine';
import { customViewpoint, DEFAULT_ROOM, resolvePlacements, roomViewpoints } from '../roomEngine';
import { defaultItemParams, TEMPLATE_LIST, TEMPLATES } from '../templates';
import type { BedParams, ProjectItem, PropParams } from '@/types/woodcraft';

const bedParams = () => defaultItemParams('bed').params as BedParams;

describe('novos modelos', () => {
  it('todos os modelos da lista geram peças sem avisos', () => {
    for (const t of TEMPLATE_LIST.filter((t) => t.id !== 'custom')) {
      const item = createItem(t.id);
      const [r] = buildItemResults([item]);
      expect(r!.model.pieces.length, t.id).toBeGreaterThan(0);
      expect(r!.model.warnings, t.id).toEqual([]);
    }
  });

  it('objetos do ambiente ficam fora da lista de modelos', () => {
    expect(TEMPLATE_LIST.some((t) => t.id === 'prop')).toBe(false);
    expect(TEMPLATES.prop.kind).toBe('prop');
  });

  it('criado-mudo e cômoda têm gavetas', () => {
    expect(buildItemResults([createItem('nightstand')])[0]!.model.drawers.length).toBe(2);
    expect(buildItemResults([createItem('dresser')])[0]!.model.drawers.length).toBe(4);
  });
});

describe('cama', () => {
  it('estrutura envolve o colchão com folga e o colchão é decorativo', () => {
    const p = bedParams();
    const m = buildBed(p);
    expect(m.templateId).toBe('bed');
    expect(m.overall.width).toBeGreaterThan(p.mattressWidth);
    expect(m.overall.depth).toBeGreaterThan(p.mattressLength);
    const mattress = m.pieces.find((x) => x.decorative);
    expect(mattress?.name).toMatch(/Colch/);
    expect(m.pieces.some((x) => x.role === 'headboard')).toBe(true);
    expect(m.pieces.find((x) => x.name === 'Lateral da cama')?.quantity).toBe(2);
  });

  it('colchão não entra na lista de corte nem na furação', () => {
    const results = buildItemResults([createItem('bed')]);
    const pieces = projectPieces(results);
    expect(pieces.some((p) => /Colch/.test(p.name))).toBe(false);
    const mattress = results[0]!.model.pieces.find((p) => p.decorative)!;
    const plan = computeJoinery(results[0]!.model);
    expect(plan.ops.length).toBeGreaterThan(0);
    expect(plan.ops.some((o) => o.pieceId === mattress.id)).toBe(false);
  });

  it('cama grande ganha travessa central; estrado em chapa vira uma peça', () => {
    const king = buildBed({ ...bedParams(), mattressWidth: 1930, mattressLength: 2030 });
    expect(king.pieces.some((x) => /Travessa/.test(x.name))).toBe(true);
    const chapa = buildBed({ ...bedParams(), deck: 'chapa' });
    expect(chapa.pieces.filter((x) => x.role === 'slat').length).toBeGreaterThan(0);
    expect(chapa.pieces.some((x) => /[Rr]ipa/.test(x.name))).toBe(false);
  });

  it('estrado apoia nos sarrafos e não é preso na cabeceira', () => {
    const plan = computeJoinery(buildItemResults([createItem('bed')])[0]!.model);
    const titles = plan.steps.map((st) => st.title);
    expect(titles.some((t) => /ripa/i.test(t) && /sarrafo/i.test(t))).toBe(true);
    expect(titles.some((t) => /(cabeceira|peseira)/i.test(t) && /ripa/i.test(t))).toBe(false);
    expect(plan.steps.at(-1)!.detail).toMatch(/colchão/);
  });

  it('ferragens de cama', () => {
    const results = buildItemResults([createItem('bed')]);
    const hw = projectHardware(results, projectPieces(results), DEFAULT_MATERIALS);
    expect(hw.some((h) => /cama/i.test(h.name))).toBe(true);
  });
});

describe('objetos do ambiente', () => {
  const sofa = (): ProjectItem => {
    const item = createItem('prop');
    const info = PROP_CATALOG.find((p) => p.type === 'sofa')!;
    return { ...item, name: info.label, params: { type: 'sofa', width: info.width, height: info.height, depth: info.depth, color: info.color } } as ProjectItem;
  };

  it('todas as peças são decorativas e coloridas', () => {
    for (const info of PROP_CATALOG) {
      const m = buildProp({ type: info.type, width: info.width, height: info.height, depth: info.depth, color: info.color } as PropParams);
      expect(m.pieces.length, info.type).toBeGreaterThan(0);
      expect(m.pieces.every((p) => p.decorative && p.color), info.type).toBe(true);
      expect(m.overall.width).toBe(info.width);
    }
  });

  it('não entram na produção (corte, ferragens), mas aparecem no ambiente', () => {
    const results = buildItemResults([createItem('base-cabinet'), sofa()]);
    expect(producible(results)).toHaveLength(1);
    expect(projectPieces(results).every((p) => p.itemId !== results[1]!.item.id)).toBe(true);
    const placements = resolvePlacements(results, { ...DEFAULT_ROOM, openings: [] }, []);
    expect(placements).toHaveLength(2);
  });

  it('TV fica na altura da parede; tapete fica no centro do piso', () => {
    const tv = { ...createItem('prop'), params: { type: 'tv', width: 1250, height: 720, depth: 60, color: '#141414' } } as ProjectItem;
    const rug = { ...createItem('prop'), params: { type: 'tapete', width: 2000, height: 10, depth: 1400, color: '#b9a88f' } } as ProjectItem;
    const room = { ...DEFAULT_ROOM, openings: [] };
    const placements = resolvePlacements(buildItemResults([tv, rug]), room, []);
    expect(placements[0]!.elevation).toBe(900);
    const r = placements[1]!;
    expect(r.x + r.footprint.w / 2).toBeCloseTo(room.width / 2, -1);
    expect(r.z + r.footprint.d / 2).toBeCloseTo(room.depth / 2, -1);
  });

  it('arquivo do projeto preserva cama e objetos', () => {
    const bed = parseItem(JSON.parse(JSON.stringify(createItem('bed'))));
    const prop = parseItem(JSON.parse(JSON.stringify(sofa())));
    expect(bed?.templateId).toBe('bed');
    expect((bed!.params as BedParams).mattressWidth).toBe(bedParams().mattressWidth);
    expect((prop!.params as PropParams).type).toBe('sofa');
    // Cor inválida volta para a do catálogo.
    const bad = parseItem({ ...JSON.parse(JSON.stringify(sofa())), params: { type: 'sofa', width: 2000, height: 850, depth: 900, color: 'red' } });
    expect((bad!.params as PropParams).color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('pontos de vista', () => {
  const room = { ...DEFAULT_ROOM, width: 4000, depth: 3000, height: 2700 };

  it('vistas de dentro ficam dentro do cômodo, na altura dos olhos', () => {
    const views = roomViewpoints(room);
    const inside = views.filter((v) => v.inside);
    expect(inside.length).toBeGreaterThanOrEqual(8);
    for (const v of inside) {
      expect(v.position.x).toBeGreaterThan(0);
      expect(v.position.x).toBeLessThan(room.width);
      expect(v.position.z).toBeGreaterThan(0);
      expect(v.position.z).toBeLessThan(room.depth);
      expect(v.position.y).toBe(1600);
    }
    expect(new Set(views.map((v) => v.id)).size).toBe(views.length);
  });

  it('uma vista para cada porta', () => {
    const doors = room.openings.filter((o) => o.kind === 'porta').length;
    expect(roomViewpoints(room).filter((v) => v.id.startsWith('porta')).length).toBe(doors);
  });

  it('ponto personalizado olha do ponto escolhido para o alvo', () => {
    const v = customViewpoint(room, { x: 500, z: 2500 }, { x: 3500, z: 200 });
    expect(v.position).toMatchObject({ x: 500, z: 2500 });
    expect(v.target).toMatchObject({ x: 3500, z: 200 });
    expect(v.inside).toBe(true);
  });
});

describe('modelos existentes continuam iguais', () => {
  it('escrivaninha usa o motor de bancada', () => {
    const m = buildModel(defaultItemParams('desk') as never);
    expect(m.templateId).toBe('desk');
    expect(m.pieces.length).toBeGreaterThan(0);
  });
});

describe('gavetas em todos os móveis', () => {
  const desk = (patch: Record<string, unknown> = {}) => {
    const d = defaultItemParams('desk');
    return buildModel({ templateId: 'desk', params: { ...(d.params as object), ...patch } } as never);
  };

  it('escrivaninha vem com gaveteiro de 3 gavetas com corrediça', () => {
    const m = desk();
    expect(m.drawers).toHaveLength(3);
    expect(m.drawers.every((d) => d.runner !== 'rodizio' && [250, 300, 350, 400, 450, 500, 550].includes(d.slideLength))).toBe(true);
    expect(m.pieces.some((p) => p.name === 'Divisória do gaveteiro')).toBe(true);
    expect(m.warnings).toEqual([]);
  });

  it('gaveteiro fica dentro dos painéis, sem sobrepor peças da estrutura', () => {
    for (const pedestal of ['left', 'right'] as const) {
      const m = desk({ pedestal, pedestalDrawers: 4 });
      const boxes = m.pieces.filter((p) => p.role === 'drawer-side').flatMap((p) => p.instances);
      const legs = m.pieces.find((p) => p.role === 'leg-panel')!.instances;
      const div = m.pieces.find((p) => p.name === 'Divisória do gaveteiro')!.instances[0]!;
      for (const b of boxes) {
        const between = pedestal === 'left' ? [legs[0]!.x + legs[0]!.w, div.x] : [div.x + div.w, legs[1]!.x];
        expect(b.x).toBeGreaterThanOrEqual(between[0]!);
        expect(b.x + b.w).toBeLessThanOrEqual(between[1]!);
        expect(b.y + b.h).toBeLessThanOrEqual(m.overall.height);
      }
      expect(m.drawers).toHaveLength(4);
    }
  });

  it('sem gaveteiro, mesa não tem gavetas; hardware traz corrediças do gaveteiro', () => {
    expect(desk({ pedestal: 'none' }).drawers).toHaveLength(0);
    const item = { ...createItem('desk') };
    const results = buildItemResults([item]);
    const hw = projectHardware(results, projectPieces(results), DEFAULT_MATERIALS);
    expect(hw.find((h) => h.name === 'Corrediça telescópica')?.quantity).toBe(3);
  });

  it('cama com gavetões: frentes abaixo das laterais, caixas abaixo dos sarrafos, rodízios no hardware', () => {
    const params = { ...bedParams(), deckHeight: 400, drawersPerSide: 2, drawerSides: 'ambos' as const };
    const m = buildBed(params);
    expect(m.warnings).toEqual([]);
    expect(m.drawers).toHaveLength(4);
    expect(m.drawers.every((d) => d.runner === 'rodizio')).toBe(true);
    const rail = m.pieces.find((p) => p.name === 'Lateral da cama')!.instances[0]!;
    const cleat = m.pieces.find((p) => p.role === 'cleat')!.instances[0]!;
    const beam = m.pieces.find((p) => p.name === 'Travessa central')?.instances[0];
    for (const f of m.pieces.find((p) => p.role === 'drawer-front')!.instances) expect(f.y + f.h).toBeLessThanOrEqual(rail.y);
    for (const b of m.pieces.filter((p) => p.role === 'drawer-side').flatMap((p) => p.instances)) {
      expect(b.y + b.h).toBeLessThanOrEqual(cleat.y);
      if (beam) expect(b.x + b.w <= beam.x || b.x >= beam.x + beam.w).toBe(true);
    }
    const item = { ...createItem('bed'), params } as ProjectItem;
    const results = buildItemResults([item]);
    const hw = projectHardware(results, projectPieces(results), DEFAULT_MATERIALS);
    expect(hw.find((h) => h.name === 'Rodízio para gavetão')?.quantity).toBe(16);
    expect(hw.some((h) => h.name === 'Corrediça telescópica')).toBe(false);
    expect(computeJoinery(m).steps.some((s) => s.title === 'Monte os gavetões')).toBe(true);
  });

  it('cama baixa demais avisa em vez de gerar gavetões', () => {
    const m = buildBed({ ...bedParams(), deckHeight: 200, drawersPerSide: 1 });
    expect(m.drawers).toHaveLength(0);
    expect(m.warnings.join(' ')).toMatch(/gavetões/);
  });

  it('gavetões de um lado só', () => {
    const m = buildBed({ ...bedParams(), deckHeight: 400, drawersPerSide: 3, drawerSides: 'direita' });
    expect(m.drawers).toHaveLength(3);
    const fronts = m.pieces.find((p) => p.role === 'drawer-front')!.instances;
    expect(fronts.every((f) => f.x > m.overall.width / 2)).toBe(true);
  });

  it('arquivo preserva gaveteiro e gavetões e corrige valores inválidos', () => {
    const bed = parseItem({ ...JSON.parse(JSON.stringify(createItem('bed'))), params: { ...bedParams(), drawersPerSide: 9, drawerSides: 'x' } });
    expect((bed!.params as BedParams).drawersPerSide).toBe(3);
    expect((bed!.params as BedParams).drawerSides).toBe('ambos');
    const d = parseItem({ ...JSON.parse(JSON.stringify(createItem('desk'))), params: { ...(defaultItemParams('desk').params as object), pedestal: 'meio' } });
    expect((d!.params as { pedestal: string }).pedestal).toBe('none');
  });
});
