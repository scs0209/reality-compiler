import React, { useRef, useState, Suspense } from 'react';
import type { RoomGraph, RoomObjectNode } from '../../shared/roomGraphSchema';
import { getNodeRect } from '../../shared/spatialEngine';
import { useI18n, nodeLabel } from '../i18n';
import { ToggleChip } from './ToggleChip';
// three.js is large, so the 3D scene is its own chunk and the rest of the app renders first.
const Scene3D = React.lazy(() => import('./Scene3D').then((m) => ({ default: m.Scene3D })));
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
  const { t, lang } = useI18n();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

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
    }
  };

  const handlePointerUp = () => {
    setDraggingId(null);
  };

  // Evidence palette: observed = muted cyan, estimated = amber, low-confidence = muted orange.
  const epistemicStyle = (status: RoomObjectNode['epistemic']) => {
    if (status === 'observed') {
      return {
        stroke: '#5BB8C9',
        fill: 'rgba(91, 184, 201, 0.20)',
        topFill: 'rgba(91, 184, 201, 0.34)',
        sideFill: 'rgba(44, 125, 143, 0.26)',
        haloFill: 'rgba(91, 184, 201, 0.07)',
        haloStroke: '#8FD3DE',
        dash: undefined,
        badge: 'OBSERVED',
      };
    }
    if (status === 'inferred') {
      return {
        stroke: '#FBBF24',
        fill: 'rgba(251, 191, 36, 0.18)',
        topFill: 'rgba(251, 191, 36, 0.04)',
        sideFill: 'rgba(180, 130, 20, 0.02)',
        haloFill: 'rgba(251, 191, 36, 0.12)',
        haloStroke: '#FCD34D',
        dash: '6,4',
        badge: 'INFERRED',
      };
    }
    return {
      stroke: '#DE8B4D',
      fill: 'rgba(222, 139, 77, 0.20)',
      topFill: 'rgba(222, 139, 77, 0.04)',
      sideFill: 'rgba(166, 92, 46, 0.02)',
      haloFill: 'rgba(222, 139, 77, 0.14)',
      haloStroke: '#E9A777',
      dash: '4,4',
      badge: 'OCCLUDED PRIOR',
    };
  };

  return (
    <div className="panel flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          {/* 2D vs 3D Mode Switcher */}
          <div className="inline-flex rounded-full border border-slate-800 bg-slate-950 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition ${
                viewMode === '3d'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              {t('canvas.mode3d')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition ${
                viewMode === '2d'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              {t('canvas.mode2d')}
            </button>
          </div>
          <span className="hidden whitespace-nowrap rounded border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 font-mono text-sky-300 sm:inline-block">
            {viewMode === '3d'
              ? t('canvas.hint3d')
              : t('canvas.hint2d')}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <ToggleChip on={showUncertaintyHalo} onClick={onToggleUncertaintyHalo}>
            {t('canvas.shell')}
          </ToggleChip>
          <ToggleChip on={showRelationEdges} onClick={onToggleRelationEdges}>
            {t('canvas.relationEdges')}
          </ToggleChip>
          {selectedNodeId && (
            <button
              type="button"
              onClick={() => onRotateNode(selectedNodeId)}
              className="btn-primary"
            >
              <RotateCw className="w-3.5 h-3.5" />
              {t('canvas.rotate90')}
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
              <strong>{t('canvas.why.title')}</strong> {t('canvas.why.p1')}{' '}
              <span className="text-emerald-300 font-semibold">{t('canvas.why.obs')}</span>{' '}
              {t('canvas.why.p2')}{' '}
              <span className="text-amber-300 font-semibold">{t('canvas.why.inf')}</span>{' '}
              {t('canvas.why.p3')}{' '}
              <span className="text-orange-300 font-semibold">{t('canvas.why.occ')}</span>{' '}
              {t('canvas.why.p4')} <code>±cm</code> {t('canvas.why.p5')}
            </span>
          </div>
        </div>
      )}

      {/* What-If Add Furniture Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-950/70 border-b border-slate-800/80 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          <span>{t('canvas.inject')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAddFurniture('king_bed')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            {t('canvas.add.king')}
          </button>
          <button
            type="button"
            onClick={() => onAddFurniture('sofa_3p')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            {t('canvas.add.sofa')}
          </button>
          <button
            type="button"
            onClick={() => onAddFurniture('washer')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            {t('canvas.add.washer')}
          </button>
          <button
            type="button"
            onClick={() => onAddFurniture('bookshelf')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            {t('canvas.add.shelf')}
          </button>
        </div>
      </div>

      {/* Canvas Viewport: 3D Volumetric Wireframe OR 2D Metric Blueprint */}
      <div
        className={`relative flex flex-1 select-none items-center justify-center bg-slate-950 ${
          viewMode === '3d' ? '' : 'min-h-[320px] p-3 lg:min-h-[480px]'
        }`}
      >
        {viewMode === '3d' ? (
          <Suspense
            fallback={
              <div className="flex h-[420px] w-full items-center justify-center text-xs text-slate-400 sm:h-[520px] lg:h-[580px]">
                {t('canvas.3d.loading')}
              </div>
            }
          >
            <Scene3D
              graph={graph}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              onUpdateNodePosition={onUpdateNodePosition}
              showUncertaintyHalo={showUncertaintyHalo}
              showRelationEdges={showRelationEdges}
            />
          </Suspense>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${viewW} ${viewD}`}
            className="w-full max-h-[620px] touch-none cursor-crosshair"
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
                  stroke="rgba(142, 160, 181, 0.12)"
                  strokeWidth="1"
                />
              </pattern>
              <pattern id="grid10" width="10" height="10" patternUnits="userSpaceOnUse">
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke="rgba(142, 160, 181, 0.04)"
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
                fill="#0B1017"
                stroke="#74869C"
                strokeWidth="4"
              />
              <rect x={0} y={0} width={envW} height={envD} fill="url(#grid10)" />
              <rect x={0} y={0} width={envW} height={envD} fill="url(#grid50)" />

              <text
                x={envW / 2}
                y={-12}
                textAnchor="middle"
                fill="#8EA0B5"
                fontSize="11"
                fontFamily="JetBrains Mono, monospace"
              >
                {t('canvas.svg.north', { w: envW, u: graph.roomEnvelope.uncertaintyCm })}
              </text>
              <text
                x={-14}
                y={envD / 2}
                textAnchor="middle"
                fill="#8EA0B5"
                fontSize="11"
                fontFamily="JetBrains Mono, monospace"
                transform={`rotate(-90, -14, ${envD / 2})`}
              >
                {t('canvas.svg.west', { d: envD })}
              </text>

              {graph.epistemicSummary.blindSpots.map((bs, idx) => (
                <g key={bs.id}>
                  <rect
                    x={12}
                    y={envD - 80 - idx * 45}
                    width={110}
                    height={34}
                    rx="4"
                    fill="rgba(222, 139, 77, 0.10)"
                    stroke="rgba(222, 139, 77, 0.45)"
                    strokeDasharray="3,3"
                  />
                  <text
                    x={18}
                    y={envD - 60 - idx * 45}
                    fill="#E9A777"
                    fontSize="8.5"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {t('canvas.svg.blindSpot', { n: idx + 1, risk: bs.riskLevel })}
                  </text>
                </g>
              ))}

              {graph.roomEnvelope.openings.map((op) => {
                const isDoor = op.kind === 'entry_door' || op.kind === 'balcony_door';
                const strokeColor = isDoor ? '#22D3EE' : '#67E8F9';
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
                          fill="rgba(34, 211, 238, 0.12)"
                          stroke="#22D3EE"
                          strokeWidth="1.5"
                          strokeDasharray="4,3"
                        />
                      )}
                      <text
                        x={op.offsetCm + op.widthCm / 2}
                        y={envD + 18}
                        textAnchor="middle"
                        fill="#22D3EE"
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
                        fill="#67E8F9"
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
                        stroke="#8197BD"
                        strokeWidth="1.8"
                        strokeDasharray="4,3"
                      />
                      <rect
                        x={mx - 36}
                        y={my - 9}
                        width={72}
                        height={18}
                        rx="4"
                        fill="#161E2C"
                        stroke="#637CA6"
                        strokeWidth="1"
                      />
                      <text
                        x={mx}
                        y={my + 3}
                        textAnchor="middle"
                        fill="#C5D1E6"
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
                      stroke={isSelected ? '#22D3EE' : st.stroke}
                      strokeWidth={isSelected ? '3' : '2'}
                      strokeDasharray={st.dash}
                    />

                    <text
                      x={rect.cx}
                      y={rect.cy - 4}
                      textAnchor="middle"
                      fill="#E6EDF5"
                      fontSize="10.5"
                      fontWeight="600"
                    >
                      {nodeLabel(node, lang)}
                    </text>
                    <text
                      x={rect.cx}
                      y={rect.cy + 10}
                      textAnchor="middle"
                      fill="#A9B8C9"
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
            <strong className="text-emerald-300">{t('canvas.legend.observed')}</strong> {t('canvas.legend.observedDesc')}
          </span>
          <span className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <strong className="text-amber-300">{t('canvas.legend.inferred')}</strong> {t('canvas.legend.inferredDesc')}
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
            <strong className="text-orange-300">{t('canvas.legend.occluded')}</strong> {t('canvas.legend.occludedDesc')}
          </span>
        </div>
        <div className="flex items-center gap-1 text-sky-300 font-mono">
          <DoorOpen className="w-3.5 h-3.5" />
          <span>{t('canvas.legend.door')}</span>
        </div>
      </div>
    </div>
  );
};
