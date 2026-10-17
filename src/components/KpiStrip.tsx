import React, { useMemo } from 'react';
import { Box, Link2, ShieldCheck } from 'lucide-react';
import type { RoomGraph } from '../../shared/roomGraphSchema';
import { useI18n } from '../i18n';

interface KpiStripProps {
  graph: RoomGraph;
}

const pct = (n: number, total: number) => (total === 0 ? 0 : (n / total) * 100);

const IconTile: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-sky-400/30 bg-slate-950 text-sky-300 shadow-[0_0_14px_rgba(34,211,238,0.10)] sm:flex">
    {children}
  </div>
);

// Three readouts derived live from the graph, so they follow edits and removals.
export const KpiStrip: React.FC<KpiStripProps> = ({ graph }) => {
  const { t } = useI18n();

  const stats = useMemo(() => {
    const total = graph.nodes.length;
    const observed = graph.nodes.filter((n) => n.epistemic === 'observed').length;
    const inferred = graph.nodes.filter((n) => n.epistemic === 'inferred').length;
    const occluded = graph.nodes.filter((n) => n.epistemic === 'occluded_prior').length;
    const meanConfidence =
      total === 0 ? 0 : graph.nodes.reduce((acc, n) => acc + n.confidence, 0) / total;

    const byRelation = new Map<string, number>();
    for (const edge of graph.edges) {
      byRelation.set(edge.relation, (byRelation.get(edge.relation) ?? 0) + 1);
    }
    const topRelations = [...byRelation.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);

    return { total, observed, inferred, occluded, meanConfidence, topRelations };
  }, [graph.nodes, graph.edges]);

  const confidencePct = Math.round(stats.meanConfidence * 100);
  const unresolved = stats.inferred + stats.occluded;

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Scene summary">
      {/* Objects detected */}
      <div className="panel flex min-w-0 items-center gap-3 px-2.5 py-2.5 sm:px-3.5">
        <IconTile>
          <Box className="h-5 w-5" />
        </IconTile>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="text-xs font-medium leading-tight text-sky-300/90">{t('kpi.objects')}</div>
          <div className="flex items-end justify-between gap-3">
            <span className="font-mono text-xl font-semibold leading-none text-slate-100 sm:text-2xl">
              {stats.total}
            </span>
            <span className="hidden items-center gap-2 font-mono text-[10px] text-slate-400 sm:flex">
              <span className="flex items-center gap-1">
                <i className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {stats.observed}
              </span>
              <span className="flex items-center gap-1">
                <i className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {stats.inferred}
              </span>
              <span className="flex items-center gap-1">
                <i className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                {stats.occluded}
              </span>
            </span>
          </div>
          <div
            className="flex h-1 overflow-hidden rounded-full bg-slate-800"
            title={`${t('badge.observed')} ${stats.observed} · ${t('badge.inferred')} ${stats.inferred} · ${t('badge.occluded')} ${stats.occluded}`}
          >
            <div className="bg-emerald-400" style={{ width: `${pct(stats.observed, stats.total)}%` }} />
            <div className="bg-amber-400" style={{ width: `${pct(stats.inferred, stats.total)}%` }} />
            <div className="bg-orange-400" style={{ width: `${pct(stats.occluded, stats.total)}%` }} />
          </div>
        </div>
      </div>

      {/* Spatial relationships */}
      <div className="panel flex min-w-0 items-center gap-3 px-2.5 py-2.5 sm:px-3.5">
        <IconTile>
          <Link2 className="h-5 w-5" />
        </IconTile>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="text-xs font-medium leading-tight text-sky-300/90">{t('kpi.relations')}</div>
          <div className="flex items-end justify-between gap-3">
            <span className="font-mono text-xl font-semibold leading-none text-slate-100 sm:text-2xl">
              {graph.edges.length}
            </span>
            <span className="hidden min-w-0 truncate font-mono text-[10px] text-slate-400 sm:inline">
              {stats.topRelations.length === 0
                ? t('kpi.relations.none')
                : stats.topRelations.map(([type, n]) => `${type} ${n}`).join(' · ')}
            </span>
          </div>
          <div className="h-1 rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-400"
              style={{ width: `${Math.min(100, graph.edges.length * 6)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Model confidence (self-reported) and unresolved objects */}
      <div
        className="panel flex min-w-0 items-center gap-3 px-2.5 py-2.5 sm:px-3.5"
        title={t('kpi.confidence.note')}
      >
        <IconTile>
          <ShieldCheck className="h-5 w-5" />
        </IconTile>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="text-xs font-medium leading-tight text-sky-300/90">{t('kpi.confidence')}</div>
          <div className="flex flex-col gap-1">
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-xl font-semibold leading-none text-slate-100 sm:text-2xl">
                {confidencePct}%
              </span>
              <span className="truncate font-mono text-[10px] text-slate-500">{t('kpi.confidence.short')}</span>
            </span>
            <span className="hidden truncate font-mono text-[10px] text-amber-300 sm:block">
              {t('kpi.unresolved', { n: unresolved })}
            </span>
          </div>
          <div className="h-1 rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-sky-400" style={{ width: `${confidencePct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};
