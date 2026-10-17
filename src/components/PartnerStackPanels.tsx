import React, { useState } from 'react';
import type { RoomGraph } from '../../shared/roomGraphSchema';
import {
  Copy,
  Check,
  Download,
  Database,
  Activity,
  FileCode2,
  GitBranch,
  Cpu,
} from 'lucide-react';

interface PartnerStackPanelsProps {
  graph: RoomGraph;
  atlasGraphs: RoomGraph[];
  atlasSearchQuery: string;
  onChangeAtlasSearch: (q: string) => void;
  onLoadRoomGraph: (g: RoomGraph) => void;
  onSaveToAtlas: () => void;
  savingAtlas: boolean;
}

export const PartnerStackPanels: React.FC<PartnerStackPanelsProps> = ({
  graph,
  atlasGraphs,
  atlasSearchQuery,
  onChangeAtlasSearch,
  onLoadRoomGraph,
  onSaveToAtlas,
  savingAtlas,
}) => {
  const [subTab, setSubTab] = useState<'json' | 'sentry' | 'atlas' | 'entire'>('json');
  const [copied, setCopied] = useState(false);

  const jsonText = JSON.stringify(graph, null, 2);

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graph.sceneId}.roomgraph.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const header =
      'id,label,category,epistemic,confidence,xCm,yCm,widthCm,depthCm,heightCm,posPlusMinusCm,dimPlusMinusCm,weightKgEst,disassemblyRequired\n';
    const rows = graph.nodes
      .map(
        (n) =>
          `${n.id},"${n.label}",${n.category},${n.epistemic},${n.confidence},${n.footprint.xCm},${n.footprint.yCm},${n.footprint.widthCm},${n.footprint.depthCm},${n.footprint.heightCm},${n.uncertainty.posPlusMinusCm},${n.uncertainty.dimPlusMinusCm},${n.weightKgEst},${n.disassemblyRequired}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graph.sceneId}.moving_manifest.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalDuration = graph.compileMeta.latencyMs || 1;

  return (
    <div className="flex flex-col bg-slate-900/95 border border-slate-800 rounded-xl overflow-hidden">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSubTab('json')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition ${
              subTab === 'json'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            RoomGraph JSON
          </button>
          <button
            type="button"
            onClick={() => setSubTab('sentry')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition ${
              subTab === 'sentry'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Sentry Trace
          </button>
          <button
            type="button"
            onClick={() => setSubTab('atlas')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition ${
              subTab === 'atlas'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            MongoDB Atlas ({atlasGraphs.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('entire')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition ${
              subTab === 'entire'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Entire CLI Session
          </button>
        </div>
      </div>

      {/* Tab 1: RoomGraph JSON & CSV Export */}
      {subTab === 'json' && (
        <div className="p-3.5 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-400 font-mono">
              Schema: <strong className="text-sky-300">{graph.schemaVersion}</strong> · Nodes:{' '}
              {graph.nodes.length} · Edges: {graph.edges.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyJson}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy JSON
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium transition"
              >
                <Download className="w-3.5 h-3.5" />
                .roomgraph.json
              </button>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
              >
                <Download className="w-3.5 h-3.5" />
                Manifest CSV (TabPFN)
              </button>
            </div>
          </div>
          <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 max-h-72 overflow-y-auto leading-relaxed">
            {jsonText}
          </pre>
        </div>
      )}

      {/* Tab 2: Sentry Agent Tracing Waterfall */}
      {subTab === 'sentry' && (
        <div className="p-3.5 flex flex-col gap-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950 border border-purple-500/30">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <div>
                <div className="font-mono text-[11px] text-purple-300">
                  sentry.trace_id: {graph.compileMeta.sentryTraceId}
                </div>
                <div className="text-slate-400 text-[11px]">
                  Model: <strong className="text-slate-200">{graph.compileMeta.model}</strong> ·
                  Runtime: {graph.compileMeta.runtime}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono">
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30">
                Latency: {graph.compileMeta.latencyMs} ms
              </span>
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-200 border border-sky-500/30">
                Tokens: {graph.compileMeta.tokens.total} ({graph.compileMeta.tokens.prompt}p +{' '}
                {graph.compileMeta.tokens.completion}c)
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Agent Span Waterfall (Sentry OpenTelemetry GenAI Semantic Conventions)
            </div>
            {graph.compileMeta.spans.map((span, idx) => {
              const widthPct = Math.max(
                8,
                Math.min(100, Math.round((span.durationMs / totalDuration) * 100))
              );
              const leftPct = Math.min(82, idx * 14);
              return (
                <div
                  key={`${span.op}-${idx}`}
                  className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-purple-300 font-semibold">{span.op}</span>
                    <span className="text-slate-400">{span.durationMs} ms</span>
                  </div>
                  <div className="text-slate-300 text-[11px]">{span.description}</div>
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden relative">
                    <div
                      style={{
                        width: `${widthPct}%`,
                        marginLeft: `${Math.min(100 - widthPct, leftPct)}%`,
                      }}
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-sky-400"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {Object.entries(span.attributes).map(([k, v]) => (
                      <span
                        key={k}
                        className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-mono text-[10px] border border-slate-800"
                      >
                        {k}: <strong className="text-slate-200">{String(v)}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: MongoDB Atlas Document Store & Search */}
      {subTab === 'atlas' && (
        <div className="p-3.5 flex flex-col gap-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={atlasSearchQuery}
                onChange={(e) => onChangeAtlasSearch(e.target.value)}
                placeholder="Search MongoDB Atlas (furniture label, observed/inferred, title)..."
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={onSaveToAtlas}
              disabled={savingAtlas}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium transition"
            >
              {savingAtlas ? 'Saving to Atlas...' : 'Upsert RoomGraph to Atlas'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
            {atlasGraphs.map((item) => (
              <div
                key={item.sceneId}
                onClick={() => onLoadRoomGraph(item)}
                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                  item.sceneId === graph.sceneId
                    ? 'bg-emerald-950/30 border-emerald-500/40'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-200">{item.title}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    sceneId: {item.sceneId} · {item.roomEnvelope.widthCm}×
                    {item.roomEnvelope.depthCm}cm · {item.nodes.length} objects
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-900 text-emerald-300 border border-emerald-500/30 font-mono text-[10px]">
                  Load Scene
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Entire CLI & DevRelay Agent Session Rationale */}
      {subTab === 'entire' && (
        <div className="p-3.5 flex flex-col gap-2.5 text-xs">
          <div className="p-2.5 rounded-lg bg-amber-950/25 border border-amber-500/30 text-amber-200">
            <div className="font-semibold">
              Entire CLI Active (`.entire/settings.json` + `entire-session/devrelay-session.json`)
            </div>
            <p className="text-[11px] opacity-85 mt-0.5">
              Git hooks and checkpoints are tracked via Entire CLI (`entire status` / `entire
              checkpoint list`), documenting why we built epistemic 3D/2D uncertainty volumes
              instead of hallucinated photogrammetry meshes.
            </p>
          </div>

          <div className="space-y-2 font-mono text-[11px] text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div>
              <span className="text-amber-400">[Checkpoint #1 — Schema Design]</span> Single-image
              3D surface meshes hallucinate over occluded corners and create false precision. We
              designed <code>roomgraph.v1.2</code> so every object carries{' '}
              <code>epistemic: observed | inferred | occluded_prior</code> and explicit{' '}
              <code>±cm</code> error bands.
            </div>
            <div>
              <span className="text-sky-400">[Checkpoint #2 — Gemma 3 Vision Prompt]</span>{' '}
              <code>gemma3:4b</code> first calibrates pixel-to-cm scale against a standard door frame
              (210×82cm) before extracting 2D bboxes, 3D bounding volumes, and blind spots.
            </div>
            <div>
              <span className="text-emerald-400">[Checkpoint #3 — 3D Epistemic Volumes & Solver]</span>{' '}
              Added interactive 3D Epistemic Volumes + 2D Blueprint toggle, flagging{' '}
              <code>UNCERTAINTY_OVERFLOW</code> when two items pass nominally (2cm gap) but collide
              under <code>±12cm</code> combined uncertainty.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
