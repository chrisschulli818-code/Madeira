import type { SheetLayout, SheetSettings } from '@/types/woodcraft';
import { HIGHLIGHT_COLOR } from '@/lib/pieceColors';

/** Desenho 2D de uma chapa com as peças posicionadas (x = comprimento, y = largura). */
export function SheetDiagram({
  layout,
  sheet,
  color,
  hoveredId,
  onHover,
  className,
}: {
  layout: SheetLayout;
  sheet: SheetSettings;
  color: string;
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
  className?: string;
}) {
  const font = sheet.width / 22;
  return (
    <svg viewBox={`0 0 ${sheet.length} ${sheet.width}`} className={className} role="img" aria-label={`Chapa ${layout.index + 1}`} onMouseLeave={() => onHover?.(null)}>
      <defs>
        <pattern id="waste" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="40" stroke="#d6cbbb" strokeWidth="6" />
        </pattern>
      </defs>
      <rect width={sheet.length} height={sheet.width} fill="url(#waste)" stroke="#6f655a" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <rect
        x={sheet.trim}
        y={sheet.trim}
        width={sheet.length - 2 * sheet.trim}
        height={sheet.width - 2 * sheet.trim}
        fill="none"
        stroke="#a8998a"
        strokeDasharray="4 3"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {layout.placements.map((pl, i) => {
        const active = pl.pieceId === hoveredId;
        const small = Math.min(pl.w, pl.h);
        const size = Math.min(font, small / 3.2, pl.w / (Math.max(pl.label.length, 9) * 0.62));
        return (
          <g key={i} onMouseEnter={() => onHover?.(pl.pieceId)} style={{ cursor: onHover ? 'pointer' : undefined }}>
            <rect
              x={pl.x}
              y={pl.y}
              width={pl.w}
              height={pl.h}
              fill={active ? HIGHLIGHT_COLOR : color}
              stroke="#3f362c"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${pl.label} — ${pl.rotated ? `${pl.h} × ${pl.w}` : `${pl.w} × ${pl.h}`} mm${pl.rotated ? ' (girada)' : ''}`}</title>
            </rect>
            {size > 14 && (
              <text x={pl.x + pl.w / 2} y={pl.y + pl.h / 2} fontSize={size} textAnchor="middle" dominantBaseline="middle" fill="#1f1a14" pointerEvents="none">
                <tspan x={pl.x + pl.w / 2} dy={-size * 0.55}>{pl.label}</tspan>
                <tspan x={pl.x + pl.w / 2} dy={size * 1.15} fill="#5b4e40">
                  {pl.rotated ? `${pl.h}×${pl.w}` : `${pl.w}×${pl.h}`}
                </tspan>
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
