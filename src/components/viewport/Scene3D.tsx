/**
 * Visualização 3D isométrica do móvel montado (@react-three/fiber).
 * Cada unidade de peça vira um bloco; passar o mouse destaca a peça (e a linha na tabela).
 * Prateleiras, gavetas e painéis do móvel livre podem ser arrastados: o ponteiro é projetado
 * num plano vertical (paralelo à frente do móvel) e o motor de encaixe posiciona a peça.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Edges, Grid, OrbitControls } from '@react-three/drei';
import type { AssembledModel, Box3D, CutPiece } from '@/types/woodcraft';
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
}) {
  const controls = useThree((s) => s.controls) as ControlsLike;
  const color = hovered ? HIGHLIGHT_COLOR : selected ? SELECT_COLOR : MATERIAL_COLORS[piece.material];
  return (
    <mesh
      position={[(box.x + box.w / 2) * MM + offset[0], (box.y + box.h / 2) * MM + offset[1], (box.z + box.d / 2) * MM + offset[2]]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(piece.id);
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
        if (document.body.style.cursor === 'grab') document.body.style.cursor = '';
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
        onSelect(selected ? null : piece.id);
      }}
    >
      <boxGeometry args={[box.w * MM, box.h * MM, box.d * MM]} />
      <meshStandardMaterial color={color} roughness={0.75} emissive={hovered ? HIGHLIGHT_COLOR : '#000000'} emissiveIntensity={hovered ? 0.25 : 0} />
      <Edges color={hovered || selected ? '#78350f' : '#5b4e40'} threshold={15} />
    </mesh>
  );
}

export default function Scene3D({ model, showFronts, explode, hoveredId, selectedId, onHover, onSelect, drag }: Props) {
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
            return { piece, box, key: `${piece.id}-${i}`, offset: [cx * f, cy * f, cz * f] as [number, number, number] };
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
        {items.map(({ piece, box, key, offset }) => (
          <PieceMesh
            key={key}
            piece={piece}
            box={box}
            offset={offset}
            hovered={piece.id === hoveredId}
            selected={piece.id === selectedId}
            onHover={onHover}
            onSelect={select}
            draggable={!!drag && explode === 0 && drag.canDrag(box)}
            onDragStart={startDrag}
            onGrabHover={setOverGrab}
          />
        ))}
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
