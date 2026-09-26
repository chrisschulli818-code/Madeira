/**
 * Arrastar móveis no ambiente (planta 2D e 3D).
 * Guarda a posição no início do arraste e, a cada movimento, reencaixa com `snapPlacement`.
 */
import { useCallback, useRef, useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { snapPlacement } from '@/engine/roomEngine';
import type { ResolvedPlacement } from '@/types/woodcraft';

interface Session {
  placement: ResolvedPlacement;
  others: ResolvedPlacement[];
  start: { x: number; z: number };
}

export interface RoomDrag {
  start: (key: string, point: { x: number; z: number }) => boolean;
  move: (point: { x: number; z: number }) => void;
  end: () => void;
  dragging: boolean;
}

export function useRoomDrag(): RoomDrag {
  const { placements } = useResults();
  const room = useProjectStore((s) => s.room);
  const setPlacement = useProjectStore((s) => s.setPlacement);
  const selectPlacement = useProjectStore((s) => s.selectPlacement);
  const session = useRef<Session | null>(null);
  const [dragging, setDragging] = useState(false);

  const start = useCallback(
    (key: string, point: { x: number; z: number }) => {
      const placement = placements.find((p) => p.key === key);
      if (!placement) return false;
      session.current = { placement, others: placements.filter((p) => p.key !== key), start: point };
      selectPlacement(key);
      setDragging(true);
      return true;
    },
    [placements, selectPlacement],
  );

  const move = useCallback(
    (point: { x: number; z: number }) => {
      const s = session.current;
      if (!s) return;
      const p = s.placement;
      const r = snapPlacement(p, { x: p.x + point.x - s.start.x, z: p.z + point.z - s.start.z }, room, s.others);
      setPlacement({ itemId: p.itemId, unit: p.unit, elevation: p.elevation, ...r });
    },
    [room, setPlacement],
  );

  const end = useCallback(() => {
    session.current = null;
    setDragging(false);
  }, []);

  return { start, move, end, dragging };
}
