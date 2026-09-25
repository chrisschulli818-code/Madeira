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
