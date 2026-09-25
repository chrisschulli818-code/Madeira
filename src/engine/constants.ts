/**
 * Constantes de marcenaria usadas pelo motor de cálculo.
 * Valores baseados em práticas comuns de marcenaria de MDF/MDP no Brasil.
 * Todas as medidas em mm.
 */

/** Distância do rasgo do fundo até a traseira da lateral. */
export const GROOVE_OFFSET = 10;
/** Profundidade do rasgo (canal) onde o fundo encaixa. */
export const GROOVE_DEPTH = 8;
/** Folga total do fundo encaixado (evita forçar a caixa fora de esquadro). */
export const GROOVE_BACK_CLEARANCE = 2;
/** Redução total do fundo sobreposto para que não apareça nas laterais (2 mm por lado). */
export const OVERLAY_BACK_REDUCTION = 4;

/** Largura das travessas do tampo em balcões com tampo em travessas. */
export const RAIL_WIDTH = 100;

/** Folga por lado para corrediça telescópica (padrão 12,7 mm, arredondado). */
export const SLIDE_CLEARANCE_PER_SIDE = 13;
/** Comprimentos comerciais de corrediças telescópicas. */
export const SLIDE_LENGTHS = [250, 300, 350, 400, 450, 500, 550, 600] as const;
/** Espaço mínimo livre atrás da corrediça. */
export const SLIDE_REAR_CLEARANCE = 10;
/** Diferença entre a altura da frente e a altura da caixa da gaveta. */
export const DRAWER_HEIGHT_CLEARANCE = 40;
/** Altura mínima de caixa de gaveta. */
export const DRAWER_MIN_BOX_HEIGHT = 60;

/** Recuo frontal das prateleiras móveis atrás de portas. */
export const SHELF_FRONT_SETBACK = 20;
/** Folga total na largura das prateleiras móveis. */
export const SHELF_SIDE_CLEARANCE = 2;

/** Espaçamento vertical entre prateleiras de maleiro em vão com cabideiro. */
export const ROD_SHELF_SPACING = 350;
/** Distância do cabideiro abaixo da prateleira. */
export const ROD_DROP = 60;
/** Altura livre mínima recomendada para cabides (camisas/casacos). */
export const ROD_MIN_HANGING = 900;

/** Largura de porta acima da qual há risco de empenamento. */
export const MAX_DOOR_LEAF_WIDTH = 600;
/** Menor dimensão de peça aceita pelo motor. */
export const MIN_PIECE_SIZE = 30;

/** Espaçamento de parafusos/cavilhas ao longo de uma junção. */
export const FASTENER_SPACING = 150;
/** Espaçamento de pregos/grampos no fundo sobreposto. */
export const BACK_NAIL_SPACING = 150;
/** Sobra aplicada na metragem de fita de borda (perdas de ponta e refilo). */
export const EDGE_BANDING_WASTE = 0.1;
