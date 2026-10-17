import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Maximize2 } from 'lucide-react';
import type { EpistemicStatus, RoomGraph, RoomObjectNode } from '../../shared/roomGraphSchema';
import { nodeLabel, useI18n } from '../i18n';
import { kindOf, type Kind } from '../sceneKinds';

// A solid, shaded 3D view of the RoomGraph. The graph stays the single source of truth: this
// component only draws it and reports drags back through onUpdateNodePosition.
//
// Axes: graph x (east) -> three X, graph y (south) -> three Z, height -> three Y. One unit = 1 m.

interface Scene3DProps {
  graph: RoomGraph;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onUpdateNodePosition: (id: string, xCm: number, yCm: number) => void;
  showUncertaintyHalo: boolean;
  showRelationEdges: boolean;
}

const CM = 0.01;
const WALL_T = 0.12;

const STATUS_HEX: Record<EpistemicStatus, number> = {
  observed: 0x5bb8c9,
  inferred: 0xfbbf24,
  occluded_prior: 0xde8b4d,
};
// Observed objects are solid; inferred ones are see-through; occluded ones are ghosts.
const STATUS_OPACITY: Record<EpistemicStatus, number> = {
  observed: 1,
  inferred: 0.62,
  occluded_prior: 0.3,
};

const CLAY = {
  wood: '#B98B5E',
  darkWood: '#7A5A3C',
  fabric: '#5B7BA8',
  fabricLight: '#8FA3BD',
  white: '#E3E9F0',
  metal: '#3B4857',
  green: '#4C8C5E',
  pot: '#B5683F',
  shade: '#EBD9A8',
  neutral: '#9AA8B8',
  pillow: '#CBD6E2',
} as const;

function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    // CSS2D labels are DOM nodes: three only removes one when that exact object is removed from
    // its parent, not when an ancestor is, so take them out explicitly.
    if (o instanceof CSS2DObject) o.element.remove();
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
}

const noPick = (o: THREE.Object3D) => {
  o.raycast = () => {};
  return o;
};

interface NodeView {
  group: THREE.Group;
  signature: string;
  shell: THREE.Object3D;
  ring: THREE.Mesh;
  outline: THREE.LineSegments;
  label: HTMLDivElement;
  materials: THREE.MeshStandardMaterial[];
  setSelected: (selected: boolean) => void;
}

interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  controls: OrbitControls;
  nodes: Map<string, NodeView>;
  room: THREE.Group | null;
  roomSignature: string;
  edges: THREE.Group;
  pickables: THREE.Object3D[];
  frame: (w: number, d: number, h: number) => void;
  size: { w: number; d: number; h: number };
}

function buildModel(
  kind: Kind,
  w: number,
  h: number,
  d: number,
  status: EpistemicStatus,
  materials: THREE.MeshStandardMaterial[]
): THREE.Group {
  const g = new THREE.Group();
  const opacity = STATUS_OPACITY[status];
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: string, emissive = 0x000000) => {
    const key = `${color}-${emissive}`;
    let m = cache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82,
        metalness: 0.04,
        transparent: opacity < 1,
        opacity,
        depthWrite: status !== 'occluded_prior',
        emissive,
      });
      cache.set(key, m);
      materials.push(m);
    }
    return m;
  };
  const clampRadius = (r: number, sx: number, sy: number, sz: number) =>
    Math.max(0.002, Math.min(r, Math.min(sx, sy, sz) / 2.2));

  const box = (
    sx: number,
    sy: number,
    sz: number,
    x: number,
    y: number,
    z: number,
    color: string,
    radius = 0.02
  ) => {
    const geo = new RoundedBoxGeometry(sx, sy, sz, 3, clampRadius(radius, sx, sy, sz));
    const mesh = new THREE.Mesh(geo, mat(color));
    mesh.position.set(x, y + sy / 2, z);
    mesh.castShadow = status !== 'occluded_prior';
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  const cyl = (
    rTop: number,
    rBottom: number,
    height: number,
    x: number,
    y: number,
    z: number,
    color: string,
    emissive = 0x000000
  ) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, height, 28), mat(color, emissive));
    mesh.position.set(x, y + height / 2, z);
    mesh.castShadow = status !== 'occluded_prior';
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };

  switch (kind) {
    case 'bed': {
      const base = Math.min(0.34, h * 0.45);
      box(w, base, d, 0, 0, 0, CLAY.darkWood, 0.03);
      box(w * 0.96, 0.2, d * 0.9, 0, base, d * 0.04, CLAY.white, 0.05);
      box(w, Math.min(h, 1.05) * 0.95, 0.07, 0, 0, -d / 2 + 0.035, CLAY.darkWood, 0.03);
      box(w * 0.36, 0.1, 0.3, -w * 0.22, base + 0.2, -d / 2 + 0.3, CLAY.pillow, 0.04);
      box(w * 0.36, 0.1, 0.3, w * 0.22, base + 0.2, -d / 2 + 0.3, CLAY.pillow, 0.04);
      break;
    }
    case 'sofa': {
      const seat = h * 0.42;
      box(w, seat, d, 0, 0, 0, CLAY.fabric, 0.05);
      box(w * 0.9, 0.14, d * 0.6, 0, seat, d * 0.12, CLAY.fabricLight, 0.05);
      box(w, h * 0.58, 0.22, 0, 0, -d / 2 + 0.11, CLAY.fabric, 0.06);
      box(0.16, h * 0.6, d, -(w / 2 - 0.08), 0, 0, CLAY.fabric, 0.05);
      box(0.16, h * 0.6, d, w / 2 - 0.08, 0, 0, CLAY.fabric, 0.05);
      break;
    }
    case 'chair': {
      const seatY = h * 0.45;
      cyl(0.04, 0.04, seatY - 0.04, 0, 0.04, 0, CLAY.metal);
      cyl(w * 0.42, w * 0.42, 0.04, 0, 0, 0, CLAY.metal);
      box(w * 0.92, 0.07, d * 0.92, 0, seatY, 0, CLAY.fabric, 0.03);
      box(w * 0.9, h * 0.5, 0.07, 0, seatY + 0.05, -d / 2 + 0.04, CLAY.fabric, 0.03);
      break;
    }
    case 'desk': {
      const top = 0.04;
      box(w, top, d, 0, h - top, 0, CLAY.wood, 0.015);
      const lx = w / 2 - 0.06;
      const lz = d / 2 - 0.06;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          box(0.05, h - top, 0.05, sx * lx, 0, sz * lz, CLAY.metal, 0.01);
        }
      }
      break;
    }
    case 'wardrobe':
    case 'cabinet': {
      box(w, h, d, 0, 0, 0, kind === 'wardrobe' ? CLAY.wood : CLAY.darkWood, 0.025);
      box(0.012, h * 0.92, 0.012, 0, h * 0.04, d / 2 + 0.002, CLAY.metal, 0.004);
      if (kind === 'wardrobe') {
        box(0.012, h * 0.92, 0.012, -w / 4, h * 0.04, d / 2 + 0.002, CLAY.metal, 0.004);
        box(0.012, h * 0.92, 0.012, w / 4, h * 0.04, d / 2 + 0.002, CLAY.metal, 0.004);
      }
      box(0.025, 0.14, 0.02, -0.05, h * 0.5, d / 2 + 0.012, CLAY.metal, 0.006);
      box(0.025, 0.14, 0.02, 0.05, h * 0.5, d / 2 + 0.012, CLAY.metal, 0.006);
      break;
    }
    case 'shelf': {
      box(0.03, h, d, -(w / 2 - 0.015), 0, 0, CLAY.darkWood, 0.008);
      box(0.03, h, d, w / 2 - 0.015, 0, 0, CLAY.darkWood, 0.008);
      box(w, h, 0.02, 0, 0, -d / 2 + 0.01, CLAY.wood, 0.005);
      const boards = 5;
      for (let i = 0; i <= boards; i++) {
        box(w, 0.025, d * 0.96, 0, (i * (h - 0.025)) / boards, 0, CLAY.wood, 0.006);
      }
      break;
    }
    case 'appliance': {
      box(w, h, d, 0, 0, 0, CLAY.white, 0.03);
      box(w * 0.98, 0.008, 0.01, 0, h * 0.62, d / 2 + 0.003, CLAY.metal, 0.003);
      box(0.02, h * 0.28, 0.03, w / 2 - 0.07, h * 0.7, d / 2 + 0.015, CLAY.metal, 0.008);
      break;
    }
    case 'lamp': {
      const r = Math.min(w, d) * 0.45;
      cyl(r, r, 0.03, 0, 0, 0, CLAY.metal);
      cyl(0.012, 0.012, h * 0.82, 0, 0.03, 0, CLAY.metal);
      cyl(0.07, Math.max(r, 0.12), 0.24, 0, h - 0.24, 0, CLAY.shade, 0x2a2210);
      break;
    }
    case 'monitor': {
      box(w * 0.4, 0.02, d * 0.5, 0, 0, 0, CLAY.metal, 0.008);
      box(0.03, h * 0.35, 0.03, 0, 0.02, 0, CLAY.metal, 0.008);
      box(w, h * 0.6, 0.03, 0, h * 0.38, 0, '#1B2432', 0.01);
      break;
    }
    case 'plant': {
      const r = Math.min(w, d) * 0.45;
      cyl(r * 0.9, r * 0.7, h * 0.3, 0, 0, 0, CLAY.pot);
      const foliage = new THREE.Mesh(new THREE.SphereGeometry(r * 1.15, 20, 16), mat(CLAY.green));
      foliage.position.set(0, h * 0.3 + r * 0.9, 0);
      foliage.castShadow = status !== 'occluded_prior';
      g.add(foliage);
      break;
    }
    default: {
      box(w, h, d, 0, 0, 0, CLAY.neutral, 0.03);
    }
  }
  return g;
}

function dashedBox(
  w: number,
  h: number,
  d: number,
  color: number,
  dash: { dash: number; gap: number } | null,
  opacity: number
): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
  const material = dash
    ? new THREE.LineDashedMaterial({
        color,
        dashSize: dash.dash,
        gapSize: dash.gap,
        transparent: true,
        opacity,
      })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const lines = new THREE.LineSegments(edges, material);
  if (dash) lines.computeLineDistances();
  lines.position.y = h / 2;
  return noPick(lines) as THREE.LineSegments;
}

function buildRoom(env: RoomGraph['roomEnvelope']): THREE.Group {
  const room = new THREE.Group();
  const W = env.widthCm * CM;
  const D = env.depthCm * CM;
  const H = env.ceilingHeightCm * CM;

  const floorMat = new THREE.MeshStandardMaterial({ color: '#2C3E54', roughness: 0.95, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, D), floorMat);
  floor.position.set(W / 2, -0.05, D / 2);
  floor.receiveShadow = true;
  room.add(floor);

  // 50 cm grid on the floor
  const pts: number[] = [];
  for (let x = 0.5; x < W; x += 0.5) pts.push(x, 0.002, 0, x, 0.002, D);
  for (let z = 0.5; z < D; z += 0.5) pts.push(0, 0.002, z, W, 0.002, z);
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  room.add(
    noPick(
      new THREE.LineSegments(
        gridGeo,
        new THREE.LineBasicMaterial({ color: 0x8ea0b5, transparent: true, opacity: 0.12 })
      )
    )
  );

  // Far walls (north and west) are full height with the real openings cut out.
  const wallMat = new THREE.MeshStandardMaterial({ color: '#8E9EB3', roughness: 0.95, metalness: 0 });
  const makeWall = (side: 'north' | 'west') => {
    const length = side === 'north' ? W + WALL_T : D;
    const u0 = side === 'north' ? -WALL_T : 0;
    const shape = new THREE.Shape();
    shape.moveTo(u0, 0);
    shape.lineTo(u0 + length, 0);
    shape.lineTo(u0 + length, H);
    shape.lineTo(u0, H);
    shape.closePath();
    const openings = env.openings.filter((o) => o.wall === side);
    for (const o of openings) {
      const a = Math.max(u0 + 0.05, o.offsetCm * CM);
      const b = Math.min(u0 + length - 0.05, (o.offsetCm + o.widthCm) * CM);
      if (b - a < 0.1) continue;
      const v0 = o.kind === 'window' ? 0.9 : 0;
      const v1 = Math.min(H - 0.08, v0 + o.heightCm * CM);
      const hole = new THREE.Path();
      hole.moveTo(a, v0);
      hole.lineTo(b, v0);
      hole.lineTo(b, v1);
      hole.lineTo(a, v1);
      hole.closePath();
      shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: WALL_T, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (side === 'north') mesh.position.set(0, 0, -WALL_T);
    else mesh.rotation.y = -Math.PI / 2;
    room.add(mesh);

    // glass for windows
    for (const o of openings.filter((x) => x.kind === 'window')) {
      const a = Math.max(u0 + 0.05, o.offsetCm * CM);
      const b = Math.min(u0 + length - 0.05, (o.offsetCm + o.widthCm) * CM);
      if (b - a < 0.1) continue;
      const v0 = 0.9;
      const v1 = Math.min(H - 0.08, v0 + o.heightCm * CM);
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(b - a, v1 - v0),
        new THREE.MeshStandardMaterial({
          color: '#7FD3E8',
          transparent: true,
          opacity: 0.22,
          roughness: 0.1,
          side: THREE.DoubleSide,
        })
      );
      glass.position.set((a + b) / 2, (v0 + v1) / 2, -WALL_T / 2);
      if (side === 'west') {
        glass.rotation.y = -Math.PI / 2;
        glass.position.set(-WALL_T / 2, (v0 + v1) / 2, (a + b) / 2);
      } else {
        glass.position.set((a + b) / 2, (v0 + v1) / 2, -WALL_T / 2);
      }
      noPick(glass);
      room.add(glass);
    }
  };
  makeWall('north');
  makeWall('west');

  // Near walls (south and east) are low cutaway stubs so the view stays open; doors leave a gap.
  const stubMat = new THREE.MeshStandardMaterial({ color: '#6A7D95', roughness: 0.95 });
  const addStubs = (side: 'south' | 'east') => {
    const length = side === 'south' ? W : D;
    const gaps = env.openings
      .filter((o) => o.wall === side && o.kind !== 'window')
      .map((o) => [o.offsetCm * CM, (o.offsetCm + o.widthCm) * CM] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    let cursor = 0;
    const segments: [number, number][] = [];
    for (const [a, b] of gaps) {
      if (a > cursor) segments.push([cursor, a]);
      cursor = Math.max(cursor, b);
    }
    if (cursor < length) segments.push([cursor, length]);
    for (const [a, b] of segments) {
      const len = b - a;
      if (len < 0.02) continue;
      const stub = new THREE.Mesh(
        side === 'south' ? new THREE.BoxGeometry(len, 0.14, WALL_T) : new THREE.BoxGeometry(WALL_T, 0.14, len),
        stubMat
      );
      stub.castShadow = true;
      stub.receiveShadow = true;
      if (side === 'south') stub.position.set(a + len / 2, 0.07, D + WALL_T / 2);
      else stub.position.set(W + WALL_T / 2, 0.07, a + len / 2);
      room.add(stub);
    }
  };
  addStubs('south');
  addStubs('east');

  // Door swing arcs on the floor
  for (const o of env.openings.filter((x) => x.kind === 'entry_door' || x.kind === 'balcony_door')) {
    const r = (o.swingClearanceCm || o.widthCm) * CM;
    const a = o.offsetCm * CM;
    const w = o.widthCm * CM;
    let hinge: [number, number];
    let from: [number, number];
    let to: [number, number];
    if (o.wall === 'south') {
      hinge = [a, D];
      from = [a + w, D];
      to = [a, D - r];
    } else if (o.wall === 'north') {
      hinge = [a, 0];
      from = [a + w, 0];
      to = [a, r];
    } else if (o.wall === 'west') {
      hinge = [0, a];
      from = [0, a + w];
      to = [r, a];
    } else {
      hinge = [W, a];
      from = [W, a + w];
      to = [W - r, a];
    }
    const a0 = Math.atan2(from[1] - hinge[1], from[0] - hinge[0]);
    const a1 = Math.atan2(to[1] - hinge[1], to[0] - hinge[0]);
    let da = a1 - a0;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const arc: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = a0 + (da * i) / 24;
      arc.push(hinge[0] + Math.cos(t) * w, 0.01, hinge[1] + Math.sin(t) * w);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(arc, 3));
    room.add(
      noPick(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8 })))
    );
  }

  return room;
}

export const Scene3D: React.FC<Scene3DProps> = ({
  graph,
  selectedNodeId,
  onSelectNode,
  onUpdateNodePosition,
  showUncertaintyHalo,
  showRelationEdges,
}) => {
  const { t, lang } = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<SceneContext | null>(null);

  // Latest props for the long-lived event handlers.
  const live = useRef({ graph, onSelectNode, onUpdateNodePosition });
  live.current = { graph, onSelectNode, onUpdateNodePosition };

  // --- one-time setup: renderer, camera, lights, controls, input -------------------------------
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.inset = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    host.appendChild(labelRenderer.domElement);

    scene.add(new THREE.HemisphereLight(0xdbe8ff, 0x24303f, 1.25));
    // soft fill from the opposite side so shaded faces keep their shape
    const fill = new THREE.DirectionalLight(0x9fc4ff, 0.45);
    fill.position.set(-5, 4, -4);
    scene.add(fill);
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 5;
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 1.5;
    controls.maxDistance = 30;

    const edges = new THREE.Group();
    scene.add(edges);

    const ctx: SceneContext = {
      scene,
      camera,
      renderer,
      labelRenderer,
      controls,
      nodes: new Map(),
      room: null,
      roomSignature: '',
      edges,
      pickables: [],
      size: { w: 0, d: 0, h: 0 },
      frame: (w: number, d: number, h: number) => {
        const W = w * CM;
        const D = d * CM;
        const H = Math.min(h * CM, 3);
        const target = new THREE.Vector3(W / 2, H * 0.3, D / 2);
        // Fit the room's bounding sphere in whichever field of view is narrower.
        const radius = 0.5 * Math.sqrt(W * W + D * D + H * H);
        const vFov = (camera.fov * Math.PI) / 180;
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
        const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.02;
        const az = (40 * Math.PI) / 180;
        const el = (34 * Math.PI) / 180;
        camera.position.set(
          target.x + Math.sin(az) * Math.cos(el) * dist,
          target.y + Math.sin(el) * dist,
          target.z + Math.cos(az) * Math.cos(el) * dist
        );
        controls.target.copy(target);
        controls.update();
        // Light and its shadow volume follow the room.
        sun.position.set(W / 2 + 4.5, 8, D / 2 + 3.5);
        sun.target.position.set(W / 2, 0, D / 2);
        const half = Math.max(W, D) * 0.9 + 1;
        sun.shadow.camera.left = -half;
        sun.shadow.camera.right = half;
        sun.shadow.camera.top = half;
        sun.shadow.camera.bottom = -half;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 24;
        sun.shadow.camera.updateProjectionMatrix();
      },
    };
    ctxRef.current = ctx;

    // --- picking and dragging --------------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    const dom = renderer.domElement;

    const setRay = (e: PointerEvent) => {
      const r = dom.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
    };
    const pickNodeId = (e: PointerEvent): string | null => {
      setRay(e);
      const hits = raycaster.intersectObjects(ctx.pickables, true);
      for (const hit of hits) {
        let o: THREE.Object3D | null = hit.object;
        while (o && !o.userData.nodeId) o = o.parent;
        if (o) return o.userData.nodeId as string;
      }
      return null;
    };
    const floorCm = (e: PointerEvent): { x: number; y: number } | null => {
      setRay(e);
      return raycaster.ray.intersectPlane(floorPlane, hitPoint)
        ? { x: hitPoint.x / CM, y: hitPoint.z / CM }
        : null;
    };

    let drag: { id: string; dx: number; dy: number; pointerId: number } | null = null;

    // Registered before OrbitControls so a drag on an object can switch the orbit off first.
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const id = pickNodeId(e);
      if (!id) return;
      live.current.onSelectNode(id);
      const node = live.current.graph.nodes.find((n) => n.id === id);
      const p = floorCm(e);
      if (!node || !node.movable || !p) return;
      drag = { id, dx: p.x - node.footprint.xCm, dy: p.y - node.footprint.yCm, pointerId: e.pointerId };
      controls.enabled = false;
      dom.setPointerCapture?.(e.pointerId);
      dom.style.cursor = 'grabbing';
    };
    const onPointerMove = (e: PointerEvent) => {
      if (drag) {
        const p = floorCm(e);
        if (!p) return;
        const env = live.current.graph.roomEnvelope;
        const x = Math.round(Math.max(-20, Math.min(env.widthCm - 20, p.x - drag.dx)));
        const y = Math.round(Math.max(-20, Math.min(env.depthCm - 20, p.y - drag.dy)));
        live.current.onUpdateNodePosition(drag.id, x, y);
        return;
      }
      const id = pickNodeId(e);
      const node = id ? live.current.graph.nodes.find((n) => n.id === id) : null;
      dom.style.cursor = node ? (node.movable ? 'grab' : 'pointer') : 'default';
    };
    const endDrag = (e: PointerEvent) => {
      if (!drag) return;
      dom.releasePointerCapture?.(drag.pointerId);
      drag = null;
      controls.enabled = true;
      dom.style.cursor = 'default';
      void e;
    };
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', endDrag);
    dom.addEventListener('pointercancel', endDrag);

    // --- sizing and render loop ------------------------------------------------------------
    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      labelRenderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    renderer.setAnimationLoop(() => {
      if (document.hidden) return;
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', endDrag);
      dom.removeEventListener('pointercancel', endDrag);
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
      ctxRef.current = null;
    };
  }, []);

  // --- room shell (only when the envelope changes) ---------------------------------------------
  const env = graph.roomEnvelope;
  const roomSignature = JSON.stringify([env.widthCm, env.depthCm, env.ceilingHeightCm, env.openings]);
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.roomSignature === roomSignature) return;
    if (ctx.room) {
      ctx.scene.remove(ctx.room);
      disposeObject(ctx.room);
    }
    ctx.room = buildRoom(env);
    ctx.scene.add(ctx.room);
    const sizeChanged =
      ctx.size.w !== env.widthCm || ctx.size.d !== env.depthCm || ctx.size.h !== env.ceilingHeightCm;
    ctx.roomSignature = roomSignature;
    if (sizeChanged) {
      ctx.size = { w: env.widthCm, d: env.depthCm, h: env.ceilingHeightCm };
      ctx.frame(env.widthCm, env.depthCm, env.ceilingHeightCm);
    }
  }, [roomSignature, env]);

  // --- objects: rebuild on a change of shape, otherwise just move -----------------------------
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const seen = new Set<string>();

    for (const node of graph.nodes) {
      seen.add(node.id);
      const f = node.footprint;
      const rotated = Math.abs(f.rotationDeg % 180) === 90;
      const effW = (rotated ? f.depthCm : f.widthCm) * CM;
      const effD = (rotated ? f.widthCm : f.depthCm) * CM;
      const label = nodeLabel(node, lang);
      const signature = JSON.stringify([
        node.label,
        node.labelKo,
        node.category,
        node.epistemic,
        f.widthCm,
        f.depthCm,
        f.heightCm,
        f.rotationDeg,
        node.uncertainty.posPlusMinusCm,
        node.uncertainty.dimPlusMinusCm,
        label,
      ]);

      let view = ctx.nodes.get(node.id);
      if (view && view.signature !== signature) {
        ctx.scene.remove(view.group);
        disposeObject(view.group);
        ctx.nodes.delete(node.id);
        view = undefined;
      }

      if (!view) {
        const w = f.widthCm * CM;
        const d = f.depthCm * CM;
        const h = f.heightCm * CM;
        const materials: THREE.MeshStandardMaterial[] = [];
        const group = new THREE.Group();
        group.userData.nodeId = node.id;
        group.add(buildModel(kindOf(node), w, h, d, node.epistemic, materials));

        // bounding box in the status colour: solid, dashed or dotted
        const dash =
          node.epistemic === 'observed'
            ? null
            : node.epistemic === 'inferred'
              ? { dash: 0.07, gap: 0.05 }
              : { dash: 0.02, gap: 0.05 };
        group.add(dashedBox(w, h, d, STATUS_HEX[node.epistemic], dash, node.epistemic === 'observed' ? 0.5 : 0.85));

        // +/- cm uncertainty shell
        const expand = (node.uncertainty.posPlusMinusCm + node.uncertainty.dimPlusMinusCm / 2) * CM;
        const dimExtra = node.uncertainty.dimPlusMinusCm * CM;
        const shell = new THREE.Group();
        const shellFill = new THREE.Mesh(
          new THREE.BoxGeometry(w + expand * 2, h + dimExtra, d + expand * 2),
          new THREE.MeshBasicMaterial({
            color: STATUS_HEX[node.epistemic],
            transparent: true,
            opacity: 0.08,
            depthWrite: false,
          })
        );
        shellFill.position.y = (h + dimExtra) / 2;
        noPick(shellFill);
        shell.add(shellFill);
        shell.add(
          dashedBox(w + expand * 2, h + dimExtra, d + expand * 2, STATUS_HEX[node.epistemic], { dash: 0.05, gap: 0.04 }, 0.55)
        );
        group.add(shell);

        // selection treatment: ground ring plus a cyan outline
        const radius = Math.max(w, d) * 0.5 * 1.18 + 0.06;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(radius, radius + 0.035, 56),
          new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.012;
        ring.visible = false;
        noPick(ring);
        group.add(ring);
        const outline = dashedBox(w * 1.02, h * 1.02, d * 1.02, 0x22d3ee, null, 1);
        outline.visible = false;
        group.add(outline);

        // floating tag; textContent only, because labels come from model output
        const el = document.createElement('div');
        el.className = 'rc-label';
        el.dataset.status = node.epistemic;
        const name = document.createElement('span');
        name.textContent = label;
        const idEl = document.createElement('small');
        idEl.textContent = node.id.length > 18 ? `${node.id.slice(0, 17)}…` : node.id;
        el.append(name, idEl);
        const tag = new CSS2DObject(el);
        tag.position.set(0, h + 0.12, 0);
        group.add(tag);

        group.rotation.y = (f.rotationDeg * Math.PI) / 180;

        view = {
          group,
          signature,
          shell,
          ring,
          outline,
          label: el,
          materials,
          setSelected: (selected: boolean) => {
            ring.visible = selected;
            outline.visible = selected;
            el.dataset.selected = selected ? 'true' : 'false';
            for (const m of materials) m.emissive.setHex(selected ? 0x0a3640 : 0x000000);
          },
        };
        ctx.nodes.set(node.id, view);
        ctx.scene.add(group);
      }

      view.group.position.set(f.xCm * CM + effW / 2, 0, f.yCm * CM + effD / 2);
    }

    for (const [id, view] of [...ctx.nodes]) {
      if (!seen.has(id)) {
        ctx.scene.remove(view.group);
        disposeObject(view.group);
        ctx.nodes.delete(id);
      }
    }
    ctx.pickables = [...ctx.nodes.values()].map((v) => v.group);
    for (const [id, view] of ctx.nodes) view.setSelected(id === selectedNodeId);
    // Shell visibility and selection are applied by their own effects below, which also re-run
    // whenever graph.nodes changes, so freshly built objects pick them up.
  }, [graph.nodes, lang]);

  // --- selection and shell visibility ----------------------------------------------------------
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    for (const [id, view] of ctx.nodes) view.setSelected(id === selectedNodeId);
  }, [selectedNodeId, graph.nodes]);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    for (const view of ctx.nodes.values()) view.shell.visible = showUncertaintyHalo;
  }, [showUncertaintyHalo, graph.nodes]);

  // --- relation edges ---------------------------------------------------------------------------
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    for (const child of [...ctx.edges.children]) {
      ctx.edges.remove(child);
      disposeObject(child);
    }
    if (!showRelationEdges) return;

    const centre = (id: string) => {
      const n = graph.nodes.find((x) => x.id === id);
      if (!n) return null;
      const f = n.footprint;
      const rotated = Math.abs(f.rotationDeg % 180) === 90;
      const effW = rotated ? f.depthCm : f.widthCm;
      const effD = rotated ? f.widthCm : f.depthCm;
      return new THREE.Vector3((f.xCm + effW / 2) * CM, f.heightCm * CM * 0.55, (f.yCm + effD / 2) * CM);
    };
    const showLabels = graph.edges.length <= 10;
    for (const edge of graph.edges) {
      const a = centre(edge.from);
      const b = centre(edge.to);
      if (!a || !b) continue;
      const mid = a.clone().add(b).multiplyScalar(0.5);
      mid.y += 0.35 + a.distanceTo(b) * 0.12;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
      const line = new THREE.Line(
        geo,
        new THREE.LineDashedMaterial({ color: 0x8197bd, dashSize: 0.08, gapSize: 0.05, transparent: true, opacity: 0.85 })
      );
      line.computeLineDistances();
      noPick(line);
      ctx.edges.add(line);

      if (showLabels) {
        const el = document.createElement('div');
        el.className = 'rc-edge-label';
        el.textContent = `${edge.relation} ${edge.distanceCm}±${edge.uncertaintyCm}cm`;
        const tag = new CSS2DObject(el);
        tag.position.copy(curve.getPoint(0.5));
        ctx.edges.add(tag);
      }
    }
  }, [graph.edges, graph.nodes, showRelationEdges]);

  const resetView = () => ctxRef.current?.frame(env.widthCm, env.depthCm, env.ceilingHeightCm);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-md sm:h-[520px] lg:h-[580px]">
      <div
        ref={hostRef}
        className="absolute inset-0"
        role="img"
        aria-label={t('canvas.3d.aria')}
      />
      <button
        type="button"
        onClick={resetView}
        className="btn-secondary absolute right-3 top-3 px-2"
        title={t('canvas.resetView')}
        aria-label={t('canvas.resetView')}
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
