import React from 'react';
import type { MovingWhatIfReport, RoomGraph } from '../../shared/roomGraphSchema';
import { useI18n } from '../i18n';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Truck,
  DoorClosed,
  Ruler,
  Sparkles,
} from 'lucide-react';

interface WhatIfSimulatorPanelProps {
  graph: RoomGraph;
  report: MovingWhatIfReport;
  doorWidthOverrideCm: number;
  onChangeDoorWidth: (cm: number) => void;
  minWalkwayCm: number;
  onChangeMinWalkway: (cm: number) => void;
  onSelectNode: (id: string) => void;
  onResetLayout: () => void;
}

export const WhatIfSimulatorPanel: React.FC<WhatIfSimulatorPanelProps> = ({
  report,
  doorWidthOverrideCm,
  onChangeDoorWidth,
  minWalkwayCm,
  onChangeMinWalkway,
  onSelectNode,
  onResetLayout,
}) => {
  const { t, lang } = useI18n();
  return (
    <div className="flex flex-col gap-3">
      {/* Top Status Banner */}
      <div className="panel flex flex-col gap-3 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-sky-400 font-mono">
              {t('whatif.kicker')}
            </div>
            <h3 className="text-sm font-bold text-slate-100 mt-0.5">
              {t('whatif.title')}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
              {t('whatif.score')}{' '}
              <span
                className={`font-bold ${
                  report.confidenceAdjustedScore >= 80
                    ? 'text-emerald-400'
                    : report.confidenceAdjustedScore >= 55
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {report.confidenceAdjustedScore}/100
              </span>
            </div>
            <button
              type="button"
              onClick={onResetLayout}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
            >
              {t('whatif.reset')}
            </button>
          </div>
        </div>

        {/* Nominal vs Worst-case Comparison Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div
            className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
              report.feasibleNominal
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/35 border-rose-500/45 text-rose-200'
            }`}
          >
            {report.feasibleNominal ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <div className="font-semibold">
                {t('whatif.nominal')}{' '}
                {report.feasibleNominal ? t('whatif.pass') : t('whatif.blocked')}
              </div>
              <div className="text-[11px] opacity-80 mt-0.5">
                {t('whatif.nominalDesc')}
              </div>
            </div>
          </div>

          <div
            className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
              report.feasibleWorstCase
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/35 border-amber-500/45 text-amber-200'
            }`}
          >
            {report.feasibleWorstCase ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <div className="font-semibold">
                {t('whatif.worst')}{' '}
                {report.feasibleWorstCase ? t('whatif.safe') : t('whatif.collision')}
              </div>
              <div className="text-[11px] opacity-80 mt-0.5">
                {t('whatif.worstDesc')}
              </div>
            </div>
          </div>
        </div>

        {/* Sliders for Door Width & Minimum Corridor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800/80 text-xs">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center gap-1">
                <DoorClosed className="w-3.5 h-3.5 text-sky-400" />
                {t('whatif.doorWidth')}
              </span>
              <span className="font-mono font-semibold text-sky-300">
                {doorWidthOverrideCm} cm
              </span>
            </div>
            <input
              type="range"
              min={68}
              max={105}
              value={doorWidthOverrideCm}
              onChange={(e) => onChangeDoorWidth(Number(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
            <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-[10px] text-slate-500 font-mono">
              <span>{t('whatif.door.walkup')}</span>
              <span>{t('whatif.door.standard')}</span>
              <span>{t('whatif.door.wide')}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center gap-1">
                <Ruler className="w-3.5 h-3.5 text-indigo-400" />
                {t('whatif.walkway')}
              </span>
              <span className="font-mono font-semibold text-indigo-300">
                {minWalkwayCm} cm
              </span>
            </div>
            <input
              type="range"
              min={40}
              max={85}
              value={minWalkwayCm}
              onChange={(e) => onChangeMinWalkway(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-[10px] text-slate-500 font-mono">
              <span>{t('whatif.walk.tight')}</span>
              <span>{t('whatif.walk.standard')}</span>
              <span>{t('whatif.walk.ada')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Violations & Epistemic Warnings List */}
      <div className="panel flex flex-col gap-2 p-3.5">
        <div className="flex items-center justify-between">
          <h4 className="panel-label">
            {t('whatif.alerts', { n: report.violations.length })}
          </h4>
          <span className="text-[11px] text-slate-400">{t('whatif.clickHighlight')}</span>
        </div>

        {report.violations.length === 0 ? (
          <div className="p-3 rounded-lg bg-emerald-950/25 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              {t('whatif.allPass')}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {report.violations.map((v) => {
              const isBlocker = v.severity === 'blocker';
              return (
                <div
                  key={v.id}
                  onClick={() => {
                    if (v.affectedNodeIds[0]) onSelectNode(v.affectedNodeIds[0]);
                  }}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                    isBlocker
                      ? 'bg-rose-950/35 border-rose-500/45 hover:bg-rose-950/55 text-rose-100'
                      : 'bg-amber-950/30 border-amber-500/40 hover:bg-amber-950/50 text-amber-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold flex items-center gap-1.5">
                      {isBlocker ? (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      {v.title}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-950/70 border border-slate-700">
                      {v.code}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-85 mt-1 leading-relaxed">{v.detail}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Door Bottleneck Matrix */}
      <div className="panel flex flex-col gap-2 p-3.5">
        <h4 className="panel-label">
          {t('whatif.matrix', { w: doorWidthOverrideCm })}
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <th className="py-1.5 pr-2">{t('whatif.th.object')}</th>
                <th className="py-1.5 px-2">{t('whatif.th.cross')}</th>
                <th className="py-1.5 px-2">{t('whatif.th.error')}</th>
                <th className="py-1.5 pl-2 text-right">{t('whatif.th.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {report.doorBottlenecks.map((d) => (
                <tr
                  key={d.nodeId}
                  onClick={() => onSelectNode(d.nodeId)}
                  className="hover:bg-slate-800/50 cursor-pointer"
                >
                  <td className="py-1.5 pr-2 font-medium text-slate-200">{d.label}</td>
                  <td className="py-1.5 px-2 font-mono text-slate-300">
                    {d.minCrossSectionCm} cm
                  </td>
                  <td className="py-1.5 px-2 font-mono text-amber-300">
                    ±{d.uncertaintyCm} cm
                  </td>
                  <td className="py-1.5 pl-2 text-right font-mono whitespace-nowrap">
                    {d.status === 'pass' && (
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                        {t('whatif.status.pass')}
                      </span>
                    )}
                    {d.status === 'tight_uncertainty' && (
                      <span className="inline-block px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                        {t('whatif.status.tight')}
                      </span>
                    )}
                    {d.status === 'blocked' && (
                      <span className="inline-block px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 whitespace-nowrap">
                        {t('whatif.status.blocked')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rule-based Moving Logistics & Cost Estimate Module */}
      <div className="panel flex flex-col gap-2.5 p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-indigo-200">
              {t('whatif.tabpfn.title')}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono text-[10px]">
            {t('whatif.tabpfn.partner')}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] text-slate-400">{t('whatif.tabpfn.volume')}</div>
            <div className="font-mono font-semibold text-slate-100 mt-0.5">
              {report.tabpfnEstimate.totalVolumeCbm} CBM · {report.tabpfnEstimate.totalWeightKg}kg
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] text-slate-400">{t('whatif.tabpfn.truck')}</div>
            <div className="font-semibold text-sky-300 mt-0.5">
              {report.tabpfnEstimate.recommendedTruck} {t('whatif.tabpfn.crew', { n: report.tabpfnEstimate.crewCount })}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] text-slate-400">{t('whatif.tabpfn.quote')}</div>
            <div className="font-mono font-semibold text-emerald-300 mt-0.5">
              ${report.tabpfnEstimate.estimatedCostUsd.p50}{' '}
              <span className="text-[10px] text-slate-400">
                (P90: ${report.tabpfnEstimate.estimatedCostUsd.p90})
              </span>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-indigo-200/85 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>{report.tabpfnEstimate.riskPremiumReason}</span>
        </div>
      </div>
    </div>
  );
};
