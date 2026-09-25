/**
 * Mapeamento de ferramentas recomendadas para executar o projeto.
 *
 * A lista é derivada do modelo: método de montagem, presença de portas/gavetas/prateleiras,
 * tipo de fundo, tipo de móvel e se o corte/fitagem será feito pela madeireira.
 */
import type { AssembledModel, ToolCategory, ToolRequirement } from '@/types/woodcraft';

export interface ServiceOptions {
  /** Corte das chapas feito pela madeireira (seccionadora). */
  outsourcedCutting: boolean;
  /** Fita de borda aplicada pela madeireira (coladeira industrial). */
  outsourcedEdgeBanding: boolean;
}

export function computeTools(model: AssembledModel, services: ServiceOptions): ToolRequirement[] {
  const tools = new Map<string, ToolRequirement>();
  const add = (id: string, name: string, category: ToolCategory, usage: string) => {
    const existing = tools.get(id);
    if (!existing) {
      tools.set(id, { id, name, category, usage });
      return;
    }
    // A mesma ferramenta pode servir a vários usos: junta as descrições e, se for
    // obrigatória em algum contexto, prevalece como obrigatória.
    existing.usage = `${existing.usage} ${usage}`;
    if (category === 'obrigatoria') existing.category = 'obrigatoria';
  };

  const hasDoors = model.doors.length > 0;
  const hasDrawers = model.drawers.length > 0;
  const hasHandles = hasDoors || hasDrawers;
  const hasGroove = model.pieces.some((p) => p.role === 'back' && p.notes?.includes('rasgo'));
  const hasOverlayBack = model.backPerimeter > 0;
  const hasEdgeBanding = model.pieces.some((p) => p.edgeBanding.length || p.edgeBanding.width);

  // --- Medição e marcação (sempre) ---------------------------------------------------------
  add('tape', 'Trena 5 m', 'obrigatoria', 'Conferir as peças recebidas e marcar furações.');
  add('square', 'Esquadro combinado', 'obrigatoria', 'Marcar furos perpendiculares e conferir o esquadro da caixa.');
  add('pencil', 'Lápis de marceneiro / lapiseira 0,9', 'obrigatoria', 'Marcações de furação.');
  add('level', 'Nível de bolha', 'obrigatoria', 'Nivelar o móvel na instalação.');
  add('drill', 'Parafusadeira/furadeira a bateria', 'obrigatoria', 'Pré-furos, furações e aperto de parafusos (use a embreagem para não espanar o MDF).');
  add('bits', 'Jogo de bits Phillips/Pozidriv (PH2/PZ2)', 'obrigatoria', 'Aperto de parafusos chipboard.');
  add('clamps', 'Grampos sargento (mín. 2 un.)', 'obrigatoria', 'Travar as peças em esquadro durante a furação e a colagem.');
  add('ppe', 'EPI: óculos de proteção, protetor auricular e máscara PFF2', 'obrigatoria', 'Pó de MDF é fino e irritante; sempre use proteção.');
  add('mallet', 'Martelo de borracha', 'recomendada', 'Assentar cavilhas e ajustar peças sem marcar.');
  add('vacuum', 'Aspirador de pó', 'recomendada', 'Limpar cavacos das furações e da fita.');

  // --- Método de montagem --------------------------------------------------------------------
  if (model.assembly === 'screw') {
    add('drill-3', 'Broca 3 mm para madeira', 'obrigatoria', 'Pré-furo dos parafusos estruturais (evita rachar a chapa).');
    add('countersink', 'Broca escareadora (Ø 8 mm)', 'obrigatoria', 'Escarear para a cabeça do parafuso ficar rente.');
    add('pocket-jig', 'Gabarito de furação oblíqua (tipo Kreg Jig)', 'recomendada', 'Junções invisíveis por dentro, sem parafuso aparente nas laterais.');
  } else if (model.assembly === 'minifix') {
    add('forstner-15', 'Broca Forstner 15 mm com limitador', 'obrigatoria', 'Alojamento do tambor do minifix (profundidade 12,5–13 mm).');
    add('drill-8', 'Broca 8 mm com anel de profundidade', 'obrigatoria', 'Furos das cavilhas e passagem da haste.');
    add('drill-5', 'Broca 5 mm', 'obrigatoria', 'Furo da haste do minifix na lateral.');
    add('minifix-jig', 'Gabarito de minifix', 'recomendada', 'Garante o alinhamento exato entre tambor e haste.');
  } else {
    add('drill-8', 'Broca 8 mm com anel de profundidade', 'obrigatoria', 'Furos das cavilhas (profundidade de 16 mm em cada peça).');
    add('dowel-jig', 'Gabarito de cavilha', 'obrigatoria', 'Alinhar os furos nas duas peças da junção.');
    add('dowel-centers', 'Marcadores de centro para cavilha', 'recomendada', 'Transferir furações de uma peça para a outra.');
  }

  // --- Ferragens -----------------------------------------------------------------------------
  if (hasDoors) {
    add('forstner-35', 'Broca Forstner 35 mm (caneco)', 'obrigatoria', 'Alojamento das dobradiças (profundidade ~12 mm, 3–5 mm da borda).');
    add('hinge-jig', 'Gabarito de dobradiça', 'recomendada', 'Posicionar caneco e base com precisão; recomendado usar furadeira de bancada ou guia.');
  }
  if (hasDrawers) {
    add('slide-jig', 'Gabarito para corrediça telescópica', 'recomendada', 'Instalar as corrediças nivelada e na mesma altura dos dois lados.');
  }
  if (hasHandles) {
    add('drill-5', 'Broca 5 mm', 'obrigatoria', 'Furação dos puxadores (parafuso M4).');
    add('handle-jig', 'Gabarito de furação de puxadores', 'recomendada', 'Repetir a mesma posição em todas as portas e gavetas.');
  }
  if (model.adjustableShelves > 0) {
    add('drill-5', 'Broca 5 mm', 'obrigatoria', 'Furação dos pinos de prateleira (use limitador de 10 mm).');
    add('shelf-jig', 'Gabarito de furação de pinos (sistema 32 mm)', 'recomendada', 'Fileira de furos alinhados para regular as prateleiras.');
  }
  if (hasOverlayBack) {
    add('hammer', 'Martelo', 'obrigatoria', 'Pregar o fundo sobreposto.');
    add('stapler', 'Grampeador pneumático', 'recomendada', 'Fixação rápida do fundo com grampos.');
  }

  // --- Corte ----------------------------------------------------------------------------------
  if (services.outsourcedCutting) {
    add('cut-service', 'Corte terceirizado na madeireira (seccionadora)', 'obrigatoria',
      hasGroove ? 'Envie a lista de corte e peça também o rasgo do fundo.' : 'Envie a lista de corte exportada — corte com precisão e esquadro garantidos.');
    add('jigsaw', 'Serra tico-tico', 'recomendada', 'Pequenos ajustes e recortes (tomadas, canos).');
  } else {
    add('circular-saw', 'Serra circular com guia/trilho', 'obrigatoria', 'Corte das chapas no esquadro (use disco de 60+ dentes para MDF).');
    add('sawhorses', 'Cavaletes + placa de sacrifício (isopor/MDF)', 'obrigatoria', 'Apoiar a chapa inteira durante o corte.');
    add('miter-saw', 'Serra de meia-esquadria', 'recomendada', 'Cortes transversais repetitivos de peças estreitas.');
    add('table-saw', 'Serra de bancada', 'recomendada', 'Refilar peças em série com maior precisão.');
    if (hasGroove) add('router', 'Tupia com fresa reta (ou serra de bancada)', 'obrigatoria', 'Usinar o rasgo do fundo.');
  }

  // --- Fita de borda ----------------------------------------------------------------------------
  if (hasEdgeBanding) {
    if (services.outsourcedEdgeBanding) {
      add('edge-service', 'Fitagem na madeireira (coladeira de borda)', 'recomendada', 'Acabamento industrial das bordas indicadas na lista de corte.');
    } else {
      add('iron', 'Ferro de passar roupa (sem vapor)', 'obrigatoria', 'Ativar a cola da fita pré-colada.');
      add('edge-trimmer', 'Refilador de fita de borda / estilete', 'obrigatoria', 'Remover o excesso da fita rente à chapa.');
      add('sanding-block', 'Taco de lixa', 'obrigatoria', 'Quebrar a quina da fita após refilar.');
      add('edgebander', 'Coladeira de borda manual', 'recomendada', 'Produtividade e melhor adesão em grandes volumes.');
    }
  }

  // --- Instalação ----------------------------------------------------------------------------------
  if (model.templateId === 'wall-cabinet' || model.templateId === 'wardrobe' || model.templateId === 'base-cabinet') {
    add('hammer-drill', 'Furadeira de impacto + broca de vídea (6/8 mm)', 'obrigatoria', 'Furar a parede para buchas de fixação.');
    add('pipe-detector', 'Detector de canos e fios', 'recomendada', 'Evitar tubulações ao furar a parede.');
  }
  if (model.templateId === 'wall-cabinet' || model.overall.height > 1800) {
    add('ladder', 'Escada', 'obrigatoria', 'Instalação e montagem em altura.');
  }
  if (model.hangingRods.length) {
    add('hacksaw', 'Serra de arco (metal)', 'obrigatoria', 'Cortar o tubo oblongo na medida.');
  }

  const order = { obrigatoria: 0, recomendada: 1 } as const;
  return [...tools.values()].sort((a, b) => order[a.category] - order[b.category]);
}
