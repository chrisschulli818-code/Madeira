/**
 * Endpoint do assistente de IA: POST /api/montar { texto, atual? } → { plano }.
 *
 * Roda dentro do servidor do Vite (dev e `vite preview`, que é o que o Render executa), então
 * a chave da API fica só no servidor (variável ANTHROPIC_API_KEY) e nunca vai para o navegador.
 * Sem chave, responde 501 e o app usa o leitor simples de texto.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { AiPlan } from '../src/engine/aiSchema';

const MODEL = 'claude-opus-5-5';
const MAX_TEXT = 2000;
/** Pedidos por IP por hora (o endpoint é público no Render). */
const RATE_LIMIT = 30;

const SYSTEM_PROMPT = `Você é o assistente do WoodCraft Planner, um app brasileiro de marcenaria em MDF. O usuário descreve um ou mais móveis em português (às vezes por voz, com erros de transcrição) e você devolve a especificação para o app montar o móvel com plano de corte, ferragens e montagem.

Convenções:
- Todas as medidas em milímetros. Converta: "1,80 m" = 1800, "60 cm" = 600, "45" de profundidade de móvel = 450. Largura = eixo X, altura = Y, profundidade = Z; a frente do móvel fica em +Z.
- Profundidade informada é a da caixa, sem as frentes.
- Quando o usuário não disser uma medida, use a medida usual no Brasil para aquele móvel (ex.: balcão de cozinha 870 de altura e 560 de profundidade; aéreo 700 × 350; guarda-roupa 2100 de altura e 550–600 de profundidade; criado-mudo 450 × 550 × 400; cômoda 900 × 850 × 450; rack 1800 × 500 × 420; escrivaninha 1200 × 750 × 600).
- Mantenha as medidas pedidas. Só ajuste o que for fisicamente impossível e diga isso em "resposta".

Modelos ("modelo") e quais blocos preencher (os outros blocos ficam null):
- base-cabinet (balcão de cozinha/banheiro), wall-cabinet (armário aéreo), wardrobe (guarda-roupa), nightstand (criado-mudo), dresser (cômoda), bookshelf (estante), tv-rack (rack de TV): preencha "caixa". Cada item de "colunas" é um vão separado por divisórias, da esquerda para a direita. Um vão tem 0, 1 ou 2 portas, até 6 gavetas, prateleiras móveis e cabideiro. Gavetas e porta no mesmo vão: gavetas_embaixo=true põe as gavetas embaixo (guarda-roupa), false em cima (cozinha). Vão aberto (estante, nicho) = 0 portas e 0 gavetas. Guarda-roupa com N portas costuma ter um vão para cada 2 portas. apoio: plinth (rodapé), feet (pés reguláveis) ou none (suspenso, aéreo). tampo: rails (travessas, para balcão com pedra) ou full. fundo: overlay (pregado) ou groove (encaixado em rasgo).
- workbench (mesa de trabalho, bancada) e desk (escrivaninha, mesa de estudo): preencha "mesa". gaveteiro: none, left ou right, com 1 a 6 gavetas.
- bed (cama): preencha "cama". Colchões: solteiro 880 × 1880, viúva 1280 × 1880, casal 1380 × 1880, queen 1580 × 1980, king 1930 × 2030. Gavetões com rodízios ficam sob as laterais: use altura_estrado de pelo menos 400 quando houver gavetões. Para cama, largura/altura/profundidade gerais podem repetir as do colchão.
- custom (móvel livre): só quando nenhum modelo acima serve (ex.: nicho, banco, sapateira diferente, prateleira de parede, caixa). Preencha "livre" com os painéis. Cada painel: orientacao "side" (em pé de lado: espessura no X; usa altura e profundidade), "front" (em pé de frente: espessura no Z; usa largura e altura) ou "horizontal" (deitado: espessura no Y; usa largura e profundidade). x, y, z = canto inferior-esquerdo-traseiro do painel. funcao: estrutura, prateleira, fundo, porta, frente ou gaveta. Encoste os painéis exatamente (sem sobrepor), normalmente com chapa de 18 mm e fundo de 6 mm.

Outros campos:
- quantidade: quantos móveis iguais (padrão 1). montagem: screw (parafuso, padrão), minifix ou dowel (cavilha).
- espessuras e altura da frente de gaveta: null para usar o padrão do app, a menos que o usuário peça.
- Vários móveis no mesmo pedido: um item em "moveis" para cada.
- acao: "alterar" quando o pedido muda o móvel aberto no editor (descrito em <movel_atual>, ex.: "aumenta para 1,20", "coloca mais uma gaveta"): devolva um único móvel com a especificação completa já alterada. Senão "criar".
- resposta: uma ou duas frases curtas em português, sem markdown, dizendo o que foi montado e qualquer suposição importante (ex.: medida que você escolheu).
- Se o pedido não for sobre móveis, devolva "moveis" vazio e explique em "resposta".`;

const limits = new Map<string, number[]>();
function allowed(ip: string): boolean {
  const now = Date.now();
  const recent = (limits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  limits.set(ip, recent);
  return true;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 20_000) reject(new Error('corpo grande demais'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

let client: Anthropic | null = null;

async function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return send(res, 405, { erro: 'Use POST.' });
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return send(res, 501, { erro: 'sem_chave' });
  }
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.socket.remoteAddress || '?';
  if (!allowed(ip)) return send(res, 429, { erro: 'Muitos pedidos seguidos. Tente de novo em alguns minutos.' });

  let texto = '';
  let atual = '';
  try {
    const body = JSON.parse(await readBody(req)) as { texto?: unknown; atual?: unknown };
    texto = typeof body.texto === 'string' ? body.texto.trim().slice(0, MAX_TEXT) : '';
    atual = typeof body.atual === 'string' ? body.atual.slice(0, 4000) : '';
  } catch {
    return send(res, 400, { erro: 'Pedido inválido.' });
  }
  if (!texto) return send(res, 400, { erro: 'Descreva o móvel.' });

  client ??= new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Se o pedido for recusado pelos filtros de segurança, o próprio servidor da API tenta outro modelo.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `${atual ? `<movel_atual>\n${atual}\n</movel_atual>\n\n` : ''}<pedido>\n${texto}\n</pedido>`,
        },
      ],
      output_config: { format: betaZodOutputFormat(AiPlan) },
    });
    if (response.stop_reason === 'refusal') {
      return send(res, 422, { erro: 'O assistente não pôde atender a esse pedido. Tente descrever só o móvel e as medidas.' });
    }
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      return send(res, 502, { erro: 'A resposta veio incompleta. Tente um pedido mais curto.' });
    }
    return send(res, 200, { plano: response.parsed_output, modelo: response.model });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return send(res, 501, { erro: 'sem_chave' });
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { erro: 'O serviço de IA está ocupado. Tente de novo em instantes.' });
    if (err instanceof Anthropic.APIError) {
      console.error('[ia] erro da API', err.status, err.message);
      return send(res, 502, { erro: 'O serviço de IA falhou. Tente de novo.' });
    }
    console.error('[ia]', err);
    return send(res, 500, { erro: 'Erro inesperado no assistente.' });
  }
}

const middleware: Connect.NextHandleFunction = (req, res, next) => {
  if (req.url?.split('?')[0] !== '/api/montar') return next();
  handle(req, res).catch(next);
};

/** Plugin do Vite que adiciona o endpoint no servidor de desenvolvimento e no `vite preview`. */
export function aiPlugin(): Plugin {
  return {
    name: 'woodcraft-ai',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
