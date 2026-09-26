/**
 * Planta do ambiente (vista de cima) com paredes, portas, janelas e móveis.
 * Os móveis podem ser arrastados: encostam e giram para a parede e se alinham aos vizinhos.
 */
import { useRef } from 'react';
import type { ResolvedPlacement, RoomOpening, RoomSettings } from '@/types/woodcraft';
import type { RoomDrag } from '@/hooks/useRoomDrag';
import { WALL_LABELS } from '@/engine/roomEngine';
import { SELECT_COLOR } from '@/lib/pieceColors';
import { FURNITURE_COLORS } from './roomColors';

const WALL = 120;

interface Props {
  room: RoomSettings;
  placements: ResolvedPlacement[];
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  drag?: RoomDrag;
  className?: string;
}

/** Retângulo da abertura na espessura da parede. */
function openingRect(o: RoomOpening, room: RoomSettings) {
  switch (o.wall) {
    case 'fundo':
      return { x: o.offset, y: -WALL, w: o.width, h: WALL };
    case 'frente':
      return { x: o.offset, y: room.depth, w: o.width, h: WALL };
    case 'esquerda':
      return { x: -WALL, y: o.offset, w: WALL, h: o.width };
    case 'direita':
      return { x: room.width, y: o.offset, w: WALL, h: o.width };
  }
}

/** Arco de abertura da porta (para dentro do cômodo). */
function doorArc(o: RoomOpening, room: RoomSettings) {
  const r = o.width;
  switch (o.wall) {
    case 'fundo':
      return `M ${o.offset} 0 L ${o.offset} ${r} A ${r} ${r} 0 0 0 ${o.offset + r} 0`;
    case 'frente':
      return `M ${o.offset} ${room.depth} L ${o.offset} ${room.depth - r} A ${r} ${r} 0 0 1 ${o.offset + r} ${room.depth}`;
    case 'esquerda':
      return `M 0 ${o.offset} L ${r} ${o.offset} A ${r} ${r} 0 0 1 0 ${o.offset + r}`;
    case 'direita':
      return `M ${room.width} ${o.offset} L ${room.width - r} ${o.offset} A ${r} ${r} 0 0 0 ${room.width} ${o.offset + r}`;
  }
}

/** Linha da frente do móvel (lado oposto às costas). */
function frontLine(p: ResolvedPlacement) {
  const { x, z } = p;
  const { w, d } = p.footprint;
  switch (p.rotation) {
    case 0:
      return [x, z + d, x + w, z + d];
    case 90:
      return [x + w, z, x + w, z + d];
    case 180:
      return [x, z, x + w, z];
    case 270:
      return [x, z, x, z + d];
  }
}

export function RoomPlan2D({ room, placements, selected, onSelect, drag, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const justDragged = useRef(false);
  const pad = WALL + Math.max(room.width, room.depth) * 0.05;
  const font = Math.max(room.width, room.depth) / 32;

  const toMm = (ev: { clientX: number; clientY: number }) => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, z: pt.y };
  };

  const startDrag = (key: string, ev: React.PointerEvent) => {
    const point = toMm(ev);
    if (!drag || ev.button !== 0 || !point || !drag.start(key, point)) return;
    ev.preventDefault();
    justDragged.current = true;
    const onMove = (e: PointerEvent) => {
      const p = toMm(e);
      if (p) drag.move(p);
    };
    const onUp = () => {
      drag.end();
      setTimeout(() => (justDragged.current = false), 0);
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    document.body.style.cursor = 'grabbing';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Móveis de piso primeiro; pendurados (aéreos) por cima, semitransparentes.
  const ordered = [...placements].sort((a, b) => a.elevation - b.elevation);

  return (
    <svg
      ref={svgRef}
      viewBox={`${-pad} ${-pad} ${room.width + 2 * pad} ${room.depth + 2 * pad}`}
      className={className}
      role="img"
      aria-label="Planta do ambiente"
      onClick={(e) => e.target === svgRef.current && !justDragged.current && onSelect?.(null)}
    >
      {/* Piso e paredes */}
      <rect x={-WALL} y={-WALL} width={room.width + 2 * WALL} height={room.depth + 2 * WALL} fill="#6f655a" />
      <rect x={0} y={0} width={room.width} height={room.depth} fill="#f6efe4" onClick={() => !justDragged.current && onSelect?.(null)} />
      {room.openings.map((o) => {
        const r = openingRect(o, room);
        return (
          <g key={o.id}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={o.kind === 'porta' ? '#f6efe4' : '#dbeafe'} stroke="#6f655a" strokeWidth={1} vectorEffect="non-scaling-stroke">
              <title>{`${o.kind === 'porta' ? 'Porta' : 'Janela'} — ${WALL_LABELS[o.wall]}, ${o.width} mm`}</title>
            </rect>
            {o.kind === 'porta' && <path d={doorArc(o, room)} fill="none" stroke="#a8998a" strokeDasharray="6 5" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
          </g>
        );
      })}

      {/* Móveis */}
      {ordered.map((p) => {
        const isSel = p.key === selected;
        const hanging = p.elevation > 0;
        const [x1, y1, x2, y2] = frontLine(p);
        const size = Math.min(font, p.footprint.w / Math.max(6, p.name.length * 0.62), p.footprint.d / 2.4);
        return (
          <g
            key={p.key}
            onPointerDown={(e) => startDrag(p.key, e)}
            onClick={(e) => {
              e.stopPropagation();
              if (!justDragged.current) onSelect?.(p.key);
            }}
            style={{ cursor: drag ? 'grab' : 'pointer', touchAction: 'none' }}
          >
            <rect
              x={p.x}
              y={p.z}
              width={p.footprint.w}
              height={p.footprint.d}
              fill={FURNITURE_COLORS[p.templateId]}
              fillOpacity={hanging ? 0.45 : 0.9}
              stroke={isSel ? SELECT_COLOR : '#3f362c'}
              strokeWidth={isSel ? 3 : 1}
              strokeDasharray={hanging ? '8 5' : undefined}
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${p.name} — ${Math.round(p.size.w)} × ${Math.round(p.size.d)} mm${hanging ? `, a ${p.elevation} mm do piso` : ''}`}</title>
            </rect>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isSel ? SELECT_COLOR : '#3f362c'} strokeWidth={4} vectorEffect="non-scaling-stroke" />
            {size > font * 0.35 && (
              <text x={p.x + p.footprint.w / 2} y={p.z + p.footprint.d / 2} fontSize={size} textAnchor="middle" dominantBaseline="middle" fill="#1f1a14" pointerEvents="none">
                {p.name}
              </text>
            )}
          </g>
        );
      })}

      {/* Cotas do cômodo */}
      <g fill="#1f1a14" fontSize={font} textAnchor="middle">
        <line x1={0} y1={-WALL - pad * 0.35} x2={room.width} y2={-WALL - pad * 0.35} stroke="#6f655a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <text x={room.width / 2} y={-WALL - pad * 0.45}>
          {room.width} mm
        </text>
        <line x1={-WALL - pad * 0.35} y1={0} x2={-WALL - pad * 0.35} y2={room.depth} stroke="#6f655a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <text x={-WALL - pad * 0.45} y={room.depth / 2} transform={`rotate(-90 ${-WALL - pad * 0.45} ${room.depth / 2})`}>
          {room.depth} mm
        </text>
        <text x={room.width / 2} y={room.depth + WALL + pad * 0.5} fill="#6f655a" fontSize={font * 0.8}>
          Frente do cômodo
        </text>
      </g>
    </svg>
  );
}
