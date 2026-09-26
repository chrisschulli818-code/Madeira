import { useCallback, useEffect } from 'react';
import { useProjectStore } from '@/store/projectStore';

/**
 * Tela expandida (limpa): esconde cabeçalho, barra de móveis e abas de resultados,
 * e tenta colocar o navegador em tela cheia. Esc ou o botão "Sair" voltam ao normal.
 */
export function useExpanded() {
  const expanded = useProjectStore((s) => s.expanded);
  const setExpanded = useProjectStore((s) => s.setExpanded);

  const toggle = useCallback(
    (next = !useProjectStore.getState().expanded) => {
      setExpanded(next);
      try {
        if (next && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {});
        if (!next && document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
      } catch {
        // Tela cheia é opcional (pode ser bloqueada pelo navegador).
      }
    },
    [setExpanded],
  );

  return { expanded, toggle };
}

/** Sincroniza a tela expandida com Esc e com a saída da tela cheia do navegador. */
export function useExpandedShortcuts() {
  const expanded = useProjectStore((s) => s.expanded);
  const setExpanded = useProjectStore((s) => s.setExpanded);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
      if (e.key === 'Escape' && !typing) setExpanded(false);
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) setExpanded(false);
    };
    let wasFullscreen = !!document.fullscreenElement;
    const onChange = () => {
      if (wasFullscreen) onFullscreen();
      wasFullscreen = !!document.fullscreenElement;
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, [expanded, setExpanded]);
}
