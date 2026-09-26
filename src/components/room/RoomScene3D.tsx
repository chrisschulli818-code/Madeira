/**
 * Ambiente em 3D: piso, paredes (com vãos de portas e janelas) e todos os móveis do projeto.
 * Os móveis podem ser arrastados sobre o piso; o encaixe é o mesmo da planta.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import type { AssembledModel, ResolvedPlacement, RoomOpening, RoomSettings, WallSide } from '@/types/woodcraft';
import { placementTransform, wallLength } from '@/engine/roomEngine';
import { MATERIAL_COLORS, SELECT_COLOR } from '@/lib/pieceColors';
import type { RoomDrag } from '@/hooks/useRoomDrag';

const MM = 1 / 1000;
const WALL_T = 120;

interface Props {
  room: RoomSettings;
  placements: ResolvedPlacement[];
  models: Map<string, AssembledModel>;
  selected: string | null;
  onSelect: (key: string | null) => void;
  drag: RoomDrag;
}

type Controls = { enabled: boolean } | null;

/** Trechos de parede ao redor das aberturas: [início, fim, base, topo] ao longo da parede (mm). */
function wallSegments(length: number, height: number, openings: RoomOpening[]): Array<[number, number, number, number]> {
  const segs: Array<[number, number, number, number]> = [];
  let cursor = 0;
  for (const o of [...openings].sort((a, b) => a.offset - b.offset)) {
    const a = Math.max(0, Math.min(length, o.offset));
    const b = Math.max(a, Math.min(length, o.offset + o.width));
    if (a > cursor) segs.push([cursor, a, 0, height]);
    const bottom = o.kind === 'porta' ? 0 : o.sill;
    if (bottom > 0) segs.push([a, b, 0, bottom]);
    const top = Math.min(height, bottom + o.height);
    if (top < height) segs.push([a, b, top, height]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < length) segs.push([cursor, length, 0, height]);
  return segs;
}

function Walls({ room }: { room: RoomSettings }) {
  const walls: WallSide[] = ['fundo', 'esquerda', 'direita', 'frente'];
  return (
    <>
      {walls.flatMap((wall) =>
        wallSegments(wallLength(room, wall), room.height, room.openings.filter((o) => o.wall === wall)).map(([a, b, y0, y1], i) => {
          const len = b - a;
          const h = y1 - y0;
          const along = a + len / 2;
          const pos: [number, number, number] =
            wall === 'fundo'
              ? [along, y0 + h / 2, -WALL_T / 2]
              : wall === 'frente'
                ? [along, y0 + h / 2, room.depth + WALL_T / 2]
                : wall === 'esquerda'
                  ? [-WALL_T / 2, y0 + h / 2, along]
                  : [room.width + WALL_T / 2, y0 + h / 2, along];
          const size: [number, number, number] = wall === 'fundo' || wall === 'frente' ? [len, h, WALL_T] : [WALL_T, h, len];
          // A parede da frente fica bem transparente para não esconder os móveis.
          const opacity = wall === 'frente' ? 0.12 : 0.55;
          return (
            <mesh key={`${wall}-${i}`} position={pos.map((v) => v * MM) as [number, number, number]} raycast={() => null}>
              <boxGeometry args={size.map((v) => v * MM) as [number, number, number]} />
              <meshStandardMaterial color="#e7e1d8" transparent opacity={opacity} depthWrite={wall !== 'frente'} />
            </mesh>
          );
        }),
      )}
    </>
  );
}

/** Um móvel posicionado: suas peças dentro de um grupo com posição e rotação. */
function Furniture({
  placement,
  model,
  selected,
  onSelect,
  onDragStart,
  onGrabHover,
}: {
  placement: ResolvedPlacement;
  model: AssembledModel;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (point: THREE.Vector3) => void;
  onGrabHover: (over: boolean) => void;
}) {
  const controls = useThree((s) => s.controls) as Controls;
  const t = placementTransform(placement);
  return (
    <group
      position={[t.position.x * MM, t.position.y * MM, t.position.z * MM]}
      rotation={[0, t.rotationY, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'grab';
        if (controls) controls.enabled = false;
        onGrabHover(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        if (document.body.style.cursor === 'grab') document.body.style.cursor = '';
        onGrabHover(false);
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        if (controls) controls.enabled = false;
        onDragStart(e.point.clone());
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <group position={[t.pieceOffset.x * MM, t.pieceOffset.y * MM, t.pieceOffset.z * MM]}>
        {model.pieces.flatMap((piece) =>
          piece.instances.map((b, i) => (
            <mesh key={`${piece.id}-${i}`} position={[(b.x + b.w / 2) * MM, (b.y + b.h / 2) * MM, (b.z + b.d / 2) * MM]}>
              <boxGeometry args={[b.w * MM, b.h * MM, b.d * MM]} />
              <meshStandardMaterial color={MATERIAL_COLORS[piece.material]} roughness={0.8} />
              <Edges color={selected ? SELECT_COLOR : '#5b4e40'} threshold={15} />
            </mesh>
          )),
        )}
      </group>
    </group>
  );
}

/** Acompanha o ponteiro na janela durante o arraste, projetando no plano horizontal y = altura. */
function FloorDragTracker({ planeY, center, drag, onDone }: { planeY: number; center: { x: number; z: number }; drag: RoomDrag; onDone: () => void }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    const hit = new THREE.Vector3();
    const ndc = new THREE.Vector2();
    const onMove = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) drag.move({ x: hit.x / MM + center.x, z: hit.z / MM + center.z });
    };
    const onUp = () => {
      drag.end();
      onDone();
    };
    document.body.style.cursor = 'grabbing';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
    };
    // Sessão única de arraste.
  }, []);
  return null;
}

export default function RoomScene3D({ room, placements, models, selected, onSelect, drag }: Props) {
  const size = Math.max(room.width, room.depth, room.height) * MM;
  // Cena centrada no meio do piso.
  const center = { x: room.width / 2, z: room.depth / 2 };
  const [dragPlane, setDragPlane] = useState<number | null>(null);
  const [overGrab, setOverGrab] = useState(false);
  const justDragged = useRef(false);

  const floor = useMemo(() => new THREE.PlaneGeometry(room.width * MM, room.depth * MM), [room.width, room.depth]);

  return (
    <Canvas camera={{ position: [size * 0.35, size * 1.05, size * 1.25], fov: 40, near: 0.01, far: 200 }} dpr={[1, 2]} onPointerMissed={() => !justDragged.current && onSelect(null)}>
      <color attach="background" args={['#f6f2ec']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 6, 5]} intensity={1.5} />
      <directionalLight position={[-4, 3, -2]} intensity={0.35} />
      <group position={[-center.x * MM, 0, -center.z * MM]}>
        <mesh geometry={floor} rotation={[-Math.PI / 2, 0, 0]} position={[(room.width / 2) * MM, 0, (room.depth / 2) * MM]} raycast={() => null}>
          <meshStandardMaterial color="#efe6d8" />
        </mesh>
        <Walls room={room} />
        {placements.map((p) => {
          const model = models.get(p.itemId);
          if (!model) return null;
          return (
            <Furniture
              key={p.key}
              placement={p}
              model={model}
              selected={p.key === selected}
              onSelect={() => !justDragged.current && onSelect(p.key)}
              onGrabHover={setOverGrab}
              onDragStart={(point) => {
                const local = { x: point.x / MM + center.x, z: point.z / MM + center.z };
                if (!drag.start(p.key, local)) return;
                justDragged.current = true;
                setDragPlane(point.y);
              }}
            />
          );
        })}
      </group>
      {dragPlane !== null && (
        <FloorDragTracker
          planeY={dragPlane}
          center={center}
          drag={drag}
          onDone={() => {
            setDragPlane(null);
            setTimeout(() => (justDragged.current = false), 0);
          }}
        />
      )}
      <OrbitControls makeDefault enabled={dragPlane === null && !overGrab} target={[0, (room.height / 3) * MM, 0]} minDistance={size * 0.3} maxDistance={size * 5} enableDamping />
    </Canvas>
  );
}
