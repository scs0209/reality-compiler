import type { EpistemicStatus, RoomGraph } from '../shared/roomGraphSchema';

// The photo boxes of a compiled graph are the vision model's own guess. The small local model
// often places them far from the object, so the UI hides them by default and says they are rough.
// Boxes of the bundled samples are hand-authored and can be trusted.
export const boxesAreModelEstimates = (graph: Pick<RoomGraph, 'compileMeta'>): boolean =>
  graph.compileMeta.runtime === 'ollama-gemma3:4b' ||
  graph.compileMeta.runtime === 'digitalocean-gradient-gemma3';

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
