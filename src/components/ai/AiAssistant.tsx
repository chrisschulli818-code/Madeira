/**
 * "Montar com IA": o usuário descreve (ou fala) o móvel com as medidas e o app monta.
 *
 * O pedido vai para o endpoint /api/montar (Gemini, no servidor). Se o servidor não tiver chave
 * da API ou não estiver acessível, um leitor simples de texto monta o básico localmente.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Send, Sparkles, Wand2, X } from 'lucide-react';
import { useActiveItem, useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { parsePedido, planToItems } from '@/engine/aiSpec';
import type { AiPlan } from '@/engine/aiSchema';
import { TEMPLATES } from '@/engine/templates';
import { describeParams } from '@/lib/specs';
import { cn } from '@/lib/utils';

const EXAMPLES = [
  'Guarda-roupa de 1,80 de largura, 2,10 de altura e 60 de fundo, com 3 portas, 2 gavetas embaixo e cabideiro',
  'Balcão de pia de 1,20 m com 2 portas e 3 gavetas do lado',
  'Cama de casal com 2 gavetões de cada lado',
  'Estante de 90 × 180 × 30 cm com 5 prateleiras, sem portas',
  'Escrivaninha de 1,40 m com gaveteiro de 3 gavetas à esquerda',
];

interface Exchange {
  texto: string;
  resposta: string;
  fonte: 'ia' | 'simples';
  criados: string[];
  alterado?: boolean;
  erro?: boolean;
}

// Reconhecimento de voz do navegador (Chrome/Edge/Safari), em português.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
const SpeechRecognitionCtor = (): (new () => Recognition) | null => {
  const w = window as unknown as Record<string, unknown>;
  return ((w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Recognition) | undefined) ?? null;
};

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} title="Descreva o móvel com as medidas e o app monta">
        <Sparkles /> <span className="hidden sm:inline">Montar com IA</span>
      </Button>
      {open && <AiPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function AiPanel({ onClose }: { onClose: () => void }) {
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Exchange[]>([]);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const active = useActiveItem();
  const insertItems = useProjectStore((s) => s.insertItems);
  const replaceActiveItem = useProjectStore((s) => s.replaceActiveItem);
  const canListen = SpeechRecognitionCtor() !== null;

  useEffect(() => {
    textarea.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      recognition.current?.stop();
    };
  }, [onClose]);

  const toggleMic = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = SpeechRecognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = 'pt-BR';
    r.interimResults = true;
    r.continuous = false;
    const before = texto ? `${texto.trim()} ` : '';
    r.onresult = (e) => {
      const spoken = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? '')
        .join('');
      setTexto(before + spoken);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognition.current = r;
    setListening(true);
    r.start();
  };

  const apply = (plan: AiPlan, fonte: Exchange['fonte'], pedido: string) => {
    const items = planToItems(plan);
    const alterado = plan.acao === 'alterar' && items.length === 1;
    if (alterado) replaceActiveItem({ ...items[0]!, name: items[0]!.name || active.name });
    else if (items.length) insertItems(items);
    setHistory((h) => [...h, { texto: pedido, resposta: plan.resposta, fonte, criados: items.map((i) => i.name), alterado }]);
  };

  const submit = async () => {
    const pedido = texto.trim();
    if (!pedido || busy) return;
    recognition.current?.stop();
    setBusy(true);
    // O móvel aberto vai junto, para pedidos como "aumenta para 1,20" ou "coloca mais uma gaveta".
    const atual = [
      `Nome: ${active.name}`,
      `Modelo: ${active.templateId} (${TEMPLATES[active.templateId].name})`,
      ...describeParams(active.templateId, active.params).map(([k, v]) => `${k}: ${v}`),
      `Parâmetros: ${JSON.stringify(active.params).slice(0, 2500)}`,
    ].join('\n');
    try {
      const res = await fetch('/api/montar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: pedido, atual }),
      });
      if (res.ok) {
        const { plano } = (await res.json()) as { plano: AiPlan };
        apply(plano, 'ia', pedido);
        setTexto('');
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { erro?: string };
      if (res.status === 501 || res.status === 404) {
        // Servidor sem chave da API (ou hospedagem sem servidor): leitor simples.
        apply(parsePedido(pedido), 'simples', pedido);
        setTexto('');
        return;
      }
      setHistory((h) => [...h, { texto: pedido, resposta: body.erro ?? `Erro ${res.status}.`, fonte: 'ia', criados: [], erro: true }]);
    } catch {
      apply(parsePedido(pedido), 'simples', pedido);
      setTexto('');
    } finally {
      setBusy(false);
    }
  };

  const simple = () => {
    const pedido = texto.trim();
    if (!pedido) return;
    apply(parsePedido(pedido), 'simples', pedido);
    setTexto('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-2 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Montar com IA" className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Sparkles className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Montar com IA</h2>
            <p className="text-xs text-subtle">Descreva o móvel com as medidas, portas, gavetas… e eu monto. Também dá para pedir mudanças no móvel aberto.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="grid size-8 place-items-center rounded text-subtle hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" data-testid="ai-history">
          {history.length === 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-subtle">Exemplos (clique para usar):</p>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setTexto(ex);
                    textarea.current?.focus();
                  }}
                  className="block w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs hover:border-primary/40"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
          {history.map((h, i) => (
            <div key={i} className="space-y-1.5">
              <p className="ml-8 rounded-lg bg-primary-soft px-3 py-2 text-sm">{h.texto}</p>
              <div className={cn('mr-8 rounded-lg border px-3 py-2 text-sm', h.erro ? 'border-amber-200 bg-warning-soft text-amber-900' : 'border-border bg-background')}>
                <p>{h.resposta}</p>
                {h.criados.length > 0 && (
                  <p className="mt-1 text-xs text-subtle">
                    {h.alterado ? 'Móvel alterado' : 'Adicionado ao projeto'}: {h.criados.join(', ')}
                  </p>
                )}
                {!h.erro && (
                  <p className="mt-1 text-[11px] text-subtle">
                    {h.fonte === 'ia' ? 'Feito pela IA (Gemini). Confira as medidas no editor.' : 'Feito pelo leitor simples (o servidor não tem chave de IA configurada). Confira as medidas no editor.'}
                  </p>
                )}
                {h.erro && (
                  <button type="button" className="mt-1 text-xs font-medium underline" onClick={() => setTexto(h.texto)}>
                    Tentar de novo
                  </button>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <p className="flex items-center gap-2 text-sm text-subtle">
              <Loader2 className="size-4 animate-spin" /> Montando o móvel…
            </p>
          )}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textarea}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              rows={3}
              placeholder="Ex.: rack de TV de 2 m com 2 portas e um nicho no meio"
              aria-label="Descreva o móvel"
              className="min-h-16 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <div className="flex flex-col gap-1.5">
              {canListen && (
                <Button variant={listening ? 'default' : 'outline'} size="sm" onClick={toggleMic} title={listening ? 'Parar de ouvir' : 'Falar o pedido'} aria-label={listening ? 'Parar de ouvir' : 'Falar o pedido'}>
                  {listening ? <MicOff /> : <Mic />}
                </Button>
              )}
              <Button size="sm" onClick={() => void submit()} disabled={busy || !texto.trim()} aria-label="Montar">
                {busy ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-subtle">
            <span>{listening ? 'Ouvindo… fale o móvel e as medidas.' : 'Enter monta · Shift+Enter quebra linha'}</span>
            <button type="button" onClick={simple} disabled={!texto.trim()} className="flex items-center gap-1 hover:text-foreground disabled:opacity-50" title="Monta sem IA, só lendo as palavras e números">
              <Wand2 className="size-3" /> Montar sem IA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
