import type { MaterialRole } from '@/types/woodcraft';

/** Cores por material (mesmos valores dos tokens CSS --color-mat-*). */
export const MATERIAL_COLORS: Record<MaterialRole, string> = {
  carcass: '#e9dcc6',
  front: '#c98f5a',
  back: '#b8ab97',
  drawer: '#dccbad',
};

export const HIGHLIGHT_COLOR = '#f59e0b';
export const SELECT_COLOR = '#0f766e';

/** Tons aproximados pelo nome comercial do material (para as imagens realistas do ambiente). */
const LABEL_TONES: Array<[RegExp, string]> = [
  [/preto|black/i, '#2f2d2b'],
  [/grafite|chumbo/i, '#55575a'],
  [/cinza|concreto/i, '#9a9894'],
  [/nogueira|imbuia|tabaco|castanho/i, '#7a5236'],
  [/freij[oó]|louro|cumaru|canela/i, '#a8743f'],
  [/carvalho|amadeirad|madeira|carvalh/i, '#b9895a'],
  [/pinus|pinho|compensado|osb|cru/i, '#d6bb8e'],
  [/areia|bege|off/i, '#ddd0b8'],
  [/verde/i, '#6f8a6a'],
  [/azul/i, '#5b7896'],
  [/branco|white/i, '#f3f1ec'],
];

export function materialTone(label: string, role: MaterialRole): string {
  for (const [re, color] of LABEL_TONES) if (re.test(label)) return color;
  return MATERIAL_COLORS[role];
}
