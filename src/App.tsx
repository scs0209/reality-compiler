import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PRESET_ROOMS } from '../shared/presetRooms';
import type { RoomGraph, RoomObjectNode } from '../shared/roomGraphSchema';
import { evaluateMovingWhatIf } from '../shared/spatialEngine';
import { EvidencePhotoPanel } from './components/EvidencePhotoPanel';
import { TopDownCanvas } from './components/TopDownCanvas';
import { WhatIfSimulatorPanel } from './components/WhatIfSimulatorPanel';
import { PartnerStackPanels, type SentryStatus } from './components/PartnerStackPanels';
import { KpiStrip } from './components/KpiStrip';
import { EvidenceSidebar } from './components/EvidenceSidebar';
import { SceneInspector } from './components/SceneInspector';
import { useI18n, nodeLabel, presetCopy } from './i18n';
import { boxesAreModelEstimates } from './evidenceStyle';
import { downscaleImageDataUrl } from './imageUtils';
import {
  AlertTriangle,
  Upload,
  Sparkles,
  Layers,
  ScanSearch,
} from 'lucide-react';

export function App() {
  const { t, lang, toggleLang } = useI18n();
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_ROOMS[0].id);
  const [roomGraph, setRoomGraph] = useState<RoomGraph>(() =>
    structuredClone(PRESET_ROOMS[0].roomGraph)
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    PRESET_ROOMS[0].roomGraph.nodes[0]?.id || null
  );
  // The graph as last loaded/compiled, so "reset layout" restores it rather than a preset.
  const [baseGraph, setBaseGraph] = useState<RoomGraph>(() =>
    structuredClone(PRESET_ROOMS[0].roomGraph)
  );
  const [uploadedPhoto, setUploadedPhoto] = useState<{
    dataUrl: string;
    fileName: string;
  } | null>(null);

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
  const [sentryStatus, setSentryStatus] = useState<SentryStatus | null>(null);
  // Live readouts for the toolbar chips; null while unknown.
  const [systemStatus, setSystemStatus] = useState<{
    gemma: { model: string; state: 'ready' | 'no-model' | 'offline' } | null;
    atlas: 'connected' | 'memory' | null;
  }>({ gemma: null, atlas: null });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const applyNewRoomGraph = (nextGraph: RoomGraph) => {
    setBaseGraph(structuredClone(nextGraph));
    setRoomGraph(structuredClone(nextGraph));
    const entryDoor =
      nextGraph.roomEnvelope.openings.find((o) => o.kind === 'entry_door') ||
      nextGraph.roomEnvelope.openings[0];
    if (entryDoor) {
      setDoorWidthOverrideCm(entryDoor.widthCm);
    }
    setSelectedNodeId(nextGraph.nodes[0]?.id || null);
    // Boxes the model drew itself are often wrong; start with them hidden (the toggle still works).
    setShowBBoxOverlay(!boxesAreModelEstimates(nextGraph));
  };

  const refreshStatus = () => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setSentryStatus(data?.partners?.sentryAgentTracing ?? null);
        const gemma = data?.partners?.gemma;
        const atlas = data?.partners?.mongodbAtlas;
        setSystemStatus({
          gemma: gemma
            ? {
                model: String(gemma.model),
                state: !gemma.ollamaReachable ? 'offline' : gemma.modelInstalled ? 'ready' : 'no-model',
              }
            : null,
          atlas: atlas ? (atlas.status === 'connected_atlas' ? 'connected' : 'memory') : null,
        });
      })
      .catch(() => {
        setSentryStatus(null);
        setSystemStatus({ gemma: null, atlas: null });
      });
  };

  useEffect(() => {
    refreshStatus();
  }, []);

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

  // Presets are hand-authored samples: loading one runs no compile.
  const handleSelectPreset = (presetId: string) => {
    const preset = PRESET_ROOMS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(presetId);
    applyNewRoomGraph(preset.roomGraph);
    showToast(t('app.toast.sample', { name: presetCopy(preset, lang).name }));
  };

  const compilePhoto = async (photo: { dataUrl: string; fileName: string }) => {
    setIsCompiling(true);
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoDataUrl: photo.dataUrl,
          fileName: photo.fileName,
          calibrationObject,
          calibrationDimensionCm: calibrationCm,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      applyNewRoomGraph(data.roomGraph);
      showToast(
        data.roomGraph.compileMeta.fallback
          ? t('app.toast.fallback')
          : t('app.toast.uploaded', { name: photo.fileName })
      );
    } catch (err) {
      // Keep the current graph: never substitute a made-up result for a failed compile.
      showToast(
        t('app.toast.compileFailed', {
          reason: err instanceof Error ? err.message : String(err),
        })
      );
    } finally {
      setIsCompiling(false);
      // Spans are delivered in the background, so look again shortly after the compile.
      refreshStatus();
      setTimeout(refreshStatus, 3000);
    }
  };

  const handleUploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = await downscaleImageDataUrl(String(reader.result || ''));
      const photo = { dataUrl, fileName: file.name };
      setUploadedPhoto(photo);
      setSelectedPresetId('');
      await compilePhoto(photo);
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
        labelKo: string;
        w: number;
        d: number;
        h: number;
        kg: number;
        disassembly: boolean;
      }
    > = {
      king_bed: {
        label: 'King Bed (What-If)',
        labelKo: '킹 침대 (What-If)',
        w: 180,
        d: 208,
        h: 95,
        kg: 88,
        disassembly: true,
      },
      sofa_3p: {
        label: '3-Seater Sofa (What-If)',
        labelKo: '3인용 소파 (What-If)',
        w: 210,
        d: 98,
        h: 92,
        kg: 84,
        disassembly: true,
      },
      washer: {
        label: 'WashTower Dryer (What-If)',
        labelKo: '워시타워 건조기 (What-If)',
        w: 70,
        d: 74,
        h: 189,
        kg: 125,
        disassembly: false,
      },
      bookshelf: {
        label: '5-Tier Bookshelf (What-If)',
        labelKo: '5단 책장 (What-If)',
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
      labelKo: s.labelKo,
      category: kind === 'washer' ? 'appliance' : 'furniture',
      epistemic: 'inferred',
      confidence: 0.85,
      evidenceSource: 'Injected from What-If Moving Catalog with manufacturer dimensions',
      bbox2d: null, // injected what-if item: not in the photo
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
      colorTag: '#22D3EE',
    };

    setRoomGraph((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
    setSelectedNodeId(newId);
    showToast(t('app.toast.added', { name: nodeLabel(s, lang) }));
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
        showToast(t('app.toast.saved'));
      }
    } finally {
      setSavingAtlas(false);
    }
  };

  const meta = roomGraph.compileMeta;
  const sceneChip =
    meta.runtime === 'fallback-preset'
      ? { label: t('status.scene.fallback'), dot: 'bg-amber-400', className: 'border-amber-400/40 text-amber-300' }
      : meta.runtime === 'preset-sample'
        ? { label: t('status.scene.sample'), dot: 'bg-slate-500', className: '' }
        : {
            label: t('status.scene.compiled', { model: meta.model }),
            dot: 'bg-emerald-400',
            className: 'border-emerald-400/30 text-emerald-300',
          };
  const gemmaState = systemStatus.gemma?.state ?? null;
  const gemmaDot =
    gemmaState === 'ready'
      ? 'bg-emerald-400'
      : gemmaState === 'no-model'
        ? 'bg-amber-400'
        : gemmaState === 'offline'
          ? 'bg-rose-400'
          : 'bg-slate-600';
  const gemmaTitle =
    gemmaState === 'ready'
      ? t('status.gemma.ready')
      : gemmaState === 'no-model'
        ? t('status.gemma.nomodel')
        : gemmaState === 'offline'
          ? t('status.gemma.offline')
          : t('status.unknown');
  const atlasDot =
    systemStatus.atlas === 'connected'
      ? 'bg-emerald-400'
      : systemStatus.atlas === 'memory'
        ? 'bg-amber-400'
        : 'bg-slate-600';
  const atlasLabel =
    systemStatus.atlas === 'memory' ? t('status.atlas.memory') : t('status.atlas.connected');

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Floating toolbar: identity, current scene and its provenance, live system status */}
      <header className="z-30 border-b border-slate-800 bg-slate-950/85 backdrop-blur-md md:sticky md:top-0">
        <div className="mx-auto flex max-w-[1760px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-sky-400/40 bg-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.16)]">
              <Layers className="h-4 w-4 text-sky-400" />
            </div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-100">{t('app.title')}</h1>
            <span className="chip border-sky-400/30 text-sky-300">roomgraph.v1.2</span>
          </div>

          <span className="hidden h-5 w-px bg-slate-700/70 md:block" aria-hidden="true" />

          <div className="flex w-full min-w-0 items-center gap-2.5 md:w-auto md:max-w-[20rem] xl:max-w-[22rem] 2xl:max-w-[28rem]">
            <span className="truncate text-xs text-slate-300" title={roomGraph.title}>
              {roomGraph.title}
            </span>
            <span className={`chip shrink-0 ${sceneChip.className}`}>
              <i className={`h-1.5 w-1.5 rounded-full ${sceneChip.dot}`} />
              {sceneChip.label}
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <span className="chip" title={gemmaTitle}>
              <i className={`h-1.5 w-1.5 rounded-full ${gemmaDot}`} />
              {systemStatus.gemma?.model ?? 'gemma3:4b'}
            </span>
            <span className="chip" title={atlasLabel}>
              <i className={`h-1.5 w-1.5 rounded-full ${atlasDot}`} />
              {atlasLabel}
            </span>
            <span
              className="chip"
              title={sentryStatus && !sentryStatus.enabled ? (sentryStatus.reason ?? undefined) : undefined}
            >
              <i
                className={`h-1.5 w-1.5 rounded-full ${sentryStatus?.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`}
              />
              {sentryStatus === null
                ? t('app.pill.sentryUnknown')
                : sentryStatus.enabled
                  ? t('app.pill.sentry')
                  : t('app.pill.sentryOff')}
            </span>
            <button type="button" onClick={toggleLang} className="btn-secondary">
              {t('app.lang.toggle')}
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="glass fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-100">
          <Sparkles className="h-4 w-4 shrink-0 text-sky-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Workstation: Source & Evidence | Spatial canvas + manifest | Scene Inspector */}
      <main className="mx-auto grid w-full max-w-[1760px] flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_19rem] 2xl:grid-cols-[19rem_minmax(0,1fr)_23rem]">
        {/* LEFT: Source & Evidence */}
        <aside className="order-2 flex min-w-0 flex-col gap-3 lg:order-1 lg:sticky lg:top-14 lg:max-h-[calc(100vh-4.5rem)] lg:self-start lg:overflow-y-auto">
          <div className="panel flex flex-col divide-y divide-slate-800">
            <div className="flex flex-col gap-3 p-3.5">
              <h2 className="panel-title">
                <ScanSearch className="h-4 w-4 text-sky-400" />
                {t('panel.source')}
              </h2>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary w-full py-2"
              >
                <Upload className="h-3.5 w-3.5" />
                {t('app.btn.upload')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadPhoto}
                className="hidden"
              />

              <div className="section-title">{t('app.section.evidence')}</div>
              <div className="flex flex-col gap-1.5">
                {PRESET_ROOMS.map((preset) => {
                  const active = selectedPresetId === preset.id;
                  const copy = presetCopy(preset, lang);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      aria-pressed={active}
                      className={`flex flex-col gap-1 rounded-md border p-2 text-left transition ${
                        active
                          ? 'border-sky-400/50 bg-sky-400/10 text-slate-100'
                          : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-xs font-semibold">{copy.name}</span>
                      <span className="text-[11px] leading-snug text-slate-400">{copy.subtitle}</span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-sky-400">{preset.roomType}</span>
                        <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-300">
                          {copy.badge}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Calibration Anchor Controls */}
              <div className="flex flex-col gap-2 border-t border-slate-800 pt-3 text-xs">
                <div className="section-title">{t('app.calib.title')}</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={calibrationObject}
                    onChange={(e) => setCalibrationObject(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                  />
                  <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950 px-2">
                    <input
                      type="number"
                      value={calibrationCm}
                      onChange={(e) => setCalibrationCm(Number(e.target.value))}
                      className="w-12 bg-transparent text-right font-mono text-xs text-sky-300 focus:outline-none"
                    />
                    <span className="font-mono text-[10px] text-slate-500">cm</span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isCompiling || !uploadedPhoto}
                  title={uploadedPhoto ? undefined : t('app.btn.recompileHint')}
                  onClick={() => uploadedPhoto && compilePhoto(uploadedPhoto)}
                  className="btn-secondary w-full py-2"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isCompiling ? t('app.btn.compiling') : t('app.btn.recompile')}
                </button>
                {!uploadedPhoto && (
                  <p className="text-[11px] leading-snug text-slate-500">{t('app.btn.recompileHint')}</p>
                )}
              </div>
            </div>

            <EvidenceSidebar
              graph={roomGraph}
              filter={epistemicFilter}
              onFilter={setEpistemicFilter}
              filteredNodes={filteredNodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          </div>
        </aside>

        {/* CENTER: summary, spatial canvas, source photo, manifest */}
        <section className="order-1 flex min-w-0 flex-col gap-3 lg:order-2">
          {isCompiling && (
            <div className="rounded-xl border border-sky-400/40 bg-sky-950/40 p-3 text-xs text-sky-200">
              {t('app.compiling.note')}
            </div>
          )}
          {roomGraph.compileMeta.fallback && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-amber-500/50 bg-amber-950/60 p-3 text-xs text-amber-100"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="flex flex-col gap-0.5">
                <div className="font-semibold">{t('app.fallback.title')}</div>
                <div className="text-amber-200/90">
                  {t('app.fallback.body', {
                    stage: roomGraph.compileMeta.fallback.stage,
                    reason: roomGraph.compileMeta.fallback.reason,
                  })}
                </div>
              </div>
            </div>
          )}

          <KpiStrip graph={roomGraph} />

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

          <EvidencePhotoPanel
            graph={roomGraph}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            showBBoxOverlay={showBBoxOverlay}
            onToggleBBoxOverlay={() => setShowBBoxOverlay((v) => !v)}
          />

          <PartnerStackPanels
            graph={roomGraph}
            sentryStatus={sentryStatus}
            atlasGraphs={atlasGraphs}
            atlasSearchQuery={atlasSearchQuery}
            onChangeAtlasSearch={setAtlasSearchQuery}
            onLoadRoomGraph={(g) => {
              applyNewRoomGraph(g);
              showToast(t('app.toast.loaded', { title: g.title }));
            }}
            onSaveToAtlas={handleSaveToAtlas}
            savingAtlas={savingAtlas}
          />
        </section>

        {/* RIGHT: Scene Inspector and the moving what-if check */}
        <aside className="order-3 flex min-w-0 flex-col gap-3 lg:col-span-2 lg:grid lg:grid-cols-2 lg:items-start xl:col-span-1 xl:flex xl:items-stretch xl:sticky xl:top-14 xl:max-h-[calc(100vh-4.5rem)] xl:self-start xl:overflow-y-auto">
          <SceneInspector
            graph={roomGraph}
            node={selectedNode}
            onSelectNode={setSelectedNodeId}
            onRotateNode={handleRotateNode}
            onDeleteNode={handleDeleteNode}
          />

          <WhatIfSimulatorPanel
            graph={roomGraph}
            report={whatIfReport}
            doorWidthOverrideCm={doorWidthOverrideCm}
            onChangeDoorWidth={setDoorWidthOverrideCm}
            minWalkwayCm={minWalkwayCm}
            onChangeMinWalkway={setMinWalkwayCm}
            onSelectNode={(id) => setSelectedNodeId(id)}
            onResetLayout={() => {
              applyNewRoomGraph(baseGraph);
              showToast(t('app.toast.reset'));
            }}
          />
        </aside>
      </main>
    </div>
  );
}

export default App;
