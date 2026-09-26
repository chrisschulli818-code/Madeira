import type { EdgeBanding } from '@/types/woodcraft';

/**
 * Mini-diagrama da peça: bordas destacadas recebem fita.
 * Horizontais = lados do comprimento (C); verticais = lados da largura (L).
 */
export function EdgeBandIcon({ edge, className }: { edge: EdgeBanding; className?: string }) {
  const on = '#b45309';
  const off = '#d6cbbb';
  return (
    <svg viewBox="0 0 30 18" className={className} width={30} height={18} aria-hidden>
      <rect x={3} y={3} width={24} height={12} fill="#f6efe4" />
      <line x1={3} y1={3} x2={27} y2={3} stroke={edge.length >= 1 ? on : off} strokeWidth={edge.length >= 1 ? 3 : 1} />
      <line x1={3} y1={15} x2={27} y2={15} stroke={edge.length >= 2 ? on : off} strokeWidth={edge.length >= 2 ? 3 : 1} />
      <line x1={3} y1={3} x2={3} y2={15} stroke={edge.width >= 1 ? on : off} strokeWidth={edge.width >= 1 ? 3 : 1} />
      <line x1={27} y1={3} x2={27} y2={15} stroke={edge.width >= 2 ? on : off} strokeWidth={edge.width >= 2 ? 3 : 1} />
    </svg>
  );
}
