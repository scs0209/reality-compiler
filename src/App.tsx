import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PRESET_ROOMS } from '../shared/presetRooms';
import type { RoomGraph, RoomObjectNode } from '../shared/roomGraphSchema';
import { evaluateMovingWhatIf } from '../shared/spatialEngine';
import { EvidencePhotoPanel } from './components/EvidencePhotoPanel';
import { TopDownCanvas } from './components/TopDownCanvas';
import { WhatIfSimulatorPanel } from './components/WhatIfSimulatorPanel';
import { PartnerStackPanels } from './components/PartnerStackPanels';
import {
  Cpu,
  Upload,
  Sparkles,
  Trash2,
  RotateCw,
  Layers,
  Globe,
  Server,
} from 'lucide-react';

export function App() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_ROOMS[0].id);
  const [roomGraph, setRoomGraph] = useState<RoomGraph>(() =>
    structuredClone(PRESET_ROOMS[0].roomGraph)
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    PRESET_ROOMS[0].roomGraph.nodes[0]?.id || null
  );

  // Visual toggles
  const [showBBoxOverlay, setShowBBoxOverlay] = useState(true);
  const [showUncertaintyHalo, setShowUncertaintyHalo] = useState(true);
  const [showRelationEdges, setShowRelationEdges] = useState(true);
  const [epistemicFilter, setEpistemicFilter] = useState<
    'all' | 'observed' | 'inferred' | 'occluded_prior'
  >('all');

  // What-If simulator parameters
  const [doorWidthOverrideCm, setDoorWidthOverrideCm] = useState<number>(82);
  const [minWalkwayCm, setMinWalkwayCm] = useState<number>(55);

  // Compile & Atlas state
  const [isCompiling, setIsCompiling] = useState(false);
  const [calibrationObject, setCalibrationObject] = useState(
    'Standard Door Frame (210cm × 82cm)'
  );
  const [calibrationCm, setCalibrationCm] = useState(210);
  const [atlasGraphs, setAtlasGraphs] = useState<RoomGraph[]>(() =>
    PRESET_ROOMS.map((p) => p.roomGraph)
  );
  const [atlasSearchQuery, setAtlasSearchQuery] = useState('');
  const [savingAtlas, setSavingAtlas] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const applyNewRoomGraph = (nextGraph: RoomGraph) => {
    setRoomGraph(structuredClone(nextGraph));
    const entryDoor =
      nextGraph.roomEnvelope.openings.find((o) => o.kind === 'entry_door') ||
      nextGraph.roomEnvelope.openings[0];
    if (entryDoor) {
      setDoorWidthOverrideCm(entryDoor.widthCm);
    }
    setSelectedNodeId(nextGraph.nodes[0]?.id || null);
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/roomgraphs?q=${encodeURIComponent(atlasSearchQuery)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.items) {
          setAtlasGraphs(data.items);
        }
      })
      .catch(() => {
        // Offline or Vite-only fallback
      });
    return () => controller.abort();
  }, [atlasSearchQuery]);

  const whatIfReport = useMemo(
    () => evaluateMovingWhatIf(roomGraph, doorWidthOverrideCm, minWalkwayCm),
    [roomGraph, doorWidthOverrideCm, minWalkwayCm]
  );

  const selectedNode = useMemo(
    () => roomGraph.nodes.find((n) => n.id === selectedNodeId) || null,
    [roomGraph.nodes, selectedNodeId]
  );

  const filteredNodes = useMemo(() => {
    if (epistemicFilter === 'all') return roomGraph.nodes;
    return roomGraph.nodes.filter((n) => n.epistemic === epistemicFilter);
  }, [roomGraph.nodes, epistemicFilter]);

  const handleSelectPreset = async (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = PRESET_ROOMS.find((p) => p.id === presetId);
    if (!preset) return;

    setIsCompiling(true);
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presetId,
          photoDataUrl: preset.photoDataUrl,
          calibrationObject,
          calibrationDimensionCm: calibrationCm,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        applyNewRoomGraph(data.roomGraph);
        showToast(
          `Gemma 3 vision compile finished (${data.roomGraph.compileMeta.latencyMs}ms · Sentry trace recorded)`
        );
      } else {
        applyNewRoomGraph(preset.roomGraph);
      }
    } catch {
      applyNewRoomGraph(preset.roomGraph);
    } finally {
      setIsCompiling(false);
    }
  };

  const handleUploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      setIsCompiling(true);
      try {
        const res = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photoDataUrl: dataUrl,
            fileName: file.name,
            calibrationObject,
            calibrationDimensionCm: calibrationCm,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          applyNewRoomGraph(data.roomGraph);
          showToast(`Compiled "${file.name}" into RoomGraph v1.2!`);
        }
      } catch {
        const customGraph = structuredClone(roomGraph);
        customGraph.title = `${file.name} — Compiled RoomGraph`;
        customGraph.sourcePhotoUrl = dataUrl;
        applyNewRoomGraph(customGraph);
      } finally {
        setIsCompiling(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateNodePosition = (id: string, xCm: number, yCm: number) => {
    setRoomGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              footprint: {
                ...n.footprint,
                xCm,
                yCm,
              },
            }
          : n
      ),
    }));
  };

  const handleRotateNode = (id: string) => {
    setRoomGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              footprint: {
                ...n.footprint,
                rotationDeg: (n.footprint.rotationDeg + 90) % 360,
              },
            }
          : n
      ),
    }));
  };

  const handleDeleteNode = (id: string) => {
    setRoomGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== id),
      edges: prev.edges.filter((e) => e.from !== id && e.to !== id),
    }));
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
    }
  };

  const handleAddFurniture = (
    kind: 'king_bed' | 'sofa_3p' | 'bookshelf' | 'washer'
  ) => {
    const specs: Record<
      typeof kind,
      {
        label: string;
        w: number;
        d: number;
        h: number;
        kg: number;
        disassembly: boolean;
      }
    > = {
      king_bed: {
        label: 'King Bed (What-If)',
        w: 180,
        d: 208,
        h: 95,
        kg: 88,
        disassembly: true,
      },
      sofa_3p: {
        label: '3-Seater Sofa (What-If)',
        w: 210,
        d: 98,
        h: 92,
        kg: 84,
        disassembly: true,
      },
      washer: {
        label: 'WashTower Dryer (What-If)',
        w: 70,
        d: 74,
        h: 189,
        kg: 125,
        disassembly: false,
      },
      bookshelf: {
        label: '5-Tier Bookshelf (What-If)',
        w: 80,
        d: 32,
        h: 185,
        kg: 34,
        disassembly: false,
      },
    };

    const s = specs[kind];
    const newId = `obj-whatif-${Date.now().toString().slice(-4)}`;
    const newNode: RoomObjectNode = {
      id: newId,
      label: s.label,
      labelKo: s.label,
      category: kind === 'washer' ? 'appliance' : 'furniture',
      epistemic: 'inferred',
      confidence: 0.85,
      evidenceSource: 'Injected from What-If Moving Catalog with manufacturer dimensions',
      bbox2d: { x: 0.35, y: 0.45, w: 0.22, h: 0.22 },
      footprint: {
        xCm: 90,
        yCm: 140,
        widthCm: s.w,
        depthCm: s.d,
        heightCm: s.h,
        rotationDeg: 0,
      },
      uncertainty: {
        posPlusMinusCm: 4,
        dimPlusMinusCm: 3,
        reason: 'Catalog spec + wall clearance tolerance ±4cm',
      },
      movable: true,
      weightKgEst: s.kg,
      disassemblyRequired: s.disassembly,
      colorTag: '#38bdf8',
    };

    setRoomGraph((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
    setSelectedNodeId(newId);
    showToast(`Added ${s.label}. Switch to 2D Blueprint to drag or 3D Volumes to inspect!`);
  };

  const handleSaveToAtlas = async () => {
    setSavingAtlas(true);
    try {
      const res = await fetch('/api/roomgraphs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomGraph }),
      });
      if (res.ok) {
        const listRes = await fetch('/api/roomgraphs');
        if (listRes.ok) {
          const d = await listRes.json();
          setAtlasGraphs(d.items || []);
        }
        showToast('Upserted current RoomGraph to MongoDB Atlas (roomgraphs collection).');
      }
    } finally {
      setSavingAtlas(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Header with Partner Stack Status */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 py-2.5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  Reality Compiler
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  roomgraph.v1.2
                </span>
                <span className="hidden md:inline-block text-xs text-slate-400">
                  — Compile room photos into executable spatial graphs with epistemic uncertainty
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                <span>
                  Outputs actionable reality data (3D epistemic volumes, ±cm error bars, moving
                  bottlenecks) instead of decorative 3D meshes
                </span>
              </div>
            </div>
          </div>

          {/* Partner Stack Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
            <span className="px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <Cpu className="w-3 h-3" />
              Gemma 3 (gemma3:4b)
            </span>
            <span className="px-2 py-1 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1">
              <Server className="w-3 h-3" />
              DigitalOcean
            </span>
            <span className="px-2 py-1 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              realitycompiler.tech
            </span>
            <span className="px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              MongoDB Atlas
            </span>
            <span className="px-2 py-1 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30">
              Sentry Agent Tracing
            </span>
            <span className="px-2 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Entire CLI Tracked
            </span>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-medium shadow-xl border border-sky-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main 3-Column Compiler Workbench */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN (3 cols): Input Evidence, Calibration & Epistemic Object Inspector */}
        <section className="lg:col-span-3 flex flex-col gap-3.5">
          {/* Room Preset & Photo Upload Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                1. Reality Evidence (Photo / Presets)
              </h2>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium whitespace-nowrap shrink-0 transition"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadPhoto}
                className="hidden"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              {PRESET_ROOMS.map((preset) => {
                const active = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`text-left p-2.5 rounded-lg border transition flex flex-col gap-1 ${
                      active
                        ? 'bg-sky-950/40 border-sky-500/50 text-slate-100'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold">{preset.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{preset.subtitle}</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] font-mono text-sky-400">
                        {preset.roomType}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-slate-300 border border-slate-800">
                        {preset.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Calibration Anchor Controls */}
            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2 text-xs">
              <div className="text-[11px] font-semibold text-slate-300">
                Scale Reference (Calibration Anchor)
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={calibrationObject}
                  onChange={(e) => setCalibrationObject(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 text-xs"
                />
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded px-2">
                  <input
                    type="number"
                    value={calibrationCm}
                    onChange={(e) => setCalibrationCm(Number(e.target.value))}
                    className="w-12 bg-transparent text-right font-mono text-xs text-sky-300 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">cm</span>
                </div>
              </div>
              <button
                type="button"
                disabled={isCompiling}
                onClick={() => handleSelectPreset(selectedPresetId)}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isCompiling
                  ? 'Compiling with Gemma 3 (gemma3:4b)...'
                  : 'Re-Compile RoomGraph with Gemma 3'}
              </button>
            </div>
          </div>

          {/* Epistemic Uncertainty Breakdown (Observed vs Inferred vs Occluded) */}
          <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 flex flex-col gap-2.5 flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                2. Epistemic Classification (Observed vs Inferred)
              </h2>
              <span className="text-xs font-mono text-emerald-400">
                Mean Conf: {Math.round(roomGraph.epistemicSummary.overallConfidence * 100)}%
              </span>
            </div>

            {/* Filter Chips */}
            <div className="grid grid-cols-4 gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setEpistemicFilter('all')}
                className={`py-1 rounded border font-medium ${
                  epistemicFilter === 'all'
                    ? 'bg-slate-800 text-white border-slate-600'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                All ({roomGraph.nodes.length})
              </button>
              <button
                type="button"
                onClick={() => setEpistemicFilter('observed')}
                className={`py-1 rounded border font-medium ${
                  epistemicFilter === 'observed'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-950 text-emerald-400/70 border-slate-800'
                }`}
              >
                Obs ({roomGraph.nodes.filter((n) => n.epistemic === 'observed').length})
              </button>
              <button
                type="button"
                onClick={() => setEpistemicFilter('inferred')}
                className={`py-1 rounded border font-medium ${
                  epistemicFilter === 'inferred'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-950 text-amber-400/70 border-slate-800'
                }`}
              >
                Inf ({roomGraph.nodes.filter((n) => n.epistemic === 'inferred').length})
              </button>
              <button
                type="button"
                onClick={() => setEpistemicFilter('occluded_prior')}
                className={`py-1 rounded border font-medium ${
                  epistemicFilter === 'occluded_prior'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-950 text-rose-400/70 border-slate-800'
                }`}
              >
                Occ ({roomGraph.nodes.filter((n) => n.epistemic === 'occluded_prior').length})
              </button>
            </div>

            {/* Object List */}
            <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
              {filteredNodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const uncSum =
                  node.uncertainty.posPlusMinusCm + node.uncertainty.dimPlusMinusCm;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-sky-950/40 border-sky-500/60'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-100">{node.label}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                          node.epistemic === 'observed'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : node.epistemic === 'inferred'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {node.epistemic === 'observed' && 'OBSERVED'}
                        {node.epistemic === 'inferred' && 'INFERRED'}
                        {node.epistemic === 'occluded_prior' && 'OCCLUDED'} ·{' '}
                        {Math.round(node.confidence * 100)}%
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-1">
                      Size: {node.footprint.widthCm}×{node.footprint.depthCm}×
                      {node.footprint.heightCm}cm · Uncertainty: ±{uncSum}cm
                    </div>
                    <p className="text-[11px] text-slate-300/90 mt-1 leading-snug">
                      {node.evidenceSource}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Selected Node Action Bar */}
            {selectedNode && (
              <div className="mt-auto pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium truncate">
                  Selected: <strong className="text-sky-300">{selectedNode.label}</strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleRotateNode(selectedNode.id)}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                    title="Rotate 90 degrees"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNode(selectedNode.id)}
                    className="p-1.5 rounded bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-500/30"
                    title="Remove Object"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* CENTER COLUMN (5 cols): Source Photo Overlay + Interactive 3D / 2D Spatial Viewer */}
        <section className="lg:col-span-5 flex flex-col gap-3.5">
          <EvidencePhotoPanel
            graph={roomGraph}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            showBBoxOverlay={showBBoxOverlay}
            onToggleBBoxOverlay={() => setShowBBoxOverlay((v) => !v)}
          />

          <TopDownCanvas
            graph={roomGraph}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onUpdateNodePosition={handleUpdateNodePosition}
            onRotateNode={handleRotateNode}
            onAddFurniture={handleAddFurniture}
            showUncertaintyHalo={showUncertaintyHalo}
            onToggleUncertaintyHalo={() => setShowUncertaintyHalo((v) => !v)}
            showRelationEdges={showRelationEdges}
            onToggleRelationEdges={() => setShowRelationEdges((v) => !v)}
          />
        </section>

        {/* RIGHT COLUMN (4 cols): Moving What-If Simulator + RoomGraph JSON / Sentry / Atlas / Entire */}
        <section className="lg:col-span-4 flex flex-col gap-3.5">
          <WhatIfSimulatorPanel
            graph={roomGraph}
            report={whatIfReport}
            doorWidthOverrideCm={doorWidthOverrideCm}
            onChangeDoorWidth={setDoorWidthOverrideCm}
            minWalkwayCm={minWalkwayCm}
            onChangeMinWalkway={setMinWalkwayCm}
            onSelectNode={(id) => setSelectedNodeId(id)}
            onResetLayout={() => {
              const preset =
                PRESET_ROOMS.find((p) => p.id === selectedPresetId) || PRESET_ROOMS[0];
              applyNewRoomGraph(preset.roomGraph);
              showToast('Reset to initial compiled layout.');
            }}
          />

          <PartnerStackPanels
            graph={roomGraph}
            atlasGraphs={atlasGraphs}
            atlasSearchQuery={atlasSearchQuery}
            onChangeAtlasSearch={setAtlasSearchQuery}
            onLoadRoomGraph={(g) => {
              applyNewRoomGraph(g);
              showToast(`Loaded "${g.title}" from MongoDB Atlas.`);
            }}
            onSaveToAtlas={handleSaveToAtlas}
            savingAtlas={savingAtlas}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
