/**
 * Visualização 3D isométrica do móvel montado (@react-three/fiber).
 * Cada unidade de peça vira um bloco; passar o mouse destaca a peça (e a linha na tabela).
 */
import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Edges, Grid, OrbitControls } from '@react-three/drei';
import type { AssembledModel, Box3D, CutPiece } from '@/types/woodcraft';
import { HIGHLIGHT_COLOR, MATERIAL_COLORS, SELECT_COLOR } from '@/lib/pieceColors';

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
}

function PieceMesh({
  piece,
  box,
  offset,
  hovered,
  selected,
  onHover,
  onSelect,
}: {
  piece: CutPiece;
  box: Box3D;
  offset: [number, number, number];
  hovered: boolean;
  selected: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}) {
  const color = hovered ? HIGHLIGHT_COLOR : selected ? SELECT_COLOR : MATERIAL_COLORS[piece.material];
  return (
    <mesh
      position={[(box.x + box.w / 2) * MM + offset[0], (box.y + box.h / 2) * MM + offset[1], (box.z + box.d / 2) * MM + offset[2]]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(piece.id);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHover(null);
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

export default function Scene3D({ model, showFronts, explode, hoveredId, selectedId, onHover, onSelect }: Props) {
  const { width: W, height: H, depth: D } = model.overall;
  const size = Math.max(W, H, D) * MM;
  const center: [number, number, number] = [(W / 2) * MM, (H / 2) * MM, (D / 2) * MM];

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
      onPointerMissed={() => onSelect(null)}
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
            onSelect={onSelect}
          />
        ))}
      </group>
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
      <OrbitControls makeDefault target={[0, center[1], 0]} minDistance={size * 0.4} maxDistance={size * 6} enableDamping />
    </Canvas>
  );
}
