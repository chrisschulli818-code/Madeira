/**
 * Ambiente em 3D: piso, paredes (com vãos de portas e janelas) e todos os móveis do projeto.
 * Os móveis podem ser arrastados sobre o piso; o encaixe é o mesmo da planta.
 * A câmera pode ir para pontos de vista dentro do cômodo e a cena pode ser capturada como imagem PNG.
 */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import type { AssembledModel, MaterialRole, ResolvedPlacement, RoomOpening, RoomSettings, WallSide } from '@/types/woodcraft';
import { placementTransform, wallLength, type Viewpoint } from '@/engine/roomEngine';
import { MATERIAL_COLORS, SELECT_COLOR } from '@/lib/pieceColors';
import type { RoomDrag } from '@/hooks/useRoomDrag';
import { DEFAULT_FLOOR_COLOR, DEFAULT_WALL_COLOR } from './roomDefaults';

const MM = 1 / 1000;
const WALL_T = 120;

export interface Capture {
  dataUrl: string;
  width: number;
  height: number;
}
/** Captura a cena atual em alta resolução. */
export type CaptureFn = () => Capture;

interface Props {
  room: RoomSettings;
  placements: ResolvedPlacement[];
  models: Map<string, AssembledModel>;
  selected: string | null;
  onSelect: (key: string | null) => void;
  drag: RoomDrag;
  /** Cor de cada material (pelo nome comercial). */
  tones?: Record<MaterialRole, string>;
  /** Ponto de vista a aplicar; `nonce` muda para reaplicar o mesmo ponto. */
  viewpoint?: (Viewpoint & { nonce: number }) | null;
  captureRef?: MutableRefObject<CaptureFn | null>;
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

/** Lado de fora de cada parede: se a câmera está ali, a parede fica transparente para não tapar a vista. */
function cameraOutside(wall: WallSide, cam: { x: number; z: number }, room: RoomSettings): boolean {
  switch (wall) {
    case 'fundo':
      return cam.z < 0;
    case 'frente':
      return cam.z > room.depth;
    case 'esquerda':
      return cam.x < 0;
    case 'direita':
      return cam.x > room.width;
  }
}

function Walls({ room, center }: { room: RoomSettings; center: { x: number; z: number } }) {
  const walls: WallSide[] = ['fundo', 'esquerda', 'direita', 'frente'];
  const mats = useRef(new Map<string, THREE.MeshStandardMaterial>());
  const color = room.wallColor ?? DEFAULT_WALL_COLOR;
  useFrame(({ camera }) => {
    const cam = { x: camera.position.x / MM + center.x, z: camera.position.z / MM + center.z };
    for (const [key, m] of mats.current) {
      const wall = key.split('-')[0] as WallSide;
      const opacity = cameraOutside(wall, cam, room) ? 0.12 : 1;
      if (m.opacity !== opacity) {
        m.opacity = opacity;
        m.transparent = opacity < 1;
        m.depthWrite = opacity === 1;
        m.needsUpdate = true;
      }
    }
  });
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
          const key = `${wall}-${i}`;
          return (
            <mesh key={key} position={pos.map((v) => v * MM) as [number, number, number]} raycast={() => null} receiveShadow castShadow>
              <boxGeometry args={size.map((v) => v * MM) as [number, number, number]} />
              <meshStandardMaterial
                ref={(m) => {
                  if (m) mats.current.set(key, m);
                  else mats.current.delete(key);
                }}
                color={color}
                roughness={0.95}
              />
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
  tones,
}: {
  placement: ResolvedPlacement;
  model: AssembledModel;
  tones: Record<MaterialRole, string>;
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
            <mesh key={`${piece.id}-${i}`} position={[(b.x + b.w / 2) * MM, (b.y + b.h / 2) * MM, (b.z + b.d / 2) * MM]} castShadow receiveShadow>
              <boxGeometry args={[b.w * MM, b.h * MM, b.d * MM]} />
              <meshStandardMaterial color={piece.color ?? tones[piece.material]} roughness={piece.decorative ? 0.9 : 0.7} />
              <Edges color={selected ? SELECT_COLOR : piece.decorative ? '#6b6258' : '#5b4e40'} threshold={15} />
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

/** Leva a câmera (e o alvo da órbita) para o ponto de vista escolhido. */
function CameraRig({ viewpoint, center }: { viewpoint: NonNullable<Props['viewpoint']>; center: { x: number; z: number } }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    const w = (p: { x: number; y: number; z: number }) => new THREE.Vector3((p.x - center.x) * MM, p.y * MM, (p.z - center.z) * MM);
    camera.position.copy(w(viewpoint.position));
    camera.fov = viewpoint.fov;
    camera.updateProjectionMatrix();
    const target = w(viewpoint.target);
    camera.lookAt(target);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
    // Reaplica quando o ponto (ou o nonce) muda, ou quando os controles ficam prontos.
  }, [viewpoint.id, viewpoint.nonce, controls, camera, center.x, center.z, viewpoint.position.x, viewpoint.position.z, viewpoint.target.x, viewpoint.target.z]);
  return null;
}

/** Registra a função de captura (render em resolução maior → PNG). */
function Capturer({ captureRef }: { captureRef: MutableRefObject<CaptureFn | null> }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => {
    captureRef.current = () => {
      // Imagem em Full HD (16:9), independente do tamanho da tela.
      const W = 1920;
      const H = 1080;
      const cam = camera as THREE.PerspectiveCamera;
      const prevRatio = gl.getPixelRatio();
      const prevAspect = cam.aspect;
      gl.setPixelRatio(1);
      gl.setSize(W, H, false);
      cam.aspect = W / H;
      cam.updateProjectionMatrix();
      gl.render(scene, cam);
      const out = { dataUrl: gl.domElement.toDataURL('image/png'), width: W, height: H };
      gl.setPixelRatio(prevRatio);
      gl.setSize(size.width, size.height, false);
      cam.aspect = prevAspect;
      cam.updateProjectionMatrix();
      gl.render(scene, cam);
      return out;
    };
    return () => {
      captureRef.current = null;
    };
  }, [gl, scene, camera, size.width, size.height, captureRef]);
  return null;
}

export default function RoomScene3D({ room, placements, models, selected, onSelect, drag, tones = MATERIAL_COLORS, viewpoint, captureRef }: Props) {
  const size = Math.max(room.width, room.depth, room.height) * MM;
  // Cena centrada no meio do piso.
  const center = { x: room.width / 2, z: room.depth / 2 };
  const [dragPlane, setDragPlane] = useState<number | null>(null);
  const [overGrab, setOverGrab] = useState(false);
  const justDragged = useRef(false);

  // Array estável: um novo a cada render faria a órbita voltar ao centro.
  const orbitTarget = useMemo(() => [0, (room.height / 3) * MM, 0] as [number, number, number], [room.height]);
  const floor = useMemo(() => new THREE.PlaneGeometry(room.width * MM, room.depth * MM), [room.width, room.depth]);

  return (
    <Canvas
      shadows
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ position: [size * 0.35, size * 1.05, size * 1.25], fov: 40, near: 0.01, far: 200 }}
      dpr={[1, 2]}
      onPointerMissed={() => !justDragged.current && onSelect(null)}
    >
      <color attach="background" args={['#f6f2ec']} />
      <hemisphereLight args={['#fffaf0', '#8a7a66', 0.9]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[size * 0.4, size * 1.2, size * 0.7]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
        shadow-camera-near={0.1}
        shadow-camera-far={size * 4}
      />
      <pointLight position={[0, (room.height - 150) * MM, 0]} intensity={0.6} distance={size * 2} decay={1} />
      <group position={[-center.x * MM, 0, -center.z * MM]}>
        <mesh geometry={floor} rotation={[-Math.PI / 2, 0, 0]} position={[(room.width / 2) * MM, 0, (room.depth / 2) * MM]} raycast={() => null} receiveShadow>
          <meshStandardMaterial color={room.floorColor ?? DEFAULT_FLOOR_COLOR} roughness={0.85} />
        </mesh>
        {/* Teto: só aparece olhando de baixo (vistas de dentro); de cima fica invisível. */}
        <mesh geometry={floor} rotation={[Math.PI / 2, 0, 0]} position={[(room.width / 2) * MM, room.height * MM, (room.depth / 2) * MM]} raycast={() => null}>
          <meshBasicMaterial color="#e8e4de" />
        </mesh>
        <Walls room={room} center={center} />
        {placements.map((p) => {
          const model = models.get(p.itemId);
          if (!model) return null;
          return (
            <Furniture
              key={p.key}
              placement={p}
              model={model}
              tones={tones}
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
      <OrbitControls makeDefault enabled={dragPlane === null && !overGrab} target={orbitTarget} minDistance={0.05} maxDistance={size * 5} enableDamping />
      {viewpoint && <CameraRig viewpoint={viewpoint} center={center} />}
      {captureRef && <Capturer captureRef={captureRef} />}
    </Canvas>
  );
}
