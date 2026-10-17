import type { EpistemicStatus } from '../shared/roomGraphSchema';

// One place for the evidence colour language: observed = muted cyan, estimated = amber,
// low-confidence = muted orange. Errors use rose and are not part of this map.
export const EVIDENCE_STYLE: Record<
  EpistemicStatus,
  { dot: string; text: string; chip: string; bar: string }
> = {
  observed: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    chip: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
    bar: 'bg-emerald-400',
  },
  inferred: {
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    chip: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
    bar: 'bg-amber-400',
  },
  occluded_prior: {
    dot: 'bg-orange-400',
    text: 'text-orange-300',
    chip: 'border-orange-400/30 bg-orange-500/10 text-orange-300',
    bar: 'bg-orange-400',
  },
};
