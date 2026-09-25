/**
 * Vista 2D ortogonal (frontal ou lateral) em SVG, com cotas dimensionais.
 * Reutilizada no viewport interativo e no relatório impresso.
 */
import { useMemo } from 'react';
import type { AssembledModel, Box3D, CutPiece } from '@/types/woodcraft';
import { HIGHLIGHT_COLOR, MATERIAL_COLORS, SELECT_COLOR } from '@/lib/pieceColors';
import { fmt } from '@/lib/utils';

export type ElevationView = 'front' | 'side';

interface Props {
  model: AssembledModel;
  view: ElevationView;
  showFronts?: boolean;
  hoveredId?: string | null;
  selectedId?: string | null;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string | null) => void;
  className?: string;
}

interface Drawn {
  piece: CutPiece;
  box: Box3D;
  key: string;
}

const FRONT_ROLES = new Set(['door', 'drawer-front']);

/** Linha de cota com linhas de chamada e marcas oblíquas (padrão de desenho técnico). */
function Dim({
  x1,
  y1,
  x2,
  y2,
  offset,
  label,
  size,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Deslocamento perpendicular da linha de cota (negativo = acima/esquerda). */
  offset: number;
  label: string;
  size: number;
}) {
  const horizontal = y1 === y2;
  const tick = size * 0.35;
  const [ax, ay, bx, by] = horizontal ? [x1, y1 + offset, x2, y2 + offset] : [x1 + offset, y1, x2 + offset, y2];
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const stroke = { stroke: '#6f655a', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' as const };
  return (
    <g>
      <line x1={x1} y1={y1} x2={ax} y2={ay} {...stroke} strokeDasharray="2 2" />
      <line x1={x2} y1={y2} x2={bx} y2={by} {...stroke} strokeDasharray="2 2" />
      <line x1={ax} y1={ay} x2={bx} y2={by} {...stroke} />
      <line x1={ax - tick} y1={ay + tick} x2={ax + tick} y2={ay - tick} {...stroke} />
      <line x1={bx - tick} y1={by + tick} x2={bx + tick} y2={by - tick} {...stroke} />
      <text
        x={horizontal ? mx : mx - size * 0.35}
        y={horizontal ? my - size * 0.35 : my}
        fontSize={size}
        fill="#1f1a14"
        textAnchor="middle"
        transform={horizontal ? undefined : `rotate(-90 ${mx - size * 0.35} ${my})`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {label}
      </text>
    </g>
  );
}

export function Elevation2D({ model, view, showFronts = true, hoveredId, selectedId, onHover, onSelect, className }: Props) {
  const { width: W, height: H, depth: D } = model.overall;
  const frontThickness = model.pieces.find((p) => FRONT_ROLES.has(p.role))?.thickness ?? 0;
  const spanX = view === 'front' ? W : D + frontThickness;

  const drawn = useMemo(() => {
    const items: Drawn[] = [];
    for (const piece of model.pieces) {
      if (!showFronts && FRONT_ROLES.has(piece.role)) continue;
      piece.instances.forEach((box, i) => items.push({ piece, box, key: `${piece.id}-${i}` }));
    }
    // Pintor: o que está mais ao fundo (frontal) ou mais à esquerda (lateral) é desenhado primeiro.
    return items.sort((a, b) => (view === 'front' ? a.box.z + a.box.d - (b.box.z + b.box.d) : a.box.x + a.box.w - (b.box.x + b.box.w)));
  }, [model.pieces, showFronts, view]);

  const text = Math.max(spanX, H) / 24;
  const pad = text * 5;
  const toRect = (b: Box3D) =>
    view === 'front' ? { x: b.x, y: H - b.y - b.h, w: b.w, h: b.h } : { x: b.z, y: H - b.y - b.h, w: b.d, h: b.h };

  const plinth = model.layout.plinthHeight;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${spanX + 2 * pad} ${H + 2 * pad}`}
      className={className}
      role="img"
      aria-label={view === 'front' ? 'Vista frontal cotada' : 'Vista lateral cotada'}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Piso */}
      <line x1={-pad / 2} y1={H} x2={spanX + pad / 2} y2={H} stroke="#6f655a" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {drawn.map(({ piece, box, key }) => {
        const r = toRect(box);
        const active = piece.id === hoveredId;
        const selected = piece.id === selectedId;
        return (
          <rect
            key={key}
            x={r.x}
            y={r.y}
            width={Math.max(r.w, 0.5)}
            height={Math.max(r.h, 0.5)}
            fill={active ? HIGHLIGHT_COLOR : selected ? SELECT_COLOR : MATERIAL_COLORS[piece.material]}
                        stroke="#3f362c"
            strokeWidth={active || selected ? 2 : 0.75}
            vectorEffect="non-scaling-stroke"
            onMouseEnter={() => onHover?.(piece.id)}
            onClick={() => onSelect?.(selected ? null : piece.id)}
            style={{ cursor: onHover ? 'pointer' : undefined }}
          >
            <title>{`${piece.name} — ${piece.length} × ${piece.width} × ${piece.thickness} mm`}</title>
          </rect>
        );
      })}

      {/* Cotas gerais */}
      <Dim x1={0} y1={H} x2={spanX} y2={H} offset={pad * 0.6} label={fmt(view === 'front' ? W : D)} size={text} />
      <Dim x1={0} y1={0} x2={0} y2={H} offset={-pad * 0.6} label={fmt(H)} size={text} />
      {plinth > 0 && (
        <Dim x1={spanX} y1={H - plinth} x2={spanX} y2={H} offset={pad * 0.45} label={fmt(plinth)} size={text * 0.85} />
      )}
      {/* Vãos internos (vista frontal) */}
      {view === 'front' &&
        model.layout.columns.length > 1 &&
        model.layout.columns.map(([a, b], i) => (
          <Dim key={i} x1={a} y1={0} x2={b} y2={0} offset={-pad * 0.45} label={fmt(Math.round(b - a))} size={text * 0.85} />
        ))}
      {view === 'side' && (
        <Dim x1={0} y1={0} x2={model.layout.internalDepth} y2={0} offset={-pad * 0.45} label={`útil ${fmt(Math.round(model.layout.internalDepth))}`} size={text * 0.85} />
      )}
    </svg>
  );
}
