import { z } from 'zod';

export const EpistemicStatusSchema = z.enum([
  'observed',       // Directly visible floor contact corners and unambiguous geometry in the photograph
  'inferred',       // Partially occluded or derived from perspective geometry and standard furniture priors
  'occluded_prior', // Camera blind spot — deduced from spatial context, cables, or room layout priors
]);

export type EpistemicStatus = z.infer<typeof EpistemicStatusSchema>;

export const ObjectCategorySchema = z.enum([
  'furniture',
  'appliance',
  'fixture',
  'opening',
  'obstacle',
]);

export type ObjectCategory = z.infer<typeof ObjectCategorySchema>;

export const BBox2DSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const FootprintSchema = z.object({
  xCm: z.number(),
  yCm: z.number(),
  widthCm: z.number().positive(),
  depthCm: z.number().positive(),
  heightCm: z.number().positive(),
  rotationDeg: z.number().default(0),
});

export const UncertaintyBandSchema = z.object({
  posPlusMinusCm: z.number().nonnegative(),
  dimPlusMinusCm: z.number().nonnegative(),
  reason: z.string(),
});

export const RoomObjectNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  labelKo: z.string(),
  category: ObjectCategorySchema,
  epistemic: EpistemicStatusSchema,
  confidence: z.number().min(0).max(1),
  evidenceSource: z.string(),
  // Where the object is in the source photo; null when unknown (e.g. a what-if injected item, or a
  // vision answer whose box was unusable) so nothing is drawn rather than a made-up box.
  bbox2d: BBox2DSchema.nullable(),
  footprint: FootprintSchema,
  uncertainty: UncertaintyBandSchema,
  movable: z.boolean(),
  weightKgEst: z.number().nonnegative(),
  disassemblyRequired: z.boolean().default(false),
  colorTag: z.string().optional(),
});

export type RoomObjectNode = z.infer<typeof RoomObjectNodeSchema>;

export const SpatialRelationTypeSchema = z.enum([
  'adjacent_to',
  'blocks_path',
  'on_top_of',
  'against_wall',
  'clearance_gap',
  'occludes',
  'power_tethered',
]);

export const SpatialRelationEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  relation: SpatialRelationTypeSchema,
  distanceCm: z.number(),
  uncertaintyCm: z.number().nonnegative(),
  epistemic: EpistemicStatusSchema,
  confidence: z.number().min(0).max(1),
  constraintNote: z.string(),
});

export type SpatialRelationEdge = z.infer<typeof SpatialRelationEdgeSchema>;

export const RoomOpeningSchema = z.object({
  id: z.string(),
  kind: z.enum(['entry_door', 'balcony_door', 'window', 'hallway_arch']),
  label: z.string(),
  wall: z.enum(['north', 'south', 'east', 'west']),
  offsetCm: z.number().nonnegative(),
  widthCm: z.number().positive(),
  heightCm: z.number().positive(),
  swingClearanceCm: z.number().nonnegative(),
  epistemic: EpistemicStatusSchema,
  confidence: z.number().min(0).max(1),
});

export type RoomOpening = z.infer<typeof RoomOpeningSchema>;

export const BlindSpotSchema = z.object({
  id: z.string(),
  regionDescription: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high']),
  recommendation: z.string(),
});

export const CalibrationAnchorSchema = z.object({
  referenceObject: z.string(),
  referenceDimensionCm: z.number().positive(),
  // null when the compiler did no pixel-level calibration (e.g. Gemma only estimates scale from the anchor).
  pixelToCmRatio: z.number().positive().nullable(),
  scaleConfidence: z.number().min(0).max(1),
  perspectiveTiltDeg: z.number(),
  method: z.string(),
});

// Why a compile did not produce a graph from the user's photo.
export const FallbackStageSchema = z.enum([
  'unsupported_image', // not png/jpeg/webp, so it cannot be sent to the vision model
  'unavailable', // Ollama endpoint unreachable
  'model_missing', // Ollama is up but the configured Gemma model is not pulled
  'timeout',
  'http_error',
  'invalid_json',
  'schema_invalid', // JSON parsed but no usable RoomGraph could be built from it
]);

export type FallbackStage = z.infer<typeof FallbackStageSchema>;

export const CompileTelemetrySchema = z.object({
  compileId: z.string(),
  timestamp: z.string(),
  model: z.string(),
  // ollama-<tag> / digitalocean-gradient-gemma3: graph came from a Gemma response. The Ollama form
  //   names the model that really answered (ollama-gemma3:4b, ollama-gemma4:e4b, ...).
  // fallback-preset: Gemma failed; the graph is a bundled sample NOT derived from the photo.
  // preset-sample: hand-authored sample room; no compile was run.
  runtime: z.union([
    z.enum(['digitalocean-gradient-gemma3', 'fallback-preset', 'preset-sample']),
    z.string().regex(/^ollama-[A-Za-z0-9._:\/-]+$/),
  ]),
  fallback: z.object({ stage: FallbackStageSchema, reason: z.string() }).optional(),
  latencyMs: z.number().nonnegative(),
  tokens: z.object({
    prompt: z.number().nonnegative(),
    completion: z.number().nonnegative(),
    total: z.number().nonnegative(),
  }),
  sentryTraceId: z.string(),
  sentrySpanId: z.string(),
  atlasDocumentId: z.string().optional(),
  atlasPersisted: z.boolean().default(false),
  spans: z.array(
    z.object({
      op: z.string(),
      description: z.string(),
      durationMs: z.number().nonnegative(),
      status: z.enum(['ok', 'degraded', 'fallback']),
      attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    })
  ),
});

export type CompileTelemetry = z.infer<typeof CompileTelemetrySchema>;

export const RoomGraphSchema = z.object({
  schemaVersion: z.literal('roomgraph.v1.2'),
  sceneId: z.string(),
  title: z.string(),
  sourcePhotoUrl: z.string(),
  compileMeta: CompileTelemetrySchema,
  calibration: CalibrationAnchorSchema,
  roomEnvelope: z.object({
    widthCm: z.number().positive(),
    depthCm: z.number().positive(),
    ceilingHeightCm: z.number().positive(),
    uncertaintyCm: z.number().nonnegative(),
    floorAreaSqm: z.number().positive(),
    openings: z.array(RoomOpeningSchema),
  }),
  nodes: z.array(RoomObjectNodeSchema),
  edges: z.array(SpatialRelationEdgeSchema),
  epistemicSummary: z.object({
    observedCount: z.number().nonnegative(),
    inferredCount: z.number().nonnegative(),
    occludedCount: z.number().nonnegative(),
    overallConfidence: z.number().min(0).max(1),
    blindSpots: z.array(BlindSpotSchema),
  }),
});

export type RoomGraph = z.infer<typeof RoomGraphSchema>;

// Downstream #1: Moving & Layout What-If Verification Result
export interface ConstraintViolation {
  id: string;
  severity: 'blocker' | 'uncertainty_warning' | 'ergonomic_notice';
  code:
    | 'DOOR_BOTTLENECK'
    | 'OBJECT_COLLISION'
    | 'OUT_OF_BOUNDS'
    | 'UNCERTAINTY_OVERFLOW'
    | 'DOOR_SWING_BLOCKED'
    | 'CORRIDOR_TOO_NARROW';
  title: string;
  detail: string;
  affectedNodeIds: string[];
  nominalPass: boolean;
  worstCasePass: boolean; // False when ±uncertaintyCm causes collision/failure
  marginCm: number;
}

export interface MovingWhatIfReport {
  feasibleNominal: boolean;
  feasibleWorstCase: boolean;
  confidenceAdjustedScore: number; // 0 - 100
  doorBottlenecks: {
    nodeId: string;
    label: string;
    minCrossSectionCm: number;
    doorWidthCm: number;
    uncertaintyCm: number;
    status: 'pass' | 'tight_uncertainty' | 'blocked';
    requiresDisassembly: boolean;
  }[];
  corridorClearances: {
    fromId: string;
    toId: string;
    nominalGapCm: number;
    worstCaseGapCm: number;
    minRequiredCm: number;
    status: 'pass' | 'uncertainty_risk' | 'blocked';
  }[];
  violations: ConstraintViolation[];
  // Field name is historical: the estimate is a rule-based formula, not TabPFN.
  tabpfnEstimate: {
    modelVersion: string;
    totalVolumeCbm: number;
    totalWeightKg: number;
    recommendedTruck: string;
    crewCount: number;
    estimatedDurationHours: number;
    estimatedCostKrw: { p10: number; p50: number; p90: number };
    estimatedCostUsd: { p10: number; p50: number; p90: number };
    riskPremiumReason: string;
  };
}
