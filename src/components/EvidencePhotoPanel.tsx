import React from 'react';
import type { RoomGraph, RoomObjectNode } from '../../shared/roomGraphSchema';
import { AlertTriangle, Compass, Eye, Info, Sparkles } from 'lucide-react';
import { boxesAreModelEstimates } from '../evidenceStyle';
import { useI18n, nodeLabel } from '../i18n';
import { useImageAspect } from '../imageUtils';
import { ToggleChip } from './ToggleChip';

// A tall photo is limited to this share of the viewport height; the frame narrows to keep its ratio.
const MAX_PHOTO_HEIGHT_VH = 70;

interface EvidencePhotoPanelProps {
  graph: RoomGraph;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  showBBoxOverlay: boolean;
  onToggleBBoxOverlay: () => void;
}

export const EvidencePhotoPanel: React.FC<EvidencePhotoPanelProps> = ({
  graph,
  selectedNodeId,
  onSelectNode,
  showBBoxOverlay,
  onToggleBBoxOverlay,
}) => {
  const { t, lang } = useI18n();
  const aspect = useImageAspect(graph.sourcePhotoUrl);
  // A compiled photo has no boxes at all (the model is not asked for them); only samples do.
  const hasBoxes = graph.nodes.some((n) => n.bbox2d);
  const modelBoxes = hasBoxes && boxesAreModelEstimates(graph);
  const badgeColor = (epistemic: RoomObjectNode['epistemic']) => {
    if (epistemic === 'observed') {
      return 'border-emerald-400 bg-emerald-500/20 text-emerald-200';
    }
    if (epistemic === 'inferred') {
      return 'border-amber-400 bg-amber-500/20 text-amber-200';
    }
    return 'border-orange-400 bg-orange-500/25 text-orange-200';
  };

  return (
    <div className="panel flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-slate-200">
            {t('evidence.title')}
          </span>
        </div>
        {hasBoxes && (
          <ToggleChip on={showBBoxOverlay} onClick={onToggleBBoxOverlay}>
            <Eye className="h-3.5 w-3.5" />
            {t('evidence.overlay')}
          </ToggleChip>
        )}
      </div>

      {!hasBoxes && (
        <div className="flex items-start gap-2 border-b border-slate-800 px-3.5 py-2 text-[11px] leading-snug text-slate-400">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          {t('evidence.noBoxes')}
        </div>
      )}

      {modelBoxes && (
        <div className="flex items-start gap-2 border-b border-slate-800 bg-amber-500/5 px-3.5 py-2 text-[11px] leading-snug text-amber-300/90">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          {t('evidence.boxesApprox')}
        </div>
      )}

      {/* The frame takes the photo's own aspect ratio, so the normalized boxes line up with it
          (cropping a portrait photo into a wide frame would shift every box). */}
      <div className="bg-slate-950">
        <div
          className="relative mx-auto overflow-hidden"
          style={{ aspectRatio: String(aspect), width: `min(100%, ${(MAX_PHOTO_HEIGHT_VH * aspect).toFixed(1)}vh)` }}
        >
        <img
          src={graph.sourcePhotoUrl}
          alt={graph.title}
          className="h-full w-full object-fill"
        />

        {showBBoxOverlay &&
          graph.nodes.map((node) => {
            const box = node.bbox2d;
            if (!box) return null;
            const isSelected = selectedNodeId === node.id;
            const left = `${box.x * 100}%`;
            const top = `${box.y * 100}%`;
            const width = `${box.w * 100}%`;
            const height = `${box.h * 100}%`;

            const borderStyle =
              node.epistemic === 'observed'
                ? 'border-emerald-400 border-solid'
                : node.epistemic === 'inferred'
                ? 'border-amber-400 border-dashed'
                : 'border-orange-400 border-dotted';

            return (
              <div
                key={node.id}
                onClick={() => onSelectNode(node.id)}
                style={{ left, top, width, height }}
                className={`absolute border-2 rounded-md transition-all cursor-pointer ${borderStyle} ${
                  isSelected
                    ? 'ring-2 ring-sky-400 bg-sky-500/15 z-20'
                    : 'bg-slate-950/15 hover:bg-slate-900/30 z-10'
                }`}
              >
                <div
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono whitespace-nowrap rounded shadow-sm border ${badgeColor(
                    node.epistemic
                  )}`}
                >
                  <span className="font-semibold">{nodeLabel(node, lang)}</span>
                  <span>{Math.round(node.confidence * 100)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calibration Anchor Summary */}
      <div className="px-3.5 py-2.5 bg-slate-900 border-t border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-300">
          <Compass className="w-4 h-4 text-sky-400 shrink-0" />
          <span>
            <strong className="text-slate-100">{t('evidence.scale')}</strong>{' '}
            {graph.calibration.referenceObject} ({graph.calibration.referenceDimensionCm}cm)
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
          <span>
            {t('evidence.pxcm')} {graph.calibration.pixelToCmRatio ?? t('evidence.na')}
          </span>
          <span>
            {t('evidence.tilt')} {graph.calibration.perspectiveTiltDeg}°
          </span>
          <span className="text-emerald-400">
            {t('evidence.scaleConf')} {Math.round(graph.calibration.scaleConfidence * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};
