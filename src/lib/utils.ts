import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Concatena classes Tailwind resolvendo conflitos (padrão shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const pf = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

export const fmt = (n: number) => nf.format(n);
export const fmtPct = (n: number) => pf.format(n);
export const fmtMm = (n: number) => `${nf.format(n)} mm`;

/** Dispara o download de um arquivo gerado no navegador. */
export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  // BOM para o Excel reconhecer UTF-8 (acentos).
  const blob = new Blob(['﻿', content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'projeto';
