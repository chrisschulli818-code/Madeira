/**
 * Formato da resposta do assistente de IA ("descreva o móvel e eu monto").
 *
 * O servidor pede ao Claude uma resposta neste formato (saída estruturada) e o app converte
 * cada móvel em um item do projeto (`aiSpec.ts`), validando tudo com o mesmo leitor dos
 * arquivos de projeto. Medidas sempre em milímetros.
 *
 * Campos opcionais são `nullable` (a saída estruturada exige todos os campos presentes).
 */
import { z } from 'zod';

export const AI_TEMPLATES = [
  'base-cabinet',
  'wall-cabinet',
  'wardrobe',
  'nightstand',
  'dresser',
  'bookshelf',
  'tv-rack',
  'workbench',
  'desk',
  'bed',
  'custom',
] as const;

const Assembly = z.enum(['screw', 'minifix', 'dowel']);

export const ColumnSpec = z.object({
  largura_relativa: z.number().describe('Peso da largura do vão (1 = igual aos outros vãos).'),
  gavetas: z.number().describe('Gavetas empilhadas neste vão (0 a 6).'),
  gavetas_embaixo: z.boolean().describe('Com porta no mesmo vão: true = gavetas embaixo da porta, false = em cima.'),
  portas: z.number().describe('Folhas de porta: 0 (vão aberto), 1 ou 2.'),
  prateleiras: z.number().describe('Prateleiras móveis na região da porta ou do vão aberto.'),
  cabideiro: z.boolean().describe('Tubo de cabide (guarda-roupa).'),
});

export const PanelSpec = z.object({
  nome: z.string(),
  funcao: z.enum(['estrutura', 'prateleira', 'fundo', 'porta', 'frente', 'gaveta']),
  orientacao: z.enum(['side', 'front', 'horizontal']),
  largura: z.number(),
  altura: z.number(),
  profundidade: z.number(),
  espessura: z.number(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const FurnitureSpec = z.object({
  modelo: z.enum(AI_TEMPLATES),
  nome: z.string().describe('Nome curto em português, ex.: "Guarda-roupa do casal".'),
  quantidade: z.number(),
  largura: z.number(),
  altura: z.number(),
  profundidade: z.number(),
  montagem: Assembly,
  caixa: z
    .object({
      colunas: z.array(ColumnSpec),
      apoio: z.enum(['plinth', 'feet', 'none']),
      altura_apoio: z.number().nullable(),
      tampo: z.enum(['full', 'rails']),
      fundo: z.enum(['overlay', 'groove']),
      espessura_caixa: z.number().nullable(),
      espessura_frentes: z.number().nullable(),
      altura_frente_gaveta: z.number().nullable(),
    })
    .nullable()
    .describe('Obrigatório para móveis de caixa (balcão, aéreo, guarda-roupa, criado-mudo, cômoda, estante, rack).'),
  mesa: z
    .object({
      gaveteiro: z.enum(['none', 'left', 'right']),
      gavetas: z.number(),
      largura_gaveteiro: z.number(),
      prateleira_inferior: z.boolean(),
      espessura_tampo: z.number().nullable(),
    })
    .nullable()
    .describe('Para mesa de trabalho e escrivaninha.'),
  cama: z
    .object({
      largura_colchao: z.number(),
      comprimento_colchao: z.number(),
      altura_estrado: z.number(),
      altura_cabeceira: z.number(),
      peseira_alta: z.boolean(),
      estrado: z.enum(['ripas', 'chapa']),
      gavetoes_por_lado: z.number(),
      lado_gavetoes: z.enum(['ambos', 'esquerda', 'direita']),
    })
    .nullable()
    .describe('Para cama. Largura/altura/profundidade gerais são ignoradas: a cama é calculada pelo colchão.'),
  livre: z
    .object({ paineis: z.array(PanelSpec) })
    .nullable()
    .describe('Só quando nenhum modelo serve: o móvel montado painel por painel.'),
});

export const AiPlan = z.object({
  acao: z.enum(['criar', 'alterar']).describe('"alterar" só quando o pedido muda o móvel que está aberto no editor.'),
  resposta: z.string().describe('Uma ou duas frases em português para o usuário: o que foi montado e qualquer ajuste feito nas medidas.'),
  moveis: z.array(FurnitureSpec),
});

export type ColumnSpec = z.infer<typeof ColumnSpec>;
export type PanelSpec = z.infer<typeof PanelSpec>;
export type FurnitureSpec = z.infer<typeof FurnitureSpec>;
export type AiPlan = z.infer<typeof AiPlan>;
