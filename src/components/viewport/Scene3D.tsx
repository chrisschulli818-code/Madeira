/**
 * Visualização 3D isométrica do móvel montado (@react-three/fiber).
 * Cada unidade de peça vira um bloco; passar o mouse destaca a peça (e a linha na tabela).
 * Prateleiras, gavetas e painéis do móvel livre podem ser arrastados: o ponteiro é projetado
 * num plano vertical (paralelo à frente do móvel) e o motor de encaixe posiciona a peça.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, Grid, Html, Line, OrbitControls } from '@react-three/drei';
import type { AssembledModel, Annotation, Box3D, CutPiece, MachiningOp, Point3 } from '@/types/woodcraft';
import { MACHINING_COLORS } from '@/engine/joineryEngine';
import { distanceMm, instanceRef, motionIndex, type Motion } from '@/engine/motionEngine';
import { HIGHLIGHT_COLOR, MATERIAL_COLORS, SELECT_COLOR } from '@/lib/pieceColors';
import type { PieceDrag } from '@/hooks/useDragPieces';

const MM = 1 / 1000;
const FRONT_ROLES = new Set(['door', 'drawer-front']);

interface Props {
  model: AssembledModel;
  showFronts: boolean;
  /** 0 = montado, 1 = vista explodida. */
  explode: number;
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  drag?: PieceDrag;
  /** Furos/encaixes para mostrar sobre as peças (só com a vista montada). */
  markers?: MachiningOp[];
  /**
   * Ferramenta do clique: editar (selecionar/arrastar), abrir (portas e gavetas),
   * nota (alfinete com texto) ou medida (dois pontos).
   */
  tool?: SceneTool;
  motions?: Motion[];
  /** Portas/gavetas abertas (ids dos movimentos). */
  openIds?: ReadonlySet<string>;
  onToggleMotion?: (id: string) => void;
  /** Clique numa peça com a ferramenta de nota/medida: ponto (mm) e caixa da peça clicada. */
  onSurfaceClick?: (point: Point3, box: Box3D) => void;
  notes?: Annotation[];
  /** Primeiro ponto de uma medida em andamento. */
  pendingPoint?: Point3 | null;
  activeNoteId?: string | null;
}

export type SceneTool = 'editar' | 'abrir' | 'nota' | 'medida';

const NOTE_COLOR = '#be123c';
const MEASURE_COLOR = '#1d4ed8';

/** Grupo animado de uma porta (gira na dobradiça) ou gaveta (desliza), de fechado (0) a aberto (1). */
function MotionGroup({ motion, open, children }: { motion: Motion; open: boolean; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(open ? 1 : 0);
  const apply = () => {
    const g = ref.current;
    if (!g) return;
    if (motion.kind === 'door') g.rotation.y = motion.sign * THREE.MathUtils.degToRad(motion.angle) * t.current;
    else g.position[motion.axis] = (motion.kind === 'drawer' ? motion.dir * motion.travel * t.current : 0) * MM;
  };
  useFrame((_, dt) => {
    const target = open ? 1 : 0;
    if (t.current === target) return;
    t.current += (target - t.current) * Math.min(1, dt * 7);
    if (Math.abs(target - t.current) < 0.002) t.current = target;
    apply();
  });
  useEffect(apply);
  if (motion.kind === 'door') {
    const { x, z } = motion.pivot;
    return (
      <group position={[x * MM, 0, z * MM]}>
        <group ref={ref}>
          <group position={[-x * MM, 0, -z * MM]}>{children}</group>
        </group>
      </group>
    );
  }
  return <group ref={ref}>{children}</group>;
}

const toVec = (p: Point3): Vec3 => [p.x * MM, p.y * MM, p.z * MM];

/** Notas (alfinetes numerados) e medidas (linha com a distância) sobre o móvel. */
function AnnotationLayer({ notes, pending, activeId }: { notes: Annotation[]; pending?: Point3 | null; activeId?: string | null }) {
  let noteN = 0;
  return (
    <>
      {notes.map((n) => {
        const active = n.id === activeId;
        if (n.kind === 'medida' && n.b) {
          const mid: Point3 = { x: (n.a.x + n.b.x) / 2, y: (n.a.y + n.b.y) / 2, z: (n.a.z + n.b.z) / 2 };
          return (
            <group key={n.id}>
              <Line points={[toVec(n.a), toVec(n.b)]} color={MEASURE_COLOR} lineWidth={active ? 3.5 : 2} depthTest={false} renderOrder={3} />
              {[n.a, n.b].map((p, i) => (
                <mesh key={i} position={toVec(p)} raycast={() => null} renderOrder={3}>
                  <sphereGeometry args={[6 * MM, 12, 12]} />
                  <meshBasicMaterial color={MEASURE_COLOR} depthTest={false} />
                </mesh>
              ))}
              <Html position={toVec(mid)} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
                <div
                  className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white shadow ${active ? 'ring-2 ring-white' : ''}`}
                  style={{ background: MEASURE_COLOR }}
                >
                  {distanceMm(n.a, n.b)} mm{n.text ? ` · ${n.text}` : ''}
                </div>
              </Html>
            </group>
          );
        }
        noteN++;
        return (
          <group key={n.id}>
            <mesh position={toVec(n.a)} raycast={() => null} renderOrder={3}>
              <sphereGeometry args={[8 * MM, 12, 12]} />
              <meshBasicMaterial color={NOTE_COLOR} depthTest={false} />
            </mesh>
            <Html position={toVec(n.a)} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <div className="flex -translate-y-full items-end gap-1 pb-1.5 pl-1">
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white shadow ${active ? 'ring-2 ring-white' : ''}`}
                  style={{ background: NOTE_COLOR }}
                >
                  {noteN}
                </span>
                {n.text && <span className="max-w-44 truncate rounded bg-white/95 px-1.5 py-0.5 text-[11px] text-neutral-800 shadow">{n.text}</span>}
              </div>
            </Html>
          </group>
        );
      })}
      {pending && (
        <mesh position={toVec(pending)} raycast={() => null} renderOrder={3}>
          <sphereGeometry args={[7 * MM, 12, 12]} />
          <meshBasicMaterial color={MEASURE_COLOR} depthTest={false} />
        </mesh>
      )}
    </>
  );
}

type Vec3 = [number, number, number];
type ControlsLike = { enabled: boolean } | null;

/** Converte um ponto do mundo 3D para mm na vista frontal (x, y). */
const toMm = (p: THREE.Vector3, center: Vec3) => ({ x: (p.x + center[0]) / MM, y: p.y / MM });

/**
 * Enquanto uma peça está sendo arrastada, acompanha o ponteiro na janela inteira
 * (mesmo fora da peça) e projeta no plano vertical z = planeZ.
 */
function DragTracker({ planeZ, center, drag, onDone }: { planeZ: number; center: Vec3; drag: PieceDrag; onDone: () => void }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
    const hit = new THREE.Vector3();
    const ndc = new THREE.Vector2();
    const onMove = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) drag.move(toMm(hit, center));
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
    // A sessão de arraste é única: dependências fixas durante o arraste.
  }, []);
  return null;
}

/** Marcadores dos furos: cilindros na posição e direção da broca. */
function DrillMarkers({ ops }: { ops: MachiningOp[] }) {
  return (
    <>
      {ops
        .filter((o) => o.kind !== 'rasgo')
        .map((o, i) => {
          const r = Math.max(o.diameter / 2, 3) * MM;
          const len = Math.min(Math.max(o.depth, 6), 24) * MM;
          const rotation: [number, number, number] = o.axis === 'x' ? [0, 0, Math.PI / 2] : o.axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
          return (
            <mesh key={i} position={[o.world.x * MM, o.world.y * MM, o.world.z * MM]} rotation={rotation} raycast={() => null} renderOrder={2}>
              <cylinderGeometry args={[r, r, len, 16]} />
              <meshBasicMaterial color={MACHINING_COLORS[o.kind]} depthTest={false} transparent opacity={0.9} />
            </mesh>
          );
        })}
    </>
  );
}

function PieceMesh({
  piece,
  box,
  offset,
  hovered,
  selected,
  onHover,
  onSelect,
  draggable,
  onDragStart,
  onGrabHover,
  onToolClick,
  toolCursor,
}: {
  piece: CutPiece;
  box: Box3D;
  offset: [number, number, number];
  hovered: boolean;
  selected: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  draggable: boolean;
  onDragStart: (box: Box3D, point: THREE.Vector3) => void;
  /** Informa que o ponteiro está sobre uma peça arrastável (a órbita da câmera é pausada). */
  onGrabHover: (over: boolean) => void;
  /** Clique tratado pela ferramenta ativa (abrir, nota, medida) em vez de selecionar a peça. */
  onToolClick?: (point: THREE.Vector3) => void;
  /** Cursor de mão/alvo quando a ferramenta ativa age sobre esta peça. */
  toolCursor?: string;
}) {
  const controls = useThree((s) => s.controls) as ControlsLike;
  const color = hovered ? HIGHLIGHT_COLOR : selected ? SELECT_COLOR : (piece.color ?? MATERIAL_COLORS[piece.material]);
  return (
    <mesh
      position={[(box.x + box.w / 2) * MM + offset[0], (box.y + box.h / 2) * MM + offset[1], (box.z + box.d / 2) * MM + offset[2]]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(piece.id);
        if (toolCursor) document.body.style.cursor = toolCursor;
        if (draggable) {
          document.body.style.cursor = 'grab';
          // Sobre uma peça arrastável a órbita fica desligada: o clique arrasta a peça, não gira a câmera.
          if (controls) controls.enabled = false;
          onGrabHover(true);
        }
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHover(null);
        if (document.body.style.cursor === 'grab' || (toolCursor && document.body.style.cursor === toolCursor)) document.body.style.cursor = '';
        if (draggable) onGrabHover(false);
      }}
      onPointerDown={(e) => {
        if (!draggable || e.button !== 0) return;
        e.stopPropagation();
        if (controls) controls.enabled = false;
        onDragStart(box, e.point.clone());
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Clique depois de girar a câmera não conta.
        if (e.delta > 6) return;
        if (onToolClick) onToolClick(e.point.clone());
        else onSelect(selected ? null : piece.id);
      }}
    >
      <boxGeometry args={[box.w * MM, box.h * MM, box.d * MM]} />
      <meshStandardMaterial color={color} roughness={0.75} emissive={hovered ? HIGHLIGHT_COLOR : '#000000'} emissiveIntensity={hovered ? 0.25 : 0} />
      <Edges color={hovered || selected ? '#78350f' : '#5b4e40'} threshold={15} />
    </mesh>
  );
}

export default function Scene3D({
  model,
  showFronts,
  explode,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
  drag,
  markers,
  tool = 'editar',
  motions = [],
  openIds,
  onToggleMotion,
  onSurfaceClick,
  notes = [],
  pendingPoint,
  activeNoteId,
}: Props) {
  const { width: W, height: H, depth: D } = model.overall;
  // Durante o arraste a cena fica "congelada" (o móvel pode crescer sem deslocar a vista).
  const [frozen, setFrozen] = useState<{ size: number; center: Vec3; planeZ: number } | null>(null);
  /** Ponteiro sobre peça arrastável: pausa a órbita (controlado via prop para não ser reativado a cada render). */
  const [overGrab, setOverGrab] = useState(false);
  /** O clique que acontece ao soltar um arraste não deve (des)selecionar a peça. */
  const justDragged = useRef(false);
  const select = (id: string | null) => {
    if (!justDragged.current) onSelect(id);
  };
  // Móvel vazio (móvel livre recém-criado): usa uma cena de 1 m como referência.
  const size = frozen?.size ?? Math.max(W, H, D, 1000) * MM;
  const center: Vec3 = frozen?.center ?? [(W / 2) * MM, (H / 2) * MM, (D / 2) * MM];

  // Furos só das peças visíveis (sem as frentes, os canecos das portas não aparecem).
  const visibleIds = new Set(model.pieces.filter((p) => showFronts || !FRONT_ROLES.has(p.role)).map((p) => p.id));

  const startDrag = (box: Box3D, point: THREE.Vector3) => {
    if (!drag || !drag.start(box, toMm(point, center))) return;
    justDragged.current = true;
    setFrozen({ size, center, planeZ: point.z });
  };

  const items = useMemo(
    () =>
      model.pieces
        .filter((p) => showFronts || !FRONT_ROLES.has(p.role))
        .flatMap((piece) =>
          piece.instances.map((box, i) => {
            // Vista explodida: afasta cada peça do centro do móvel, proporcional à distância.
            const cx = (box.x + box.w / 2) * MM - center[0];
            const cy = (box.y + box.h / 2) * MM - center[1];
            const cz = (box.z + box.d / 2) * MM - center[2] + (FRONT_ROLES.has(piece.role) ? size * 0.3 : 0);
            const f = explode * 0.6;
            return { piece, box, ref: instanceRef(piece.id, i), key: `${piece.id}-${i}`, offset: [cx * f, cy * f, cz * f] as [number, number, number] };
          }),
        ),
    [model.pieces, showFronts, explode, size, center[0], center[1], center[2]],
  );

  return (
    <Canvas
      camera={{ position: [size * 1.2, size * 0.9, size * 1.65], fov: 35, near: 0.01, far: 100 }}
      dpr={[1, 2]}
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={['#f6f2ec']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} />
      <group position={[-center[0], 0, -center[2]]}>
        {(() => {
          const byRef = motionIndex(motions);
          const mesh = ({ piece, box, key, offset, ref }: (typeof items)[number]) => {
            const motion = byRef.get(ref);
            const toolClick =
              tool === 'abrir'
                ? motion
                  ? () => onToggleMotion?.(motion.id)
                  : () => undefined
                : tool === 'nota' || tool === 'medida'
                  ? (p: THREE.Vector3) => onSurfaceClick?.({ x: (p.x + center[0]) / MM, y: p.y / MM, z: (p.z + center[2]) / MM }, box)
                  : undefined;
            return (
              <PieceMesh
                key={key}
                piece={piece}
                box={box}
                offset={offset}
                hovered={piece.id === hoveredId}
                selected={piece.id === selectedId}
                onHover={onHover}
                onSelect={select}
                draggable={tool === 'editar' && !!drag && explode === 0 && drag.canDrag(box)}
                onDragStart={startDrag}
                onGrabHover={setOverGrab}
                onToolClick={toolClick}
                toolCursor={tool === 'abrir' ? (motion ? 'pointer' : undefined) : tool === 'editar' ? undefined : 'crosshair'}
              />
            );
          };
          const still = items.filter((it) => !byRef.has(it.ref));
          return (
            <>
              {still.map(mesh)}
              {motions.map((m) => {
                const parts = items.filter((it) => byRef.get(it.ref) === m);
                if (!parts.length) return null;
                return (
                  <MotionGroup key={m.id} motion={m} open={!!openIds?.has(m.id)}>
                    {parts.map(mesh)}
                  </MotionGroup>
                );
              })}
            </>
          );
        })()}
        <AnnotationLayer notes={notes} pending={pendingPoint} activeId={activeNoteId} />
        {markers && explode === 0 && <DrillMarkers ops={markers.filter((o) => visibleIds.has(o.pieceId))} />}
      </group>
      {frozen && drag && <DragTracker
          planeZ={frozen.planeZ}
          center={frozen.center}
          drag={drag}
          onDone={() => {
            setFrozen(null);
            setTimeout(() => (justDragged.current = false), 0);
          }}
        />}
      <Grid
        args={[10, 10]}
        cellSize={0.1}
        sectionSize={0.5}
        cellColor="#e6dfd4"
        sectionColor="#cdbfa9"
        fadeDistance={size * 6}
        infiniteGrid
        position={[0, -0.001, 0]}
      />
      <OrbitControls
        makeDefault
        enabled={!frozen && !overGrab}
        target={[0, center[1], 0]}
        minDistance={size * 0.4}
        maxDistance={size * 6}
        enableDamping
      />
    </Canvas>
  );
}
