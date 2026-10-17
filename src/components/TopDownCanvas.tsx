import React, { useRef, useState } from 'react';
import type { RoomGraph, RoomObjectNode } from '../../shared/roomGraphSchema';
import { getNodeRect } from '../../shared/spatialEngine';
import {
  RotateCw,
  Plus,
  ShieldAlert,
  Eye,
  HelpCircle,
  DoorOpen,
  Box,
  Layers,
  Info,
} from 'lucide-react';

interface TopDownCanvasProps {
  graph: RoomGraph;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onUpdateNodePosition: (id: string, xCm: number, yCm: number) => void;
  onRotateNode: (id: string) => void;
  onAddFurniture: (presetKind: 'king_bed' | 'sofa_3p' | 'bookshelf' | 'washer') => void;
  showUncertaintyHalo: boolean;
  onToggleUncertaintyHalo: () => void;
  showRelationEdges: boolean;
  onToggleRelationEdges: () => void;
}

interface Point2D {
  x: number;
  y: number;
}

export const TopDownCanvas: React.FC<TopDownCanvasProps> = ({
  graph,
  selectedNodeId,
  onSelectNode,
  onUpdateNodePosition,
  onRotateNode,
  onAddFurniture,
  showUncertaintyHalo,
  onToggleUncertaintyHalo,
  showRelationEdges,
  onToggleRelationEdges,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [yawDeg, setYawDeg] = useState<number>(38);
  const [pitchDeg, setPitchDeg] = useState<number>(28);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [orbitDragging, setOrbitDragging] = useState<boolean>(false);
  const [orbitStart, setOrbitStart] = useState<{ x: number; y: number; yaw: number; pitch: number }>({
    x: 0,
    y: 0,
    yaw: 38,
    pitch: 28,
  });

  const pad = 42;
  const envW = graph.roomEnvelope.widthCm;
  const envD = graph.roomEnvelope.depthCm;
  const envH = graph.roomEnvelope.ceilingHeightCm;
  const viewW = envW + pad * 2;
  const viewD = envD + pad * 2;

  const clientToRoomCm = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = viewW / rect.width;
    const scaleY = viewD / rect.height;
    const rawX = (clientX - rect.left) * scaleX - pad;
    const rawY = (clientY - rect.top) * scaleY - pad;
    return { x: Math.round(rawX), y: Math.round(rawY) };
  };

  const handlePointerDown = (e: React.PointerEvent, node: RoomObjectNode) => {
    e.stopPropagation();
    onSelectNode(node.id);
    if (viewMode !== '2d' || !node.movable) return;
    const pt = clientToRoomCm(e.clientX, e.clientY);
    setDraggingId(node.id);
    setDragOffset({
      dx: pt.x - node.footprint.xCm,
      dy: pt.y - node.footprint.yCm,
    });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (viewMode === '2d' && draggingId) {
      const pt = clientToRoomCm(e.clientX, e.clientY);
      const nextX = Math.max(-20, Math.min(envW - 20, pt.x - dragOffset.dx));
      const nextY = Math.max(-20, Math.min(envD - 20, pt.y - dragOffset.dy));
      onUpdateNodePosition(draggingId, nextX, nextY);
    } else if (viewMode === '3d' && orbitDragging) {
      const dx = e.clientX - orbitStart.x;
      const dy = e.clientY - orbitStart.y;
      setYawDeg(((orbitStart.yaw + dx * 0.45) % 360 + 360) % 360);
      setPitchDeg(Math.max(12, Math.min(68, orbitStart.pitch + dy * 0.35)));
    }
  };

  const handlePointerUp = () => {
    setDraggingId(null);
    setOrbitDragging(false);
  };

  const epistemicStyle = (status: RoomObjectNode['epistemic']) => {
    if (status === 'observed') {
      return {
        stroke: '#10b981',
        fill: 'rgba(16, 185, 129, 0.22)',
        topFill: 'rgba(16, 185, 129, 0.36)',
        sideFill: 'rgba(5, 150, 105, 0.24)',
        haloFill: 'rgba(16, 185, 129, 0.08)',
        haloStroke: '#34d399',
        dash: undefined,
        badge: 'OBSERVED',
      };
    }
    if (status === 'inferred') {
      return {
        stroke: '#f59e0b',
        fill: 'rgba(245, 158, 11, 0.22)',
        topFill: 'rgba(245, 158, 11, 0.04)',
        sideFill: 'rgba(217, 119, 6, 0.02)',
        haloFill: 'rgba(245, 158, 11, 0.12)',
        haloStroke: '#fbbf24',
        dash: '6,4',
        badge: 'INFERRED',
      };
    }
    return {
      stroke: '#f43f5e',
      fill: 'rgba(244, 63, 94, 0.22)',
      topFill: 'rgba(244, 63, 94, 0.04)',
      sideFill: 'rgba(225, 29, 72, 0.02)',
      haloFill: 'rgba(244, 63, 94, 0.15)',
      haloStroke: '#fb7185',
      dash: '4,4',
      badge: 'OCCLUDED PRIOR',
    };
  };

  // Isometric / Axonometric 3D Projection Helper (xCm, yCm, zCm -> SVG 2D)
  const isoW = 760;
  const isoH = 440;
  const project3D = (xCm: number, yCm: number, zCm: number): Point2D => {
    const cx = envW / 2;
    const cy = envD / 2;
    const dx = xCm - cx;
    const dy = yCm - cy;
    const radYaw = (yawDeg * Math.PI) / 180;
    const radPitch = (pitchDeg * Math.PI) / 180;

    const rx = dx * Math.cos(radYaw) - dy * Math.sin(radYaw);
    const ry = dx * Math.sin(radYaw) + dy * Math.cos(radYaw);

    const scale = 0.92;
    const sx = isoW / 2 + rx * scale;
    const sy = isoH * 0.62 + (ry * Math.sin(radPitch) - zCm * Math.cos(radPitch) * 0.82) * scale;
    return { x: Number(sx.toFixed(1)), y: Number(sy.toFixed(1)) };
  };

  const polyPoints = (pts: Point2D[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');

  const renderCuboid = (
    x1: number,
    y1: number,
    w: number,
    d: number,
    h: number,
    opts: {
      stroke: string;
      topFill: string;
      sideFill: string;
      dash?: string;
      strokeWidth?: number;
    }
  ) => {
    const x2 = x1 + w;
    const y2 = y1 + d;
    // Bottom 4 corners (z=0)
    const b0 = project3D(x1, y1, 0);
    const b1 = project3D(x2, y1, 0);
    const b2 = project3D(x2, y2, 0);
    const b3 = project3D(x1, y2, 0);
    // Top 4 corners (z=h)
    const t0 = project3D(x1, y1, h);
    const t1 = project3D(x2, y1, h);
    const t2 = project3D(x2, y2, h);
    const t3 = project3D(x1, y2, h);

    const sw = opts.strokeWidth ?? 1.6;

    return (
      <g>
        {/* Floor footprint */}
        <polygon
          points={polyPoints([b0, b1, b2, b3])}
          fill={opts.sideFill}
          stroke={opts.stroke}
          strokeWidth={sw * 0.8}
          strokeDasharray={opts.dash}
        />
        {/* Front-left & front-right vertical faces */}
        <polygon
          points={polyPoints([b3, b2, t2, t3])}
          fill={opts.sideFill}
          stroke={opts.stroke}
          strokeWidth={sw}
          strokeDasharray={opts.dash}
        />
        <polygon
          points={polyPoints([b1, b2, t2, t1])}
          fill={opts.sideFill}
          stroke={opts.stroke}
          strokeWidth={sw}
          strokeDasharray={opts.dash}
        />
        {/* Vertical pillar edges */}
        <line
          x1={b0.x}
          y1={b0.y}
          x2={t0.x}
          y2={t0.y}
          stroke={opts.stroke}
          strokeWidth={sw * 0.8}
          strokeDasharray={opts.dash}
        />
        <line
          x1={b1.x}
          y1={b1.y}
          x2={t1.x}
          y2={t1.y}
          stroke={opts.stroke}
          strokeWidth={sw}
          strokeDasharray={opts.dash}
        />
        <line
          x1={b2.x}
          y1={b2.y}
          x2={t2.x}
          y2={t2.y}
          stroke={opts.stroke}
          strokeWidth={sw}
          strokeDasharray={opts.dash}
        />
        <line
          x1={b3.x}
          y1={b3.y}
          x2={t3.x}
          y2={t3.y}
          stroke={opts.stroke}
          strokeWidth={sw}
          strokeDasharray={opts.dash}
        />
        {/* Top roof face */}
        <polygon
          points={polyPoints([t0, t1, t2, t3])}
          fill={opts.topFill}
          stroke={opts.stroke}
          strokeWidth={sw}
          strokeDasharray={opts.dash}
        />
      </g>
    );
  };

  // Sort nodes back-to-front in 3D based on rotated depth (painter's algorithm)
  const sorted3DNodes = [...graph.nodes].sort((a, b) => {
    const ra = getNodeRect(a, 0);
    const rb = getNodeRect(b, 0);
    const pa = project3D(ra.cx, ra.cy, 0);
    const pb = project3D(rb.cx, rb.cy, 0);
    return pa.y - pb.y;
  });

  return (
    <div className="flex flex-col bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          {/* 2D vs 3D Mode Switcher */}
          <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                viewMode === '3d'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              3D Epistemic Volumes
            </button>
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                viewMode === '2d'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              2D Metric Blueprint
            </button>
          </div>
          <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono whitespace-nowrap">
            {viewMode === '3d'
              ? `Drag to Orbit 3D (${Math.round(yawDeg)}° / ${Math.round(pitchDeg)}°)`
              : 'Drag to Move · 90° Rotate'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleUncertaintyHalo}
            className={`px-2.5 py-1 rounded border text-xs font-medium transition ${
              showUncertaintyHalo
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            ±cm Uncertainty Shell {showUncertaintyHalo ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={onToggleRelationEdges}
            className={`px-2.5 py-1 rounded border text-xs font-medium transition ${
              showRelationEdges
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            Relation Edges {showRelationEdges ? 'ON' : 'OFF'}
          </button>
          {selectedNodeId && (
            <button
              type="button"
              onClick={() => onRotateNode(selectedNodeId)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium transition"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Rotate 90°
            </button>
          )}
        </div>
      </div>

      {/* Why Epistemic 3D Volumes Beat Pretty Texture Meshes Callout */}
      {viewMode === '3d' && (
        <div className="px-3.5 py-2 bg-indigo-950/35 border-b border-indigo-500/30 text-[11px] text-indigo-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              <strong>Why 3D Epistemic Volumes instead of a photogrammetry mesh?</strong> Decorative 3D
              meshes hallucinate smooth surfaces over occluded corners. Here,{' '}
              <span className="text-emerald-300 font-semibold">Observed</span> objects render as solid
              metric volumes while <span className="text-amber-300 font-semibold">Inferred</span> &{' '}
              <span className="text-rose-300 font-semibold">Occluded</span> items expose their outer{' '}
              <code>±cm</code> wireframe uncertainty shells.
            </span>
          </div>
        </div>
      )}

      {/* What-If Add Furniture Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-950/70 border-b border-slate-800/80 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          <span>Inject What-If Furniture:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAddFurniture('king_bed')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            + King Bed (180×208cm)
          </button>
          <button
            type="button"
            onClick={() => onAddFurniture('sofa_3p')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            + 3-Seater Sofa (210×98cm)
          </button>
          <button
            type="button"
            onClick={() => onAddFurniture('washer')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            + WashTower (70×74cm)
          </button>
          <button
            type="button"
            onClick={() => onAddFurniture('bookshelf')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            + 5-Tier Shelf (80×32cm)
          </button>
        </div>
      </div>

      {/* Canvas Viewport: 3D Volumetric Wireframe OR 2D Metric Blueprint */}
      <div className="relative flex-1 flex items-center justify-center p-3 bg-slate-950 select-none">
        {viewMode === '3d' ? (
          <svg
            viewBox={`0 0 ${isoW} ${isoH}`}
            className="w-full max-h-[430px] touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
              setOrbitDragging(true);
              setOrbitStart({
                x: e.clientX,
                y: e.clientY,
                yaw: yawDeg,
                pitch: pitchDeg,
              });
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* 3D Room Floor & Ceiling Wireframe Envelope */}
            {(() => {
              const f0 = project3D(0, 0, 0);
              const f1 = project3D(envW, 0, 0);
              const f2 = project3D(envW, envD, 0);
              const f3 = project3D(0, envD, 0);
              const c0 = project3D(0, 0, envH);
              const c1 = project3D(envW, 0, envH);
              const c3 = project3D(0, envD, envH);

              const gridLines: React.ReactNode[] = [];
              for (let gx = 50; gx < envW; gx += 50) {
                const pA = project3D(gx, 0, 0);
                const pB = project3D(gx, envD, 0);
                gridLines.push(
                  <line
                    key={`gx-${gx}`}
                    x1={pA.x}
                    y1={pA.y}
                    x2={pB.x}
                    y2={pB.y}
                    stroke="rgba(148,163,184,0.12)"
                    strokeWidth="1"
                  />
                );
              }
              for (let gy = 50; gy < envD; gy += 50) {
                const pA = project3D(0, gy, 0);
                const pB = project3D(envW, gy, 0);
                gridLines.push(
                  <line
                    key={`gy-${gy}`}
                    x1={pA.x}
                    y1={pA.y}
                    x2={pB.x}
                    y2={pB.y}
                    stroke="rgba(148,163,184,0.12)"
                    strokeWidth="1"
                  />
                );
              }

              return (
                <g>
                  {/* Back North & West Walls */}
                  <polygon
                    points={polyPoints([f0, f1, c1, c0])}
                    fill="rgba(30, 41, 59, 0.45)"
                    stroke="#475569"
                    strokeWidth="1.5"
                  />
                  <polygon
                    points={polyPoints([f0, f3, c3, c0])}
                    fill="rgba(15, 23, 42, 0.55)"
                    stroke="#475569"
                    strokeWidth="1.5"
                  />
                  {/* Floor Plane */}
                  <polygon
                    points={polyPoints([f0, f1, f2, f3])}
                    fill="rgba(15, 23, 42, 0.9)"
                    stroke="#64748b"
                    strokeWidth="2.5"
                  />
                  {gridLines}
                  <text
                    x={c0.x}
                    y={c0.y - 10}
                    fill="#94a3b8"
                    fontSize="11"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    3D Room Envelope: {envW}×{envD}×{envH}cm (±{graph.roomEnvelope.uncertaintyCm}cm)
                  </text>
                </g>
              );
            })()}

            {/* 3D Spatial Relation Edges */}
            {showRelationEdges &&
              graph.edges.map((edge) => {
                const fromNode = graph.nodes.find((n) => n.id === edge.from);
                const toNode = graph.nodes.find((n) => n.id === edge.to);
                if (!fromNode || !toNode) return null;
                const rA = getNodeRect(fromNode, 0);
                const rB = getNodeRect(toNode, 0);
                const pA = project3D(rA.cx, rA.cy, fromNode.footprint.heightCm * 0.5);
                const pB = project3D(rB.cx, rB.cy, toNode.footprint.heightCm * 0.5);
                const mx = (pA.x + pB.x) / 2;
                const my = (pA.y + pB.y) / 2;
                return (
                  <g key={`3d-${edge.id}`}>
                    <line
                      x1={pA.x}
                      y1={pA.y}
                      x2={pB.x}
                      y2={pB.y}
                      stroke="#818cf8"
                      strokeWidth="1.8"
                      strokeDasharray="4,3"
                    />
                    <rect
                      x={mx - 42}
                      y={my - 9}
                      width={84}
                      height={17}
                      rx="4"
                      fill="#1e1b4b"
                      stroke="#6366f1"
                    />
                    <text
                      x={mx}
                      y={my + 3}
                      textAnchor="middle"
                      fill="#c7d2fe"
                      fontSize="8.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {edge.relation} ({edge.distanceCm}±{edge.uncertaintyCm}cm)
                    </text>
                  </g>
                );
              })}

            {/* 3D Furniture Cuboids & Outer ±cm Uncertainty Shells */}
            {sorted3DNodes.map((node) => {
              const rect = getNodeRect(node, 0);
              const uncBand =
                node.uncertainty.posPlusMinusCm + node.uncertainty.dimPlusMinusCm;
              const haloRect = getNodeRect(node, uncBand);
              const st = epistemicStyle(node.epistemic);
              const isSelected = selectedNodeId === node.id;
              const roofCenter = project3D(
                rect.cx,
                rect.cy,
                node.footprint.heightCm + 12
              );

              return (
                <g
                  key={`3d-node-${node.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectNode(node.id);
                  }}
                  className="cursor-pointer"
                >
                  {/* Outer 3D ±cm Epistemic Uncertainty Wireframe Shell */}
                  {showUncertaintyHalo &&
                    renderCuboid(
                      haloRect.x1,
                      haloRect.y1,
                      haloRect.w,
                      haloRect.d,
                      node.footprint.heightCm + node.uncertainty.dimPlusMinusCm,
                      {
                        stroke: st.haloStroke,
                        topFill: 'rgba(251, 191, 36, 0.04)',
                        sideFill: 'rgba(251, 191, 36, 0.03)',
                        dash: '3,3',
                        strokeWidth: 1.1,
                      }
                    )}

                  {/* Nominal 3D Volume */}
                  {renderCuboid(
                    rect.x1,
                    rect.y1,
                    rect.w,
                    rect.d,
                    node.footprint.heightCm,
                    {
                      stroke: isSelected ? '#38bdf8' : st.stroke,
                      topFill: st.topFill,
                      sideFill: st.sideFill,
                      dash: st.dash,
                      strokeWidth: isSelected ? 2.6 : 1.7,
                    }
                  )}

                  {/* Floating 3D HUD Tag */}
                  <rect
                    x={roofCenter.x - 58}
                    y={roofCenter.y - 18}
                    width={116}
                    height={26}
                    rx="4"
                    fill="rgba(15, 23, 42, 0.88)"
                    stroke={isSelected ? '#38bdf8' : st.stroke}
                    strokeWidth="1"
                  />
                  <text
                    x={roofCenter.x}
                    y={roofCenter.y - 6}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="9.5"
                    fontWeight="600"
                  >
                    {node.label}
                  </text>
                  <text
                    x={roofCenter.x}
                    y={roofCenter.y + 4}
                    textAnchor="middle"
                    fill={st.stroke}
                    fontSize="8"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {rect.w}×{rect.d}×{node.footprint.heightCm}cm (±{uncBand}cm)
                  </text>
                </g>
              );
            })}
          </svg>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${viewW} ${viewD}`}
            className="w-full max-h-[430px] touch-none cursor-crosshair"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={() => onSelectNode(null)}
          >
            <defs>
              <pattern id="grid50" width="50" height="50" patternUnits="userSpaceOnUse">
                <path
                  d="M 50 0 L 0 0 0 50"
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.12)"
                  strokeWidth="1"
                />
              </pattern>
              <pattern id="grid10" width="10" height="10" patternUnits="userSpaceOnUse">
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.04)"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>

            <g transform={`translate(${pad}, ${pad})`}>
              {showUncertaintyHalo && (
                <rect
                  x={-graph.roomEnvelope.uncertaintyCm}
                  y={-graph.roomEnvelope.uncertaintyCm}
                  width={envW + graph.roomEnvelope.uncertaintyCm * 2}
                  height={envD + graph.roomEnvelope.uncertaintyCm * 2}
                  fill="none"
                  stroke="rgba(251, 191, 36, 0.35)"
                  strokeWidth="1.5"
                  strokeDasharray="5,4"
                  rx="4"
                />
              )}

              <rect
                x={0}
                y={0}
                width={envW}
                height={envD}
                fill="#0f172a"
                stroke="#64748b"
                strokeWidth="4"
              />
              <rect x={0} y={0} width={envW} height={envD} fill="url(#grid10)" />
              <rect x={0} y={0} width={envW} height={envD} fill="url(#grid50)" />

              <text
                x={envW / 2}
                y={-12}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="11"
                fontFamily="JetBrains Mono, monospace"
              >
                North Wall: {envW}cm (±{graph.roomEnvelope.uncertaintyCm}cm)
              </text>
              <text
                x={-14}
                y={envD / 2}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="11"
                fontFamily="JetBrains Mono, monospace"
                transform={`rotate(-90, -14, ${envD / 2})`}
              >
                West Wall: {envD}cm
              </text>

              {graph.epistemicSummary.blindSpots.map((bs, idx) => (
                <g key={bs.id}>
                  <rect
                    x={12}
                    y={envD - 80 - idx * 45}
                    width={110}
                    height={34}
                    rx="4"
                    fill="rgba(244, 63, 94, 0.10)"
                    stroke="rgba(244, 63, 94, 0.45)"
                    strokeDasharray="3,3"
                  />
                  <text
                    x={18}
                    y={envD - 60 - idx * 45}
                    fill="#fda4af"
                    fontSize="8.5"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    Blind Spot #{idx + 1} ({bs.riskLevel})
                  </text>
                </g>
              ))}

              {graph.roomEnvelope.openings.map((op) => {
                const isDoor = op.kind === 'entry_door' || op.kind === 'balcony_door';
                const strokeColor = isDoor ? '#38bdf8' : '#7dd3fc';
                if (op.wall === 'south') {
                  return (
                    <g key={op.id}>
                      <line
                        x1={op.offsetCm}
                        y1={envD}
                        x2={op.offsetCm + op.widthCm}
                        y2={envD}
                        stroke={strokeColor}
                        strokeWidth="7"
                      />
                      {op.swingClearanceCm > 0 && (
                        <path
                          d={`M ${op.offsetCm} ${envD} L ${op.offsetCm} ${envD - op.swingClearanceCm} A ${op.widthCm} ${op.swingClearanceCm} 0 0 1 ${op.offsetCm + op.widthCm} ${envD}`}
                          fill="rgba(56, 189, 248, 0.12)"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                          strokeDasharray="4,3"
                        />
                      )}
                      <text
                        x={op.offsetCm + op.widthCm / 2}
                        y={envD + 18}
                        textAnchor="middle"
                        fill="#38bdf8"
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {op.label} ({op.widthCm}cm)
                      </text>
                    </g>
                  );
                }
                if (op.wall === 'north') {
                  return (
                    <g key={op.id}>
                      <line
                        x1={op.offsetCm}
                        y1={0}
                        x2={op.offsetCm + op.widthCm}
                        y2={0}
                        stroke={strokeColor}
                        strokeWidth="6"
                      />
                      <text
                        x={op.offsetCm + op.widthCm / 2}
                        y={14}
                        textAnchor="middle"
                        fill="#7dd3fc"
                        fontSize="9.5"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {op.label} ({op.widthCm}cm)
                      </text>
                    </g>
                  );
                }
                return null;
              })}

              {showRelationEdges &&
                graph.edges.map((edge) => {
                  const fromNode = graph.nodes.find((n) => n.id === edge.from);
                  const toNode = graph.nodes.find((n) => n.id === edge.to);
                  if (!fromNode || !toNode) return null;
                  const rA = getNodeRect(fromNode, 0);
                  const rB = getNodeRect(toNode, 0);
                  const mx = (rA.cx + rB.cx) / 2;
                  const my = (rA.cy + rB.cy) / 2;
                  return (
                    <g key={edge.id}>
                      <line
                        x1={rA.cx}
                        y1={rA.cy}
                        x2={rB.cx}
                        y2={rB.cy}
                        stroke="#818cf8"
                        strokeWidth="1.8"
                        strokeDasharray="4,3"
                      />
                      <rect
                        x={mx - 36}
                        y={my - 9}
                        width={72}
                        height={18}
                        rx="4"
                        fill="#1e1b4b"
                        stroke="#6366f1"
                        strokeWidth="1"
                      />
                      <text
                        x={mx}
                        y={my + 3}
                        textAnchor="middle"
                        fill="#c7d2fe"
                        fontSize="8.5"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {edge.relation} ({edge.distanceCm}±{edge.uncertaintyCm}cm)
                      </text>
                    </g>
                  );
                })}

              {graph.nodes.map((node) => {
                const rect = getNodeRect(node, 0);
                const uncBand =
                  node.uncertainty.posPlusMinusCm + node.uncertainty.dimPlusMinusCm;
                const haloRect = getNodeRect(node, uncBand);
                const st = epistemicStyle(node.epistemic);
                const isSelected = selectedNodeId === node.id;

                return (
                  <g
                    key={node.id}
                    onPointerDown={(e) => handlePointerDown(e, node)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNode(node.id);
                    }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    {showUncertaintyHalo && (
                      <rect
                        x={haloRect.x1}
                        y={haloRect.y1}
                        width={haloRect.w}
                        height={haloRect.d}
                        rx="6"
                        fill={st.haloFill}
                        stroke={st.haloStroke}
                        strokeWidth="1.2"
                        strokeDasharray="3,3"
                      />
                    )}

                    <rect
                      x={rect.x1}
                      y={rect.y1}
                      width={rect.w}
                      height={rect.d}
                      rx="4"
                      fill={st.fill}
                      stroke={isSelected ? '#38bdf8' : st.stroke}
                      strokeWidth={isSelected ? '3' : '2'}
                      strokeDasharray={st.dash}
                    />

                    <text
                      x={rect.cx}
                      y={rect.cy - 4}
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="10.5"
                      fontWeight="600"
                    >
                      {node.label}
                    </text>
                    <text
                      x={rect.cx}
                      y={rect.cy + 10}
                      textAnchor="middle"
                      fill="#cbd5e1"
                      fontSize="8.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {rect.w}×{rect.d}cm (±{uncBand}cm)
                    </text>
                    <text
                      x={rect.cx}
                      y={rect.cy + 21}
                      textAnchor="middle"
                      fill={st.stroke}
                      fontSize="8"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {Math.round(node.confidence * 100)}% · {node.epistemic}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      {/* Epistemic Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-900 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <strong className="text-emerald-300">Observed:</strong> Solid volume · Direct corner visibility
          </span>
          <span className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <strong className="text-amber-300">Inferred:</strong> Dashed volume · Perspective/prior + ±cm shell
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <strong className="text-rose-300">Occluded Prior:</strong> Dotted volume · Blind-spot deduction
          </span>
        </div>
        <div className="flex items-center gap-1 text-sky-300 font-mono">
          <DoorOpen className="w-3.5 h-3.5" />
          <span>Blue Arc = Door Swing Clearance</span>
        </div>
      </div>
    </div>
  );
};
