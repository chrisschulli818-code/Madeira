/**
 * Exportação da lista de corte em CSV (formato aceito por planilhas e por
 * softwares de plano de corte das madeireiras).
 * Usa ";" como separador e vírgula decimal, padrão do Excel em pt-BR.
 */
import type { CutPiece, MaterialRole, MaterialSpec } from '@/types/woodcraft';

const escapeCsv = (v: string | number) => {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function cutListToCsv(pieces: CutPiece[], materials: Record<MaterialRole, MaterialSpec>): string {
  const header = [
    'Peça',
    'Qtd',
    'Comprimento (mm)',
    'Largura (mm)',
    'Espessura (mm)',
    'Material',
    'Fita comprimento (C)',
    'Fita largura (L)',
    'Veio travado',
    'Observações',
  ];
  const rows = pieces.map((p) => [
    p.name,
    p.quantity,
    p.length,
    p.width,
    p.thickness,
    materials[p.material].label,
    p.edgeBanding.length,
    p.edgeBanding.width,
    p.grain === 'length' && materials[p.material].hasGrain ? 'Sim' : 'Não',
    p.notes ?? '',
  ]);
  return [header, ...rows].map((r) => r.map(escapeCsv).join(';')).join('\r\n');
}
