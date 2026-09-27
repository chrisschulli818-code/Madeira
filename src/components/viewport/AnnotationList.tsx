/**
 * Lista das marcações do móvel (notas e medidas): editar o texto, destacar e remover.
 * Fica sobre o viewport, no canto inferior esquerdo.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Ruler, Trash2 } from 'lucide-react';
import type { Annotation } from '@/types/woodcraft';
import { useProjectStore } from '@/store/projectStore';
import { distanceMm } from '@/engine/motionEngine';
import { cn } from '@/lib/utils';

export function AnnotationList({
  notes,
  activeId,
  onActivate,
  focusId,
}: {
  notes: Annotation[];
  activeId: string | null;
  onActivate: (id: string | null) => void;
  /** Marcação recém-criada: o campo de texto recebe o foco. */
  focusId: string | null;
}) {
  const update = useProjectStore((s) => s.updateAnnotation);
  const remove = useProjectStore((s) => s.removeAnnotation);
  const clear = useProjectStore((s) => s.clearAnnotations);
  const [open, setOpen] = useState(true);
  const inputs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (!focusId) return;
    setOpen(true);
    requestAnimationFrame(() => inputs.current.get(focusId)?.focus());
  }, [focusId]);

  let noteN = 0;
  return (
    <div className="absolute bottom-3 left-3 z-10 w-72 max-w-[calc(100%-1.5rem)] rounded-lg border border-border bg-surface/95 shadow-md backdrop-blur" data-testid="annotation-list">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold">
        <MapPin className="size-3.5 text-primary" /> Marcações ({notes.length})
        {open ? <ChevronDown className="ml-auto size-3.5" /> : <ChevronUp className="ml-auto size-3.5" />}
      </button>
      {open && (
        <div className="max-h-52 space-y-1 overflow-y-auto border-t border-border px-2 py-2">
          {notes.length === 0 && <p className="px-1 text-[11px] leading-snug text-subtle">Clique numa peça para marcar. As marcações ficam salvas no projeto e vão para o PDF.</p>}
          {notes.map((n) => {
            const isNote = n.kind === 'nota';
            if (isNote) noteN++;
            return (
              <div
                key={n.id}
                className={cn('flex items-center gap-1.5 rounded-md px-1 py-0.5', n.id === activeId && 'bg-primary/10')}
                onMouseEnter={() => onActivate(n.id)}
                onMouseLeave={() => onActivate(null)}
              >
                {isNote ? (
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-rose-700 text-[10px] font-bold text-white">{noteN}</span>
                ) : (
                  <span className="flex shrink-0 items-center gap-0.5 rounded bg-blue-700 px-1 text-[10px] font-semibold tabular-nums text-white">
                    <Ruler className="size-3" />
                    {distanceMm(n.a, n.b ?? n.a)}
                  </span>
                )}
                <input
                  ref={(el) => {
                    if (el) inputs.current.set(n.id, el);
                    else inputs.current.delete(n.id);
                  }}
                  value={n.text}
                  placeholder={isNote ? 'Escreva a nota…' : 'Descrição (opcional)'}
                  aria-label={isNote ? 'Texto da nota' : 'Descrição da medida'}
                  onChange={(e) => update(n.id, { text: e.target.value })}
                  onFocus={() => onActivate(n.id)}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="h-7 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-xs hover:border-border focus:border-primary focus:outline-none"
                />
                <button type="button" aria-label="Remover marcação" onClick={() => remove(n.id)} className="grid size-6 shrink-0 place-items-center rounded text-subtle hover:bg-muted hover:text-danger">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
          {notes.length > 1 && (
            <button type="button" onClick={() => confirm('Remover todas as marcações deste móvel?') && clear()} className="px-1 text-[11px] text-subtle hover:text-danger">
              Remover todas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
