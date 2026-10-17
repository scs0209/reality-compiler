import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  ScanSearch,
  ShieldQuestion,
  XCircle,
} from 'lucide-react';
import type { EpistemicStatus, RoomGraph, RoomObjectNode } from '../../shared/roomGraphSchema';
import { EVIDENCE_STYLE } from '../evidenceStyle';
import { epistemicBadgeKey, nodeLabel, useI18n, type TranslationKey } from '../i18n';

export type EpistemicFilter = 'all' | EpistemicStatus;

interface EvidenceSidebarProps {
  graph: RoomGraph;
  filter: EpistemicFilter;
  onFilter: (f: EpistemicFilter) => void;
  filteredNodes: RoomObjectNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

const STAGE_KEY: Record<string, TranslationKey> = {
  'compiler.preflight': 'stage.preflight',
  'ai.run.gemma3': 'stage.inference',
  'compiler.assemble': 'stage.assemble',
  'db.mongodb.upsert': 'stage.save',
  'compiler.fallback_preset': 'stage.fallback',
};

const FILTERS: { id: EpistemicFilter; label: TranslationKey }[] = [
  { id: 'all', label: 'app.filter.all' },
  { id: 'observed', label: 'app.filter.obs' },
  { id: 'inferred', label: 'app.filter.inf' },
  { id: 'occluded_prior', label: 'app.filter.occ' },
];

// The lower sections of the "Source & Evidence" panel: objects, compile stages, unresolved items
// and the evidence legend. Everything shown here already exists in the RoomGraph.
export const EvidenceSidebar: React.FC<EvidenceSidebarProps> = ({
  graph,
  filter,
  onFilter,
  filteredNodes,
  selectedNodeId,
  onSelectNode,
}) => {
  const { t, lang } = useI18n();
  const spans = graph.compileMeta.spans;
  const blindSpots = graph.epistemicSummary.blindSpots;
  const occluded = graph.nodes.filter((n) => n.epistemic === 'occluded_prior');

  const countFor = (f: EpistemicFilter) =>
    f === 'all' ? graph.nodes.length : graph.nodes.filter((n) => n.epistemic === f).length;

  return (
    <>
      {/* Detected objects */}
      <div className="flex flex-col gap-2 p-3.5">
        <div className="section-title">
          <ScanSearch className="h-3.5 w-3.5" />
          {t('panel.objects', { n: graph.nodes.length })}
        </div>

        <div className="grid grid-cols-4 gap-1 text-[10px]">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const color =
              f.id === 'all' ? 'text-slate-100' : EVIDENCE_STYLE[f.id as EpistemicStatus].text;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onFilter(f.id)}
                aria-pressed={active}
                className={`rounded-md border px-1 py-1 font-medium transition ${
                  active
                    ? `border-slate-600 bg-slate-800 ${color}`
                    : 'border-slate-800 bg-slate-950/60 text-slate-500 hover:text-slate-300'
                }`}
              >
                {t(f.label, { n: countFor(f.id) })}
              </button>
            );
          })}
        </div>

        <ul className="-mx-1 flex max-h-72 flex-col overflow-y-auto pr-0.5">
          {filteredNodes.map((node) => {
            const selected = selectedNodeId === node.id;
            const style = EVIDENCE_STYLE[node.epistemic];
            return (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  aria-pressed={selected}
                  title={`${nodeLabel(node, lang)} · ${t(epistemicBadgeKey(node.epistemic))}`}
                  className={`flex w-full items-center gap-2 rounded-md border-l-2 px-2 py-1.5 text-left text-xs transition ${
                    selected
                      ? 'border-sky-400 bg-sky-400/10 text-slate-100'
                      : 'border-transparent text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
                  <span className="min-w-0 flex-1 truncate">{nodeLabel(node, lang)}</span>
                  <span className="hidden max-w-[5.5rem] truncate font-mono text-[10px] text-slate-500 2xl:inline">
                    {node.id}
                  </span>
                  <span className={`font-mono text-[11px] ${style.text}`}>
                    {Math.round(node.confidence * 100)}%
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Compile stages (the real spans of this compile) */}
      <div className="flex flex-col gap-2 p-3.5">
        <div className="section-title">
          <ListChecks className="h-3.5 w-3.5" />
          {t('panel.stages')}
        </div>
        {spans.length === 0 ? (
          <p className="text-[11px] leading-snug text-slate-400">{t('stage.none')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {spans.map((span, i) => (
              <li key={`${span.op}-${i}`} className="flex items-center gap-2 text-xs text-slate-300">
                {span.status === 'ok' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : span.status === 'degraded' ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                )}
                <span className="min-w-0 flex-1 truncate">
                  {STAGE_KEY[span.op] ? t(STAGE_KEY[span.op]) : span.op}
                </span>
                <span className="font-mono text-[10px] text-slate-500">{span.durationMs} ms</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Unresolved observations */}
      <div className="flex flex-col gap-2 p-3.5">
        <div className="section-title">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-amber-300">{t('panel.unresolved')}</span>
        </div>
        {blindSpots.length === 0 && occluded.length === 0 ? (
          <p className="text-[11px] text-slate-400">{t('unresolved.none')}</p>
        ) : (
          <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto pr-0.5">
            {blindSpots.map((b) => (
              <li key={b.id} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300">
                <ShieldQuestion
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                    b.riskLevel === 'high'
                      ? 'text-rose-400'
                      : b.riskLevel === 'medium'
                        ? 'text-amber-400'
                        : 'text-slate-500'
                  }`}
                />
                <span>
                  {b.regionDescription} <span className="font-mono text-slate-500">({b.riskLevel})</span>
                </span>
              </li>
            ))}
            {occluded.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onSelectNode(n.id)}
                  className="flex items-start gap-1.5 text-left text-[11px] leading-snug text-orange-300 hover:text-orange-200"
                >
                  <i className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  <span>
                    {nodeLabel(n, lang)} <span className="font-mono text-slate-500">({t('badge.occluded')})</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Evidence status legend */}
      <div className="flex flex-col gap-2 p-3.5">
        <div className="section-title">
          <i className="h-2 w-2 rounded-full bg-sky-400" />
          {t('panel.legend')}
        </div>
        <ul className="flex flex-col gap-1.5 text-[11px]">
          {(
            [
              ['observed', 'legend.observed'],
              ['inferred', 'legend.inferred'],
              ['occluded_prior', 'legend.occluded'],
            ] as [EpistemicStatus, TranslationKey][]
          ).map(([status, desc]) => (
            <li key={status} className="flex items-center gap-2">
              <i className={`h-2 w-2 shrink-0 rounded-full ${EVIDENCE_STYLE[status].dot}`} />
              <span className={`font-medium ${EVIDENCE_STYLE[status].text}`}>
                {t(epistemicBadgeKey(status))}
              </span>
              <span className="text-slate-500">{t(desc)}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};
