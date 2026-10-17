import { z } from 'zod';
import {
  EpistemicStatusSchema,
  ObjectCategorySchema,
  type EpistemicStatus,
  type RoomGraph,
  type RoomObjectNode,
  type RoomOpening,
  type SpatialRelationEdge,
} from '../shared/roomGraphSchema';

// What Gemma is asked to produce. Smaller than RoomGraph on purpose: ids, edges, counts and the
// calibration envelope are derived deterministically below instead of trusting a 4B model with them.

export const GEMMA_MAX_OBJECTS = 14;
const GEMMA_MAX_OPENINGS = 6;
const GEMMA_MAX_BLIND_SPOTS = 4;

const WALLS = ['north', 'south', 'east', 'west'] as const;
const OPENING_KINDS = ['entry_door', 'balcony_door', 'window', 'hallway_arch'] as const;
const CATEGORIES = ['furniture', 'appliance', 'fixture', 'opening', 'obstacle'] as const;
const EPISTEMIC = ['observed', 'inferred', 'occluded_prior'] as const;
const RISK_LEVELS = ['low', 'medium', 'high'] as const;

const num = z.number().finite();

const GemmaRoomSchema = z.object({
  widthCm: num.min(100).max(3000),
  depthCm: num.min(100).max(3000),
  ceilingHeightCm: num.min(180).max(600),
  uncertaintyCm: num.nonnegative().max(500),
  scaleConfidence: num,
  perspectiveTiltDeg: num,
});

const GemmaObjectSchema = z.object({
  label: z.string().trim().min(1).max(80),
  labelKo: z.string().trim().max(80).optional(),
  category: ObjectCategorySchema,
  epistemic: EpistemicStatusSchema,
  confidence: num,
  evidence: z.string().trim().max(300),
  // Corners in thousandths of the photo (0,0 = top-left); converted to a normalised box below.
  bbox2d: z.object({ x1: num, y1: num, x2: num, y2: num }),
  footprint: z.object({
    xCm: num,
    yCm: num,
    widthCm: num.positive(),
    depthCm: num.positive(),
    heightCm: num.positive(),
    rotationDeg: num.optional(),
  }),
  uncertainty: z.object({
    posPlusMinusCm: num.nonnegative(),
    dimPlusMinusCm: num.nonnegative(),
    reason: z.string().trim().max(300),
  }),
  movable: z.boolean(),
  weightKgEst: num.nonnegative(),
  disassemblyRequired: z.boolean(),
});

const GemmaOpeningSchema = z.object({
  kind: z.enum(OPENING_KINDS),
  label: z.string().trim().min(1).max(80),
  wall: z.enum(WALLS),
  offsetCm: num.nonnegative(),
  widthCm: num.positive(),
  heightCm: num.positive(),
  epistemic: EpistemicStatusSchema,
  confidence: num,
});

const GemmaBlindSpotSchema = z.object({
  regionDescription: z.string().trim().min(1).max(300),
  riskLevel: z.enum(RISK_LEVELS),
  recommendation: z.string().trim().max(300),
});

// Objects/openings/blind spots are validated one by one so a single bad entry is dropped (and
// counted) instead of discarding the whole answer. The room envelope is mandatory.
const GemmaSceneEnvelopeSchema = z.object({
  room: GemmaRoomSchema,
  objects: z.array(z.unknown()),
  openings: z.array(z.unknown()).default([]),
  blindSpots: z.array(z.unknown()).default([]),
});

type BBox = { x: number; y: number; w: number; h: number };
// A validated object with its photo box already converted to a normalised box (or null).
type GemmaObject = Omit<z.infer<typeof GemmaObjectSchema>, 'bbox2d'> & { bbox2d: BBox | null };
type GemmaOpening = z.infer<typeof GemmaOpeningSchema>;
type GemmaBlindSpot = z.infer<typeof GemmaBlindSpotSchema>;

export interface GemmaScene {
  room: z.infer<typeof GemmaRoomSchema>;
  objects: GemmaObject[];
  openings: GemmaOpening[];
  blindSpots: GemmaBlindSpot[];
}

export interface GemmaParseStats {
  objectsReturned: number;
  objectsKept: number;
  openingsReturned: number;
  openingsKept: number;
  // Out-of-range bbox/confidence values that were clamped into range.
  fieldsNormalized: number;
  // Objects kept without a photo box because the model's box was unusable.
  bboxMissing: number;
  // Objects whose footprint sticks out of the room the model itself reported (kept; the what-if
  // engine flags them as OUT_OF_BOUNDS, and the count shows how far to trust the geometry).
  outOfRoom: number;
  // Objects whose confidence was lowered because it overclaimed for their epistemic status.
  confidenceCapped: number;
  // First few reasons objects were rejected (field path + message), for retries and traces.
  droppedReasons: string[];
}

const CONFIDENCE_CAP: Record<EpistemicStatus, number> = {
  observed: 1,
  inferred: 0.85,
  occluded_prior: 0.6,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function parseGemmaScene(raw: unknown): { scene: GemmaScene; stats: GemmaParseStats } {
  const envelope = GemmaSceneEnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    throw new Error(`room/objects missing or invalid: ${summarizeZodError(envelope.error)}`);
  }

  const stats: GemmaParseStats = {
    objectsReturned: envelope.data.objects.length,
    objectsKept: 0,
    openingsReturned: envelope.data.openings.length,
    openingsKept: 0,
    fieldsNormalized: 0,
    bboxMissing: 0,
    outOfRoom: 0,
    confidenceCapped: 0,
    droppedReasons: [],
  };
  const reject = (index: number, why: string) => {
    if (stats.droppedReasons.length < 3) stats.droppedReasons.push(`objects[${index}] ${why}`);
  };

  const objects: GemmaObject[] = [];
  for (const [index, item] of envelope.data.objects.slice(0, GEMMA_MAX_OBJECTS).entries()) {
    const parsed = GemmaObjectSchema.safeParse(item);
    if (!parsed.success) {
      reject(index, summarizeZodError(parsed.error, 2));
      continue;
    }
    const o = parsed.data;

    // The footprint is what the what-if engine uses, so an unusable photo box does not cost the
    // object: it is kept with bbox2d = null and counted.
    const { x1, y1, x2, y2 } = o.bbox2d;
    const box = {
      x: clamp(x1, 0, 1000) / 1000,
      y: clamp(y1, 0, 1000) / 1000,
      w: (clamp(x2, 0, 1000) - clamp(x1, 0, 1000)) / 1000,
      h: (clamp(y2, 0, 1000) - clamp(y1, 0, 1000)) / 1000,
    };
    let bbox2d: BBox | null = box.w > 0 && box.h > 0 ? box : null;
    if (bbox2d === null) {
      stats.bboxMissing += 1;
    } else if (x1 < 0 || y1 < 0 || x2 > 1000 || y2 > 1000) {
      stats.fieldsNormalized += 1;
    }

    let confidence = clamp(o.confidence, 0, 1);
    if (confidence !== o.confidence) stats.fieldsNormalized += 1;
    if (confidence > CONFIDENCE_CAP[o.epistemic]) {
      confidence = CONFIDENCE_CAP[o.epistemic];
      stats.confidenceCapped += 1;
    }

    const f = o.footprint;
    const rotated = Math.abs((f.rotationDeg ?? 0) % 180) === 90;
    const fw = rotated ? f.depthCm : f.widthCm;
    const fd = rotated ? f.widthCm : f.depthCm;
    if (
      f.xCm < 0 ||
      f.yCm < 0 ||
      f.xCm + fw > envelope.data.room.widthCm ||
      f.yCm + fd > envelope.data.room.depthCm
    ) {
      stats.outOfRoom += 1;
    }

    objects.push({ ...o, bbox2d, confidence });
  }
  if (objects.length === 0) {
    throw new Error(
      `no usable objects (${stats.objectsReturned} returned, all failed validation: ${stats.droppedReasons.join('; ') || 'none returned'})`
    );
  }
  stats.objectsKept = objects.length;

  const openings: GemmaOpening[] = [];
  for (const item of envelope.data.openings.slice(0, GEMMA_MAX_OPENINGS)) {
    const parsed = GemmaOpeningSchema.safeParse(item);
    if (parsed.success) {
      openings.push({ ...parsed.data, confidence: clamp(parsed.data.confidence, 0, 1) });
    }
  }
  stats.openingsKept = openings.length;

  const blindSpots: GemmaBlindSpot[] = [];
  for (const item of envelope.data.blindSpots.slice(0, GEMMA_MAX_BLIND_SPOTS)) {
    const parsed = GemmaBlindSpotSchema.safeParse(item);
    if (parsed.success) blindSpots.push(parsed.data);
  }

  return { scene: { room: envelope.data.room, objects, openings, blindSpots }, stats };
}

function summarizeZodError(err: z.ZodError, maxIssues = 4): string {
  return err.issues
    .slice(0, maxIssues)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
}

const COLOR_BY_EPISTEMIC: Record<EpistemicStatus, string> = {
  observed: '#5BB8C9',
  inferred: '#FBBF24',
  occluded_prior: '#DE8B4D',
};

const EDGE_MAX_GAP_CM = 80;
const EDGE_MAX_COUNT = 40;

const round = (v: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'object';

export interface AssembleContext {
  sceneId: string;
  title: string;
  sourcePhotoUrl: string;
  referenceObject: string;
  referenceDimensionCm: number;
}

export function assembleRoomGraph(
  scene: GemmaScene,
  ctx: AssembleContext
): Omit<RoomGraph, 'compileMeta'> {
  const nodes: RoomObjectNode[] = scene.objects.map((o, idx) => ({
    id: `obj-${idx + 1}-${slug(o.label)}`,
    label: o.label,
    labelKo: o.labelKo || o.label,
    category: o.category,
    epistemic: o.epistemic,
    confidence: round(o.confidence, 2),
    evidenceSource: o.evidence || 'Gemma 3 vision estimate',
    bbox2d: o.bbox2d,
    footprint: {
      xCm: round(o.footprint.xCm),
      yCm: round(o.footprint.yCm),
      widthCm: round(o.footprint.widthCm),
      depthCm: round(o.footprint.depthCm),
      heightCm: round(o.footprint.heightCm),
      // The what-if engine only understands quarter turns.
      rotationDeg: Math.round((o.footprint.rotationDeg ?? 0) / 90) * 90,
    },
    uncertainty: {
      posPlusMinusCm: round(o.uncertainty.posPlusMinusCm, 1),
      dimPlusMinusCm: round(o.uncertainty.dimPlusMinusCm, 1),
      reason: o.uncertainty.reason || 'Gemma-estimated band',
    },
    movable: o.movable,
    weightKgEst: round(o.weightKgEst),
    disassemblyRequired: o.disassemblyRequired,
    colorTag: COLOR_BY_EPISTEMIC[o.epistemic],
  }));

  const openings: RoomOpening[] = scene.openings.map((o, idx) => ({
    id: `open-${idx + 1}-${o.kind}`,
    kind: o.kind,
    label: o.label,
    wall: o.wall,
    offsetCm: round(o.offsetCm),
    widthCm: round(o.widthCm),
    heightCm: round(o.heightCm),
    // Assumption, not an observation: doors swing open by about their own width.
    swingClearanceCm: o.kind === 'entry_door' || o.kind === 'balcony_door' ? round(o.widthCm) : 0,
    epistemic: o.epistemic,
    confidence: round(o.confidence, 2),
  }));

  const count = (status: EpistemicStatus) => nodes.filter((n) => n.epistemic === status).length;
  const meanConfidence = nodes.reduce((acc, n) => acc + n.confidence, 0) / nodes.length;

  return {
    schemaVersion: 'roomgraph.v1.2',
    sceneId: ctx.sceneId,
    title: ctx.title,
    sourcePhotoUrl: ctx.sourcePhotoUrl,
    calibration: {
      referenceObject: ctx.referenceObject,
      referenceDimensionCm: ctx.referenceDimensionCm,
      pixelToCmRatio: null,
      scaleConfidence: round(clamp(scene.room.scaleConfidence, 0, 1), 2),
      perspectiveTiltDeg: round(clamp(scene.room.perspectiveTiltDeg, -45, 45), 1),
      method: 'Scale and tilt estimated by gemma3 from the reference object (no pixel-level calibration)',
    },
    roomEnvelope: {
      widthCm: round(scene.room.widthCm),
      depthCm: round(scene.room.depthCm),
      ceilingHeightCm: round(scene.room.ceilingHeightCm),
      uncertaintyCm: round(scene.room.uncertaintyCm, 1),
      floorAreaSqm: round((scene.room.widthCm * scene.room.depthCm) / 10_000, 2),
      openings,
    },
    nodes,
    edges: deriveEdges(nodes),
    epistemicSummary: {
      observedCount: count('observed'),
      inferredCount: count('inferred'),
      occludedCount: count('occluded_prior'),
      overallConfidence: round(meanConfidence, 2),
      blindSpots: scene.blindSpots.map((b, idx) => ({ id: `blind-${idx + 1}`, ...b })),
    },
  };
}

const EPISTEMIC_RANK: Record<EpistemicStatus, number> = {
  observed: 0,
  inferred: 1,
  occluded_prior: 2,
};

// Relations come from footprint geometry, not from the model, so they are only as good as the
// footprints and carry the summed position uncertainty of the two objects.
export function deriveEdges(nodes: RoomObjectNode[]): SpatialRelationEdge[] {
  const rect = (n: RoomObjectNode) => {
    const rotated = Math.abs(n.footprint.rotationDeg % 180) === 90;
    const w = rotated ? n.footprint.depthCm : n.footprint.widthCm;
    const d = rotated ? n.footprint.widthCm : n.footprint.depthCm;
    return { x1: n.footprint.xCm, y1: n.footprint.yCm, x2: n.footprint.xCm + w, y2: n.footprint.yCm + d };
  };

  const edges: SpatialRelationEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const ra = rect(a);
      const rb = rect(b);
      const gapX = Math.max(rb.x1 - ra.x2, ra.x1 - rb.x2, 0);
      const gapY = Math.max(rb.y1 - ra.y2, ra.y1 - rb.y2, 0);
      const gap = Math.hypot(gapX, gapY);
      if (gap > EDGE_MAX_GAP_CM) continue;

      const overlap = gapX === 0 && gapY === 0;
      const epistemic =
        EPISTEMIC_RANK[a.epistemic] >= EPISTEMIC_RANK[b.epistemic] ? a.epistemic : b.epistemic;
      edges.push({
        id: `edge-${a.id}-${b.id}`,
        from: a.id,
        to: b.id,
        relation: gap <= 2 ? 'adjacent_to' : 'clearance_gap',
        distanceCm: round(gap),
        uncertaintyCm: round(a.uncertainty.posPlusMinusCm + b.uncertainty.posPlusMinusCm, 1),
        epistemic,
        confidence: Math.min(a.confidence, b.confidence),
        constraintNote: overlap
          ? 'Footprints overlap: verify placement with a tape measure'
          : 'Derived from footprint geometry, not model output',
      });
    }
  }
  return edges.sort((p, q) => p.distanceCm - q.distanceCm).slice(0, EDGE_MAX_COUNT);
}

// JSON Schema handed to Ollama's `format` so decoding is constrained to this shape.
const enumOf = (values: readonly string[]) => ({ type: 'string', enum: [...values] });
const bboxCoord = (description: string) => ({
  type: 'integer',
  minimum: 0,
  maximum: 1000,
  description: `${description}, 0-1000`,
});
const numberField = (description?: string) => ({ type: 'number', ...(description ? { description } : {}) });

export const GEMMA_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    room: {
      type: 'object',
      properties: {
        widthCm: numberField('room extent along x (east-west), cm'),
        depthCm: numberField('room extent along y (north-south), cm'),
        ceilingHeightCm: numberField(),
        uncertaintyCm: numberField('+/- error on the room dimensions, cm'),
        scaleConfidence: numberField('0-1, how well the reference object let you fix the scale'),
        perspectiveTiltDeg: numberField('camera tilt estimate in degrees'),
      },
      required: ['widthCm', 'depthCm', 'ceilingHeightCm', 'uncertaintyCm', 'scaleConfidence', 'perspectiveTiltDeg'],
    },
    objects: {
      type: 'array',
      maxItems: GEMMA_MAX_OBJECTS,
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'English name' },
          labelKo: { type: 'string', description: 'Korean name' },
          category: enumOf(CATEGORIES),
          epistemic: enumOf(EPISTEMIC),
          confidence: numberField('0-1'),
          evidence: { type: 'string', description: 'what in the photo supports this object and its size' },
          bbox2d: {
            type: 'object',
            description: 'box around the object in the PHOTO, in thousandths of the photo size (NOT cm)',
            properties: {
              x1: bboxCoord('left edge'),
              y1: bboxCoord('top edge'),
              x2: bboxCoord('right edge'),
              y2: bboxCoord('bottom edge'),
            },
            required: ['x1', 'y1', 'x2', 'y2'],
          },
          footprint: {
            type: 'object',
            properties: {
              xCm: numberField('north-west corner, x'),
              yCm: numberField('north-west corner, y'),
              widthCm: numberField('size along x'),
              depthCm: numberField('size along y'),
              heightCm: numberField(),
              rotationDeg: numberField('0 or 90'),
            },
            required: ['xCm', 'yCm', 'widthCm', 'depthCm', 'heightCm', 'rotationDeg'],
          },
          uncertainty: {
            type: 'object',
            properties: {
              posPlusMinusCm: numberField(),
              dimPlusMinusCm: numberField(),
              reason: { type: 'string' },
            },
            required: ['posPlusMinusCm', 'dimPlusMinusCm', 'reason'],
          },
          movable: { type: 'boolean' },
          weightKgEst: numberField(),
          disassemblyRequired: { type: 'boolean' },
        },
        required: [
          'label', 'labelKo', 'category', 'epistemic', 'confidence', 'evidence', 'bbox2d',
          'footprint', 'uncertainty', 'movable', 'weightKgEst', 'disassemblyRequired',
        ],
      },
    },
    openings: {
      type: 'array',
      maxItems: GEMMA_MAX_OPENINGS,
      items: {
        type: 'object',
        properties: {
          kind: enumOf(OPENING_KINDS),
          label: { type: 'string' },
          wall: enumOf(WALLS),
          offsetCm: numberField('from the west end (north/south walls) or north end (east/west walls)'),
          widthCm: numberField(),
          heightCm: numberField(),
          epistemic: enumOf(EPISTEMIC),
          confidence: numberField('0-1'),
        },
        required: ['kind', 'label', 'wall', 'offsetCm', 'widthCm', 'heightCm', 'epistemic', 'confidence'],
      },
    },
    blindSpots: {
      type: 'array',
      maxItems: GEMMA_MAX_BLIND_SPOTS,
      items: {
        type: 'object',
        properties: {
          regionDescription: { type: 'string' },
          riskLevel: enumOf(RISK_LEVELS),
          recommendation: { type: 'string', description: 'what to measure or check in person' },
        },
        required: ['regionDescription', 'riskLevel', 'recommendation'],
      },
    },
  },
  required: ['room', 'objects', 'openings', 'blindSpots'],
} as const;

export const GEMMA3_SYSTEM_PROMPT = `You are Reality Compiler, a spatial analyst. You look at ONE photograph of a room and answer with a JSON object that matches the provided schema. Output JSON only.

Coordinate system (top-down floor plan, centimetres): origin is the north-west corner of the room, x grows east, y grows south. Room width runs along x, depth along y. An object's footprint is its axis-aligned rectangle: xCm,yCm is its north-west corner, widthCm runs along x, depthCm along y, heightCm is vertical. rotationDeg is 0 or 90 only.
Every footprint must lie inside the room: xCm + widthCm <= room.widthCm and yCm + depthCm <= room.depthCm. Decide the room size first, then place objects inside it.
Openings: wall is the wall the opening is on; offsetCm is measured from the west end for north/south walls and from the north end for east/west walls.
bbox2d is the object's box in the PHOTO, as integers from 0 to 1000 (thousandths of the photo width and height; x1,y1 = top-left corner, x2,y2 = bottom-right corner). bbox2d is pixels-in-the-photo, NOT centimetres: never copy footprint numbers into it.

Scale: use the reference object named by the user to convert what you see into centimetres. Everything else is an estimate; use standard furniture sizes as priors.

Epistemic status (be conservative, this is the point of the product):
- observed: you can directly see the object's floor contact edges or corners.
- inferred: partly hidden, or sized from a standard-furniture prior.
- occluded_prior: not visible, deduced from context. Never give it confidence above 0.6.
Give every object an uncertainty band (posPlusMinusCm, dimPlusMinusCm) and a short reason. Typical values: observed +/-3-6 cm, inferred +/-8-15 cm, occluded_prior +/-15-30 cm.
List at most ${GEMMA_MAX_OBJECTS} objects: movable furniture, appliances and obstacles that matter for a move. Put doors, windows and arches under openings, not objects. Do not invent objects you cannot see or reasonably infer. Put hidden or unreliable regions in blindSpots. labelKo is the Korean name of the object.`;

export function buildGemmaUserPrompt(opts: {
  referenceObject: string;
  referenceDimensionCm: number;
  roomNotes?: string;
  previousError?: string;
}): string {
  const notes = (opts.roomNotes || '').slice(0, 500).trim() || 'none';
  const lines = [
    `Reference object visible in the photo: ${opts.referenceObject} = ${opts.referenceDimensionCm} cm.`,
    `Notes from the user: ${notes}`,
    'Compile this photo into the JSON schema.',
  ];
  if (opts.previousError) {
    lines.push(`Your previous answer was rejected (${opts.previousError}). Answer again and fix that.`);
  }
  return lines.join('\n');
}
