/**
 * Controle de arraste de peças no viewport (3D e vista frontal).
 *
 * Guarda um retrato do móvel no início do arraste e, a cada movimento, aplica
 * `applyDrag(retrato, deslocamento)` — o motor encaixa a peça e o móvel é atualizado ao vivo.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { applyDrag, type HandleRef } from '@/engine/dragEngine';
import type { AssembledModel, Box3D, ProjectItem } from '@/types/woodcraft';

interface Session {
  item: ProjectItem;
  model: AssembledModel;
  ref: HandleRef;
  box: Box3D;
  start: { x: number; y: number };
}

export interface PieceDrag {
  /** A instância pode ser arrastada? */
  canDrag: (box: Box3D) => boolean;
  /** Inicia o arraste da instância a partir do ponto (mm, vista frontal). */
  start: (box: Box3D, point: { x: number; y: number }) => boolean;
  move: (point: { x: number; y: number }) => void;
  end: () => void;
  dragging: boolean;
}

export function useDragPieces(enabled = true): PieceDrag {
  const { active } = useResults();
  const replaceItem = useProjectStore((s) => s.replaceItem);
  const selectPiece = useProjectStore((s) => s.selectPiece);
  const session = useRef<Session | null>(null);
  const [dragging, setDragging] = useState(false);

  const handles = useMemo(() => new Map((active.model.handles ?? []).map((h) => [h.box, h])), [active.model]);

  const canDrag = useCallback((box: Box3D) => enabled && handles.has(box), [enabled, handles]);

  const start = useCallback(
    (box: Box3D, point: { x: number; y: number }) => {
      const handle = enabled ? handles.get(box) : undefined;
      if (!handle) return false;
      const { box: _box, ...ref } = handle;
      session.current = { item: active.item, model: active.model, ref, box, start: point };
      const piece = active.model.pieces.find((p) => p.instances.includes(box));
      if (piece) selectPiece(piece.id);
      setDragging(true);
      return true;
    },
    [enabled, handles, active, selectPiece],
  );

  const move = useCallback(
    (point: { x: number; y: number }) => {
      const s = session.current;
      if (!s) return;
      const result = applyDrag(s.item, s.model, s.ref, s.box, { dx: point.x - s.start.x, dy: point.y - s.start.y });
      replaceItem(result ? result.item : s.item);
    },
    [replaceItem],
  );

  const end = useCallback(() => {
    session.current = null;
    setDragging(false);
  }, []);

  return { canDrag, start, move, end, dragging };
}
