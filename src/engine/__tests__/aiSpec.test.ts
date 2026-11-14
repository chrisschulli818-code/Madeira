import { describe, expect, it } from 'vitest';
import { parsePedido, planToItems, specToItem, toMm } from '../aiSpec';
import { AiPlan } from '../aiSchema';
import { buildItemResults } from '../projectEngine';
import type { BedParams, CabinetParams, CustomParams, WorkbenchParams } from '@/types/woodcraft';

describe('unidades', () => {
  it('m, cm, mm e números soltos pela ordem de grandeza', () => {
    expect(toMm('1,80', 'm')).toBe(1800);
    expect(toMm('60', 'cm')).toBe(600);
    expect(toMm('450', 'mm')).toBe(450);
    expect(toMm('2.1')).toBe(2100);
    expect(toMm('210')).toBe(2100);
    expect(toMm('870')).toBe(870);
  });
});

describe('leitor simples (sem IA)', () => {
  it('guarda-roupa com medidas, portas, gavetas e cabideiro', () => {
    const plan = parsePedido('Quero um guarda-roupa de 1,80 de largura, 2,10 de altura e 60 de profundidade, com 3 portas, 2 gavetas e cabideiro');
    const [item] = planToItems(plan);
    expect(item!.templateId).toBe('wardrobe');
    const p = item!.params as CabinetParams;
    expect([p.width, p.height, p.depth]).toEqual([1800, 2100, 600]);
    expect(p.columns.reduce((s, c) => s + c.doors, 0)).toBe(3);
    expect(p.columns.reduce((s, c) => s + c.drawers, 0)).toBe(2);
    expect(p.columns.some((c) => c.hangingRod)).toBe(true);
    expect(buildItemResults([item!])[0]!.model.warnings).toEqual([]);
  });

  it('medidas no formato L × A × P', () => {
    const p = planToItems(parsePedido('estante 90 x 180 x 30 cm com 5 prateleiras'))[0]!.params as CabinetParams;
    expect([p.width, p.height, p.depth]).toEqual([900, 1800, 300]);
    expect(p.columns.reduce((s, c) => s + c.shelves, 0)).toBeGreaterThanOrEqual(5);
  });

  it('cama de casal com gavetões e escrivaninha com gaveteiro à esquerda', () => {
    const bed = planToItems(parsePedido('cama queen com 4 gavetas'))[0]!;
    const b = bed.params as BedParams;
    expect(bed.templateId).toBe('bed');
    expect([b.mattressWidth, b.mattressLength]).toEqual([1580, 1980]);
    expect(b.drawersPerSide).toBe(2);
    expect(buildItemResults([bed])[0]!.model.drawers).toHaveLength(4);
    const desk = planToItems(parsePedido('escrivaninha de 1,40 m com 3 gavetas à esquerda'))[0]!;
    const d = desk.params as WorkbenchParams;
    expect(desk.templateId).toBe('desk');
    expect(d.width).toBe(1400);
    expect(d.pedestal).toBe('left');
    expect(d.pedestalDrawers).toBe(3);
  });

  it('sem tipo reconhecido cai no balcão e sempre descreve o resultado', () => {
    const plan = parsePedido('algo de 1 metro');
    expect(plan.moveis[0]!.modelo).toBe('base-cabinet');
    expect(plan.resposta).toMatch(/Montei/);
  });
});

describe('resposta da IA → itens', () => {
  const plan = AiPlan.parse({
    acao: 'criar',
    resposta: 'Montei.',
    moveis: [
      {
        modelo: 'base-cabinet', nome: 'Balcão da pia', quantidade: 1, largura: 1200, altura: 870, profundidade: 560, montagem: 'minifix',
        caixa: {
          colunas: [
            { largura_relativa: 1, gavetas: 0, gavetas_embaixo: false, portas: 2, prateleiras: 1, cabideiro: false },
            { largura_relativa: 0.6, gavetas: 3, gavetas_embaixo: false, portas: 0, prateleiras: 0, cabideiro: false },
          ],
          apoio: 'plinth', altura_apoio: 100, tampo: 'rails', fundo: 'overlay', espessura_caixa: null, espessura_frentes: null, altura_frente_gaveta: null,
        },
        mesa: null, cama: null, livre: null,
      },
      {
        modelo: 'custom', nome: 'Nicho', quantidade: 2, largura: 600, altura: 300, profundidade: 250, montagem: 'screw',
        caixa: null, mesa: null, cama: null,
        livre: {
          paineis: [
            { nome: 'Base', funcao: 'estrutura', orientacao: 'horizontal', largura: 600, altura: 18, profundidade: 250, espessura: 18, x: 0, y: 0, z: 0 },
            { nome: 'Lateral esquerda', funcao: 'estrutura', orientacao: 'side', largura: 18, altura: 282, profundidade: 250, espessura: 18, x: 0, y: 18, z: 0 },
          ],
        },
      },
      {
        modelo: 'bed', nome: 'Cama', quantidade: 1, largura: 0, altura: 0, profundidade: 0, montagem: 'screw', caixa: null, mesa: null, livre: null,
        cama: { largura_colchao: 1380, comprimento_colchao: 1880, altura_estrado: 400, altura_cabeceira: 1100, peseira_alta: false, estrado: 'chapa', gavetoes_por_lado: 1, lado_gavetoes: 'direita' },
      },
    ],
  });

  it('converte caixa, móvel livre e cama, validando pelo leitor de projeto', () => {
    const [cab, nicho, cama] = planToItems(plan);
    const c = cab!.params as CabinetParams;
    expect(cab!.name).toBe('Balcão da pia');
    expect(c.assembly).toBe('minifix');
    expect(c.topType).toBe('rails');
    expect(c.columns.map((k) => [k.doors, k.drawers])).toEqual([[2, 0], [0, 3]]);
    expect(nicho!.quantity).toBe(2);
    expect((nicho!.params as CustomParams).panels).toHaveLength(2);
    expect((nicho!.params as CustomParams).panels[1]!.orientation).toBe('side');
    const b = cama!.params as BedParams;
    expect([b.deck, b.footboard, b.drawersPerSide, b.drawerSides]).toEqual(['chapa', false, 1, 'direita']);
    const results = buildItemResults([cab!, nicho!, cama!]);
    expect(results.every((r) => r.model.pieces.length > 0)).toBe(true);
  });

  it('valores fora do permitido são corrigidos (portas no máximo 2, gavetas no máximo 6)', () => {
    const spec = { ...plan.moveis[0]!, caixa: { ...plan.moveis[0]!.caixa!, colunas: [{ largura_relativa: -1, gavetas: 40, gavetas_embaixo: true, portas: 5, prateleiras: 2, cabideiro: false }] } };
    const col = (specToItem(spec)!.params as CabinetParams).columns[0]!;
    expect([col.widthRatio, col.drawers, col.doors, col.drawerPosition]).toEqual([1, 6, 2, 'bottom']);
  });
});
