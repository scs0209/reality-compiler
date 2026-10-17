import React, { useMemo, useState } from 'react';
import {
  Armchair,
  ArrowLeft,
  ArrowRight,
  Box,
  Crosshair,
  DoorOpen,
  Lamp,
  MousePointerClick,
  Plug,
  RotateCw,
  Trash2,
} from 'lucide-react';
import type { ObjectCategory, RoomGraph, RoomObjectNode } from '../../shared/roomGraphSchema';
import { EVIDENCE_STYLE, boxesAreModelEstimates } from '../evidenceStyle';
import { epistemicBadgeKey, nodeLabel, useI18n } from '../i18n';
import { useImageAspect } from '../imageUtils';

interface SceneInspectorProps {
  graph: RoomGraph;
  node: RoomObjectNode | null;
  onSelectNode: (id: string) => void;
  onRotateNode: (id: string) => void;
  onDeleteNode: (id: string) => void;
}

type Tab = 'props' | 'relations' | 'evidence' | 'data';

const CATEGORY_ICON: Record<ObjectCategory, React.ComponentType<{ className?: string }>> = {
  furniture: Armchair,
  appliance: Plug,
  fixture: Lamp,
  opening: DoorOpen,
  obstacle: Box,
};

const TABS: { id: Tab; label: 'insp.tab.props' | 'insp.tab.relations' | 'insp.tab.evidence' | 'insp.tab.data' }[] =
  [
    { id: 'props', label: 'insp.tab.props' },
    { id: 'relations', label: 'insp.tab.relations' },
    { id: 'evidence', label: 'insp.tab.evidence' },
    { id: 'data', label: 'insp.tab.data' },
  ];

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 text-xs">
    <span className="shrink-0 text-slate-400">{label}</span>
    <span className="min-w-0 text-right font-mono text-slate-100">{children}</span>
  </div>
);

// Read-only view of one object. Editing still happens on the canvas (drag, rotate 90 degrees) and
// in the what-if panel; this panel only shows what the RoomGraph says about the selection.
export const SceneInspector: React.FC<SceneInspectorProps> = ({
  graph,
  node,
  onSelectNode,
  onRotateNode,
  onDeleteNode,
}) => {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>('props');
  const photoAspect = useImageAspect(graph.sourcePhotoUrl);

  const relations = useMemo(
    () =>
      node ? graph.edges.filter((e) => e.from === node.id || e.to === node.id) : [],
    [graph.edges, node]
  );

  const header = (
    <div className="panel-title">
      <Crosshair className="h-4 w-4 text-sky-400" />
      {t('panel.inspector')}
    </div>
  );

  if (!node) {
    return (
      <div className="panel flex flex-col gap-3 p-3.5">
        {header}
        <div className="flex items-start gap-2 rounded-md border border-dashed border-slate-700 p-3 text-xs text-slate-400">
          <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          {t('insp.empty')}
        </div>
      </div>
    );
  }

  const style = EVIDENCE_STYLE[node.epistemic];
  const Icon = CATEGORY_ICON[node.category] ?? Box;
  const box = node.bbox2d;
  const labelOf = (id: string) => {
    const other = graph.nodes.find((n) => n.id === id);
    return other ? nodeLabel(other, lang) : id;
  };

  return (
    <div className="panel flex flex-col gap-3 p-3.5">
      {header}

      {/* Selected object */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-sky-400/30 bg-slate-950 text-sky-300 shadow-[0_0_14px_rgba(34,211,238,0.10)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-100" title={nodeLabel(node, lang)}>
            {nodeLabel(node, lang)}
          </div>
          <div className="truncate font-mono text-[10px] text-slate-500" title={node.id}>
            {node.id}
          </div>
          <div className={`mt-0.5 flex items-center gap-1.5 text-[11px] font-medium ${style.text}`}>
            <i className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
            {t(epistemicBadgeKey(node.epistemic))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onRotateNode(node.id)}
            className="btn-secondary px-2"
            title={t('app.rotateTitle')}
            aria-label={t('app.rotateTitle')}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteNode(node.id)}
            className="inline-flex items-center justify-center rounded-lg border border-rose-500/30 bg-rose-950/50 px-2 py-1 text-rose-300 transition hover:bg-rose-900/60"
            title={t('app.removeTitle')}
            aria-label={t('app.removeTitle')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="-mx-1 flex border-b border-slate-800 px-1 text-xs">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            role="tab"
            aria-selected={tab === tb.id}
            onClick={() => setTab(tb.id)}
            className={`-mb-px border-b-2 px-2.5 py-1.5 font-medium transition ${
              tab === tb.id
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t(tb.label)}
          </button>
        ))}
      </div>

      {tab === 'props' && (
        <div className="flex flex-col gap-2.5">
          <Row label={t('insp.category')}>{node.category}</Row>
          <Row label={t('insp.position')}>
            x {node.footprint.xCm} · y {node.footprint.yCm}
          </Row>
          <Row label={t('insp.rotation')}>{node.footprint.rotationDeg}°</Row>
          <Row label={t('insp.dimensions')}>
            {node.footprint.widthCm} × {node.footprint.depthCm} × {node.footprint.heightCm}
          </Row>
          <Row label={t('insp.confidence')}>
            <span className="flex items-center justify-end gap-2">
              <span className="h-1 w-16 overflow-hidden rounded-full bg-slate-800">
                <span
                  className={`block h-full rounded-full ${style.bar}`}
                  style={{ width: `${Math.round(node.confidence * 100)}%` }}
                />
              </span>
              {Math.round(node.confidence * 100)}%
            </span>
          </Row>
          <Row label={t('insp.status')}>
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] ${style.chip}`}>
              {t(epistemicBadgeKey(node.epistemic))}
            </span>
          </Row>
          <Row label={t('insp.uncertainty')}>
            {t('insp.uncertainty.value', {
              pos: node.uncertainty.posPlusMinusCm,
              dim: node.uncertainty.dimPlusMinusCm,
            })}
          </Row>
          <p className="rounded-md bg-slate-950/60 p-2 text-[11px] leading-snug text-slate-400">
            {node.uncertainty.reason}
          </p>
          <Row label={t('insp.movable')}>{node.movable ? t('insp.yes') : t('insp.no')}</Row>
          <Row label={t('insp.weight')}>{node.weightKgEst} kg</Row>
          <Row label={t('insp.disassembly')}>
            {node.disassemblyRequired ? t('insp.yes') : t('insp.no')}
          </Row>
        </div>
      )}

      {tab === 'relations' && (
        <div className="flex flex-col gap-2">
          <div className="section-title">{t('insp.relations.title', { n: relations.length })}</div>
          {relations.length === 0 ? (
            <p className="text-[11px] text-slate-400">{t('insp.relations.none')}</p>
          ) : (
            <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-0.5">
              {relations.map((e) => {
                const outgoing = e.from === node.id;
                const otherId = outgoing ? e.to : e.from;
                const EdgeArrow = outgoing ? ArrowRight : ArrowLeft;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onSelectNode(otherId)}
                      className="flex w-full flex-col gap-0.5 rounded-md border border-slate-800 bg-slate-950/50 p-2 text-left transition hover:border-slate-600"
                    >
                      <span className="flex items-center gap-1.5 text-xs text-slate-100">
                        <span className="font-mono text-[10px] text-indigo-300">{e.relation}</span>
                        <EdgeArrow className="h-3 w-3 shrink-0 text-slate-500" />
                        <span className="min-w-0 flex-1 truncate">{labelOf(otherId)}</span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {Math.round(e.confidence * 100)}%
                        </span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {e.distanceCm} ± {e.uncertaintyCm} cm
                      </span>
                      {e.constraintNote && (
                        <span className="text-[10px] leading-snug text-slate-500">{e.constraintNote}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === 'evidence' && (
        <div className="flex flex-col gap-3">
          <div>
            <div className="section-title mb-1">{t('insp.evidence.source')}</div>
            <p className="text-[11px] leading-snug text-slate-300">{node.evidenceSource}</p>
          </div>
          <div>
            <div className="section-title mb-1.5">{t('insp.evidence.region')}</div>
            {box ? (
              <div className="flex flex-col gap-1.5">
                {/* Crop of the source photo around the object's box. The photo is laid out in its
                    own aspect ratio (the same frame the overlay panel uses), so the crop is exact. */}
                <div
                  className="relative w-full max-w-[16rem] overflow-hidden rounded-md border border-slate-700 bg-slate-950"
                  style={{ aspectRatio: `${box.w * photoAspect} / ${box.h}` }}
                >
                  <img
                    src={graph.sourcePhotoUrl}
                    alt=""
                    className="absolute max-w-none object-fill"
                    style={{
                      width: `${100 / box.w}%`,
                      height: `${100 / box.h}%`,
                      left: `${(-box.x / box.w) * 100}%`,
                      top: `${(-box.y / box.h) * 100}%`,
                    }}
                  />
                </div>
                <span className="font-mono text-[10px] text-slate-500">
                  {t('insp.evidence.box', {
                    x: Math.round(box.x * 100),
                    y: Math.round(box.y * 100),
                    w: Math.round(box.w * 100),
                    h: Math.round(box.h * 100),
                  })}
                </span>
                {boxesAreModelEstimates(graph) && (
                  <span className="text-[10px] leading-snug text-amber-300/90">{t('evidence.boxesApprox')}</span>
                )}
              </div>
            ) : (
              <p className="text-[11px] leading-snug text-slate-400">{t('insp.evidence.noRegion')}</p>
            )}
          </div>
        </div>
      )}

      {tab === 'data' && (
        <pre className="max-h-72 overflow-auto rounded-md border border-slate-800 bg-slate-950 p-2.5 font-mono text-[10px] leading-relaxed text-slate-300">
          {JSON.stringify(node, null, 2)}
        </pre>
      )}
    </div>
  );
};
