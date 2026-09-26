/**
 * Aba "Montagem": passo a passo, mapa de furação por peça e união dos módulos no ambiente.
 */
import { Fragment, useMemo } from 'react';
import { Link2 } from 'lucide-react';
import { useResults } from '@/hooks/ProjectResults';
import { instanceLetter, MACHINING_COLORS, MACHINING_LABELS, opsByPiece } from '@/engine/joineryEngine';
import type { MachiningKind } from '@/types/woodcraft';
import { PieceDrillDrawing } from './PieceDrillDrawing';

const SURFACE_LABELS = { 'face-a': 'Face A', 'face-b': 'Face B', borda: 'Borda' } as const;

export function AssemblyPanel() {
  const { model, joinery, active, connections } = useResults();
  const groups = useMemo(() => opsByPiece(model, joinery.ops), [model, joinery.ops]);
  const numberOf = (pieceId: string) => model.pieces.findIndex((p) => p.id === pieceId) + 1;
  const kinds = [...new Set(joinery.ops.map((o) => o.kind))] as MachiningKind[];

  return (
    <div className="h-full space-y-5 overflow-auto p-4">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section>
          <h4 className="mb-2 text-sm font-semibold">Passo a passo — {active.item.name}</h4>
          <ol className="space-y-2">
            {joinery.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-hover">{i + 1}</span>
                <span>
                  <span className="block text-sm font-medium">{s.title}</span>
                  <span className="block text-xs leading-snug text-subtle">{s.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          {connections.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-background p-3">
              <h5 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                <Link2 className="size-4 text-primary" /> União dos módulos no ambiente
              </h5>
              <ul className="space-y-1 text-xs text-subtle">
                {connections.map((c, i) => (
                  <li key={i}>
                    <strong className="text-foreground">{c.a.name}</strong> + <strong className="text-foreground">{c.b.name}</strong>: {c.connectors} parafusos de união
                    pelas laterais encostadas (a 50 mm do topo e da base, na frente e atrás), depois de nivelar os dois.
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Mapa de furação ({joinery.ops.length} operações)</h4>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-subtle">
              {kinds.map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full" style={{ background: MACHINING_COLORS[k] }} /> {MACHINING_LABELS[k]}
                </span>
              ))}
            </div>
          </div>
          <p className="mb-3 text-[11px] leading-snug text-subtle">
            Cotas em mm a partir do canto de referência (marca laranja): u ao longo do comprimento, v ao longo da largura. Círculo cheio = face A
            (lado esquerdo/fundo/baixo do móvel), anel = face B, losango = furo na borda.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map(({ piece, instance, ops }) => (
              <details key={`${piece.id}-${instance}`} className="group rounded-lg border border-border bg-background">
                <summary className="cursor-pointer list-none p-2.5 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {numberOf(piece.id)}
                      {instanceLetter(instance)} · {piece.name}
                    </span>
                    <span className="text-[11px] tabular-nums text-subtle">
                      {piece.length} × {piece.width} · {ops.length} op.
                    </span>
                  </div>
                  <PieceDrillDrawing piece={piece} ops={ops} className="mt-1.5 max-h-40 w-full" />
                  <span className="mt-1 block text-[11px] text-primary group-open:hidden">Ver cotas ▾</span>
                </summary>
                <table className="w-full border-t border-border text-[11px]">
                  <thead className="text-subtle">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Operação</th>
                      <th className="px-1 py-1 text-left font-medium">Onde</th>
                      <th className="px-1 py-1 text-right font-medium">u</th>
                      <th className="px-1 py-1 text-right font-medium">v</th>
                      <th className="px-2 py-1 text-right font-medium">Ø × prof.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ops.map((o, i) => (
                      <Fragment key={i}>
                        <tr className="border-t border-border/60">
                          <td className="px-2 py-1">
                            <span className="mr-1 inline-block size-2 rounded-full" style={{ background: MACHINING_COLORS[o.kind] }} />
                            {MACHINING_LABELS[o.kind]}
                          </td>
                          <td className="px-1 py-1 text-subtle">{SURFACE_LABELS[o.surface]}</td>
                          <td className="px-1 py-1 text-right tabular-nums">{o.u}</td>
                          <td className="px-1 py-1 text-right tabular-nums">{o.v}</td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {o.kind === 'rasgo' ? `${o.diameter} × ${o.depth} (${o.length})` : `${o.diameter} × ${o.depth}`}
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
