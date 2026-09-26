/**
 * Desenho de uma peça com a furação (vista da face): u na horizontal (comprimento),
 * v na vertical (largura), origem no canto inferior esquerdo (canto de referência).
 * Face A = círculo cheio; face B = anel; borda = marca na borda; rasgo = faixa.
 */
import type { CutPiece, MachiningOp } from '@/types/woodcraft';
import { MACHINING_COLORS } from '@/engine/joineryEngine';

export function PieceDrillDrawing({ piece, ops, className }: { piece: CutPiece; ops: MachiningOp[]; className?: string }) {
  const L = piece.length;
  const W = piece.width;
  const pad = Math.max(L, W) * 0.06;
  const minR = Math.max(L, W) / 140;
  const Y = (v: number) => W - v;
  return (
    <svg viewBox={`${-pad} ${-pad} ${L + 2 * pad} ${W + 2 * pad}`} className={className} role="img" aria-label={`Furação: ${piece.name}`}>
      <rect x={0} y={0} width={L} height={W} fill="#f6efe4" stroke="#3f362c" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {/* canto de referência */}
      <path d={`M 0 ${W - Math.min(L, W) * 0.12} L 0 ${W} L ${Math.min(L, W) * 0.12} ${W}`} fill="none" stroke="#b45309" strokeWidth={3} vectorEffect="non-scaling-stroke" />
      {ops.map((o, i) => {
        const color = MACHINING_COLORS[o.kind];
        const r = Math.max(o.diameter / 2, minR);
        const title = <title>{`${o.kind} — u ${o.u} · v ${o.v} · Ø${o.diameter} × ${o.depth} mm (${o.surface})`}</title>;
        if (o.kind === 'rasgo' && o.length) {
          const [w, h] = o.alongWidth ? [o.diameter, o.length] : [o.length, o.diameter];
          return (
            <rect key={i} x={o.u} y={Y(o.v) - h} width={w} height={h} fill={color} fillOpacity={0.5}>
              {title}
            </rect>
          );
        }
        if (o.surface === 'borda') {
          const s = r * 1.6;
          return (
            <rect key={i} x={o.u - s / 2} y={Y(o.v) - s / 2} width={s} height={s} fill={color} transform={`rotate(45 ${o.u} ${Y(o.v)})`}>
              {title}
            </rect>
          );
        }
        return (
          <circle
            key={i}
            cx={o.u}
            cy={Y(o.v)}
            r={r}
            fill={o.surface === 'face-a' ? color : '#ffffff'}
            stroke={color}
            strokeWidth={o.surface === 'face-a' ? 0 : 2}
            vectorEffect="non-scaling-stroke"
          >
            {title}
          </circle>
        );
      })}
    </svg>
  );
}
