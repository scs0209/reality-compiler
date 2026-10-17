import type { RoomGraph } from './roomGraphSchema';

export interface PresetRoomSample {
  id: string;
  name: string;
  subtitle: string;
  badge: string;
  roomType: string;
  photoDataUrl: string;
  roomGraph: RoomGraph;
}

// Preset rooms are hand-authored samples: no model ran, so there are no tokens, spans or trace ids to report.
function sampleCompileMeta(sampleId: string): RoomGraph['compileMeta'] {
  return {
    compileId: sampleId,
    timestamp: '2026-10-17T00:00:00.000Z',
    model: 'none (hand-authored sample)',
    runtime: 'preset-sample',
    latencyMs: 0,
    tokens: { prompt: 0, completion: 0, total: 0 },
    sentryTraceId: '',
    sentrySpanId: '',
    atlasPersisted: false,
    spans: [],
  };
}

function makeRoomSvgDataUrl(kind: 'seoul-studio' | 'brooklyn-loft' | 'gangnam-officetel'): string {
  if (kind === 'seoul-studio') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" width="960" height="600">
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#334155"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <linearGradient id="win" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.15"/>
        </linearGradient>
      </defs>
      <rect width="960" height="600" fill="url(#wall)"/>
      <polygon points="0,600 130,360 830,360 960,600" fill="url(#floor)" stroke="#475569" stroke-width="2"/>
      <line x1="130" y1="40" x2="130" y2="360" stroke="#334155" stroke-width="3"/>
      <line x1="830" y1="40" x2="830" y2="360" stroke="#334155" stroke-width="3"/>
      <rect x="330" y="75" width="300" height="155" rx="6" fill="url(#win)" stroke="#7dd3fc" stroke-width="3"/>
      <line x1="480" y1="75" x2="480" y2="230" stroke="#7dd3fc" stroke-width="2"/>
      <g>
        <rect x="115" y="255" width="320" height="195" rx="10" fill="#1d4ed8" fill-opacity="0.55" stroke="#60a5fa" stroke-width="3"/>
        <rect x="130" y="220" width="290" height="45" rx="6" fill="#1e40af" stroke="#93c5fd" stroke-width="2"/>
        <rect x="150" y="265" width="115" height="50" rx="6" fill="#dbeafe" fill-opacity="0.8"/>
        <rect x="285" y="265" width="115" height="50" rx="6" fill="#dbeafe" fill-opacity="0.8"/>
      </g>
      <g>
        <rect x="520" y="260" width="245" height="115" rx="6" fill="#047857" fill-opacity="0.6" stroke="#34d399" stroke-width="3"/>
        <rect x="595" y="195" width="95" height="58" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
      </g>
      <g>
        <rect x="590" y="330" width="95" height="90" rx="18" fill="#b45309" fill-opacity="0.65" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="6,4"/>
      </g>
      <g>
        <rect x="745" y="150" width="175" height="310" rx="6" fill="#4338ca" fill-opacity="0.65" stroke="#818cf8" stroke-width="3"/>
        <line x1="832" y1="150" x2="832" y2="460" stroke="#818cf8" stroke-width="2"/>
      </g>
      <g>
        <rect x="42" y="385" width="145" height="145" rx="8" fill="#be123c" fill-opacity="0.45" stroke="#fb7185" stroke-width="2.5" stroke-dasharray="4,4"/>
      </g>
      <text x="28" y="38" fill="#94a3b8" font-family="monospace" font-size="14">CAM_01 // URBAN_STUDIO_215SQFT // FOCAL 26mm // SAMPLE_ILLUSTRATION</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  if (kind === 'brooklyn-loft') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" width="960" height="600">
      <rect width="960" height="600" fill="#18181b"/>
      <polygon points="0,600 110,350 850,350 960,600" fill="#27272a" stroke="#52525b" stroke-width="2"/>
      <rect x="260" y="60" width="420" height="285" fill="#0ea5e9" fill-opacity="0.22" stroke="#38bdf8" stroke-width="3"/>
      <rect x="110" y="295" width="410" height="175" rx="12" fill="#0f766e" fill-opacity="0.65" stroke="#2dd4bf" stroke-width="3"/>
      <rect x="240" y="435" width="210" height="90" rx="8" fill="#a16207" fill-opacity="0.6" stroke="#facc15" stroke-width="2.5" stroke-dasharray="6,4"/>
      <rect x="650" y="250" width="220" height="230" rx="8" fill="#4f46e5" fill-opacity="0.6" stroke="#a5b4fc" stroke-width="3"/>
      <rect x="530" y="320" width="105" height="95" rx="6" fill="#be123c" fill-opacity="0.5" stroke="#fda4af" stroke-width="2" stroke-dasharray="4,4"/>
      <text x="28" y="38" fill="#a1a1aa" font-family="monospace" font-size="14">CAM_02 // BROOKLYN_WALKUP_LOFT // NARROW_76CM_CORRIDOR_DOOR</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" width="960" height="600">
    <rect width="960" height="600" fill="#0f172a"/>
    <polygon points="0,600 140,355 820,355 960,600" fill="#1e293b" stroke="#475569" stroke-width="2"/>
    <rect x="350" y="70" width="260" height="170" fill="#38bdf8" fill-opacity="0.25" stroke="#38bdf8" stroke-width="3"/>
    <rect x="130" y="265" width="270" height="130" rx="6" fill="#0369a1" fill-opacity="0.6" stroke="#38bdf8" stroke-width="3"/>
    <rect x="540" y="265" width="270" height="130" rx="6" fill="#047857" fill-opacity="0.6" stroke="#34d399" stroke-width="3"/>
    <rect x="415" y="230" width="110" height="135" rx="6" fill="#b45309" fill-opacity="0.65" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="5,4"/>
    <rect x="160" y="420" width="330" height="130" rx="10" fill="#6d28d9" fill-opacity="0.6" stroke="#c4b5fd" stroke-width="3"/>
    <text x="28" y="38" fill="#94a3b8" font-family="monospace" font-size="14">CAM_03 // SOHO_CREATOR_OFFICE // DUAL_DESK_WORKFLOW</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PRESET_ROOMS: PresetRoomSample[] = [
  {
    id: 'seoul-mapo-studio',
    name: 'Urban Studio Apartment (340×410cm)',
    subtitle: 'Queen bed, standing desk, wardrobe + occluded mini-fridge behind bed',
    badge: 'Flagship · Uncertainty Collision Demo',
    roomType: 'Studio Apartment (340 × 410 cm)',
    photoDataUrl: makeRoomSvgDataUrl('seoul-studio'),
    roomGraph: {
      schemaVersion: 'roomgraph.v1.2',
      sceneId: 'scene-seoul-mapo-01',
      title: 'Urban Studio Apartment (RoomGraph v1.2)',
      sourcePhotoUrl: makeRoomSvgDataUrl('seoul-studio'),
      compileMeta: sampleCompileMeta('sample_mapo'),
      calibration: {
        referenceObject: 'Standard Door Frame (210cm H × 82cm W)',
        referenceDimensionCm: 210,
        pixelToCmRatio: 2.41,
        scaleConfidence: 0.91,
        perspectiveTiltDeg: 14.5,
        method: 'Single-view vanishing point + standard architectural door prior',
      },
      roomEnvelope: {
        widthCm: 340,
        depthCm: 410,
        ceilingHeightCm: 235,
        uncertaintyCm: 6,
        floorAreaSqm: 13.94,
        openings: [
          {
            id: 'open-entry-door',
            kind: 'entry_door',
            label: 'Main Entry Door (South)',
            wall: 'south',
            offsetCm: 225,
            widthCm: 82,
            heightCm: 210,
            swingClearanceCm: 80,
            epistemic: 'observed',
            confidence: 0.94,
          },
          {
            id: 'open-north-window',
            kind: 'window',
            label: 'North Double Window',
            wall: 'north',
            offsetCm: 85,
            widthCm: 170,
            heightCm: 120,
            swingClearanceCm: 0,
            epistemic: 'observed',
            confidence: 0.96,
          },
        ],
      },
      nodes: [
        {
          id: 'obj-queen-bed',
          label: 'Queen Bed Frame',
          labelKo: 'Queen Bed Frame',
          category: 'furniture',
          epistemic: 'observed',
          confidence: 0.94,
          evidenceSource: '3 of 4 floor corners + headboard directly visible; matches standard Queen prior (154×206cm)',
          bbox2d: { x: 0.12, y: 0.38, w: 0.33, h: 0.36 },
          footprint: {
            xCm: 15,
            yCm: 25,
            widthCm: 154,
            depthCm: 206,
            heightCm: 78,
            rotationDeg: 0,
          },
          uncertainty: {
            posPlusMinusCm: 3,
            dimPlusMinusCm: 4,
            reason: 'Duvet overhang introduces ±4cm width uncertainty',
          },
          movable: true,
          weightKgEst: 68,
          disassemblyRequired: true,
          colorTag: '#3b82f6',
        },
        {
          id: 'obj-standing-desk',
          label: 'Standing Desk 1400',
          labelKo: 'Standing Desk 1400',
          category: 'furniture',
          epistemic: 'observed',
          confidence: 0.91,
          evidenceSource: 'Full tabletop and both T-leg floor contact points clearly observed',
          bbox2d: { x: 0.54, y: 0.42, w: 0.26, h: 0.21 },
          footprint: {
            xCm: 188,
            yCm: 25,
            widthCm: 140,
            depthCm: 72,
            heightCm: 75,
            rotationDeg: 0,
          },
          uncertainty: {
            posPlusMinusCm: 3,
            dimPlusMinusCm: 3,
            reason: 'Perspective homography yields 140cm ±3cm',
          },
          movable: true,
          weightKgEst: 42,
          disassemblyRequired: false,
          colorTag: '#10b981',
        },
        {
          id: 'obj-ergo-chair',
          label: 'Ergonomic Mesh Chair',
          labelKo: 'Ergonomic Mesh Chair',
          category: 'furniture',
          epistemic: 'inferred',
          confidence: 0.74,
          evidenceSource: 'Backrest visible, 5-star caster base partially occluded under desk',
          bbox2d: { x: 0.61, y: 0.54, w: 0.11, h: 0.16 },
          footprint: {
            xCm: 222,
            yCm: 102,
            widthCm: 66,
            depthCm: 66,
            heightCm: 112,
            rotationDeg: 0,
          },
          uncertainty: {
            posPlusMinusCm: 8,
            dimPlusMinusCm: 5,
            reason: 'Caster base occluded + swivel pull-out variance ±8cm',
          },
          movable: true,
          weightKgEst: 16,
          disassemblyRequired: false,
          colorTag: '#f59e0b',
        },
        {
          id: 'obj-wardrobe',
          label: 'Sliding Wardrobe 1200',
          labelKo: 'Sliding Wardrobe 1200',
          category: 'furniture',
          epistemic: 'inferred',
          confidence: 0.78,
          evidenceSource: 'Front width (120cm) observed; side depth partially clipped at right FOV edge',
          bbox2d: { x: 0.77, y: 0.25, w: 0.18, h: 0.52 },
          footprint: {
            xCm: 274,
            yCm: 185,
            widthCm: 62,
            depthCm: 120,
            heightCm: 205,
            rotationDeg: 0,
          },
          uncertainty: {
            posPlusMinusCm: 5,
            dimPlusMinusCm: 6,
            reason: 'Side depth inferred from standard wardrobe depth prior (62cm ±6cm)',
          },
          movable: true,
          weightKgEst: 85,
          disassemblyRequired: true,
          colorTag: '#6366f1',
        },
        {
          id: 'obj-mini-fridge',
          label: 'Mini Fridge (Occluded)',
          labelKo: 'Mini Fridge (Occluded)',
          category: 'appliance',
          epistemic: 'occluded_prior',
          confidence: 0.56,
          evidenceSource: 'Only top edge and power cord visible behind bed footboard; deduced via studio appliance prior',
          bbox2d: { x: 0.04, y: 0.64, w: 0.15, h: 0.24 },
          footprint: {
            xCm: 18,
            yCm: 255,
            widthCm: 58,
            depthCm: 60,
            heightCm: 85,
            rotationDeg: 0,
          },
          uncertainty: {
            posPlusMinusCm: 11,
            dimPlusMinusCm: 8,
            reason: '65% occluded by Queen bed; high position & depth uncertainty (±11cm)',
          },
          movable: true,
          weightKgEst: 31,
          disassemblyRequired: false,
          colorTag: '#f43f5e',
        },
        {
          id: 'obj-floor-lamp',
          label: 'Standing Floor Lamp',
          labelKo: 'Standing Floor Lamp',
          category: 'furniture',
          epistemic: 'observed',
          confidence: 0.89,
          evidenceSource: 'Vertical pole and circular base observed between bed and desk',
          bbox2d: { x: 0.46, y: 0.35, w: 0.06, h: 0.25 },
          footprint: {
            xCm: 171,
            yCm: 135,
            widthCm: 34,
            depthCm: 34,
            heightCm: 155,
            rotationDeg: 0,
          },
          uncertainty: {
            posPlusMinusCm: 3,
            dimPlusMinusCm: 2,
            reason: 'Circular base diameter 34cm ±2cm',
          },
          movable: true,
          weightKgEst: 6,
          disassemblyRequired: false,
          colorTag: '#14b8a6',
        },
      ],
      edges: [
        {
          id: 'edge-bed-desk-gap',
          from: 'obj-queen-bed',
          to: 'obj-standing-desk',
          relation: 'clearance_gap',
          distanceCm: 19,
          uncertaintyCm: 7,
          epistemic: 'inferred',
          confidence: 0.76,
          constraintNote: 'Tight 19cm (±7cm) gap between bed and desk; check cable clearance',
        },
        {
          id: 'edge-bed-lamp-gap',
          from: 'obj-queen-bed',
          to: 'obj-floor-lamp',
          relation: 'adjacent_to',
          distanceCm: 2,
          uncertaintyCm: 8,
          epistemic: 'inferred',
          confidence: 0.71,
          constraintNote: '2cm nominal gap collides under ±8cm combined epistemic uncertainty',
        },
        {
          id: 'edge-chair-wardrobe-corridor',
          from: 'obj-ergo-chair',
          to: 'obj-wardrobe',
          relation: 'blocks_path',
          distanceCm: 38,
          uncertaintyCm: 14,
          epistemic: 'inferred',
          confidence: 0.68,
          constraintNote: 'Walkway narrows to 38cm (±14cm) when desk chair is occupied',
        },
        {
          id: 'edge-bed-occludes-fridge',
          from: 'obj-queen-bed',
          to: 'obj-mini-fridge',
          relation: 'occludes',
          distanceCm: 24,
          uncertaintyCm: 12,
          epistemic: 'occluded_prior',
          confidence: 0.56,
          constraintNote: 'Bed occludes lower 65% of mini-fridge; verify door swing clearance',
        },
      ],
      epistemicSummary: {
        observedCount: 3,
        inferredCount: 2,
        occludedCount: 1,
        overallConfidence: 0.80,
        blindSpots: [
          {
            id: 'bs-01',
            regionDescription: 'South-West corner behind Queen bed (x: 15-80cm, y: 230-310cm)',
            riskLevel: 'high',
            recommendation: 'Take 1 tape-measure check of the mini-fridge door swing (60cm) and wall outlet.',
          },
          {
            id: 'bs-02',
            regionDescription: 'East baseboard molding along Sliding Wardrobe',
            riskLevel: 'medium',
            recommendation: '1.5cm baseboard trim may prevent flush wall contact.',
          },
        ],
      },
    },
  },
  {
    id: 'brooklyn-loft-living',
    name: 'Brooklyn Walk-Up Loft (76cm Narrow Door Bottleneck)',
    subtitle: 'Deep L-sectional couch doorway bottleneck + coffee table walkway check',
    badge: 'Door Bottleneck Scenario',
    roomType: 'Living Room Loft (420 × 380 cm)',
    photoDataUrl: makeRoomSvgDataUrl('brooklyn-loft'),
    roomGraph: {
      schemaVersion: 'roomgraph.v1.2',
      sceneId: 'scene-brooklyn-loft-02',
      title: 'Brooklyn Walk-Up Living Loft — 76cm Door Simulation',
      sourcePhotoUrl: makeRoomSvgDataUrl('brooklyn-loft'),
      compileMeta: sampleCompileMeta('sample_loft'),
      calibration: {
        referenceObject: 'Balcony Sliding Door Frame (210cm H)',
        referenceDimensionCm: 210,
        pixelToCmRatio: 2.18,
        scaleConfidence: 0.89,
        perspectiveTiltDeg: 12.0,
        method: 'Vanishing line homography + standard balcony door height',
      },
      roomEnvelope: {
        widthCm: 420,
        depthCm: 380,
        ceilingHeightCm: 245,
        uncertaintyCm: 5,
        floorAreaSqm: 15.96,
        openings: [
          {
            id: 'open-narrow-entry',
            kind: 'entry_door',
            label: 'Walk-Up Hallway Door (76cm Narrow)',
            wall: 'south',
            offsetCm: 300,
            widthCm: 76,
            heightCm: 205,
            swingClearanceCm: 76,
            epistemic: 'observed',
            confidence: 0.93,
          },
          {
            id: 'open-balcony-north',
            kind: 'balcony_door',
            label: 'North Balcony Slider (Hoist Accessible)',
            wall: 'north',
            offsetCm: 80,
            widthCm: 240,
            heightCm: 210,
            swingClearanceCm: 0,
            epistemic: 'observed',
            confidence: 0.95,
          },
        ],
      },
      nodes: [
        {
          id: 'obj-sectional-sofa',
          label: 'Deep L-Sectional Couch',
          labelKo: 'Deep L-Sectional Couch',
          category: 'furniture',
          epistemic: 'observed',
          confidence: 0.92,
          evidenceSource: '3-cushion front span and left chaise depth fully visible',
          bbox2d: { x: 0.11, y: 0.49, w: 0.43, h: 0.29 },
          footprint: {
            xCm: 20,
            yCm: 60,
            widthCm: 240,
            depthCm: 102,
            heightCm: 84,
            rotationDeg: 0,
          },
          uncertainty: {
            posPlusMinusCm: 4,
            dimPlusMinusCm: 5,
            reason: 'Back cushion overhang yields min cross-section 84cm (±5cm)',
          },
          movable: true,
          weightKgEst: 92,
          disassemblyRequired: true,
          colorTag: '#14b8a6',
        },
        {
          id: 'obj-coffee-table',
          label: 'Oak Coffee Table',
          labelKo: 'Oak Coffee Table',
          category: 'furniture',
          epistemic: 'inferred',
          confidence: 0.79,
          evidenceSource: 'Tabletop observed; lower sled legs blend into rug shadow',
          bbox2d: { x: 0.25, y: 0.72, w: 0.22, h: 0.15 },
          footprint: {
            xCm: 80,
            yCm: 170,
            widthCm: 120,
            depthCm: 60,
            heightCm: 42,
            rotationDeg: 0,
          },
          uncertainty: {
            posPlusMinusCm: 6,
            dimPlusMinusCm: 4,
            reason: 'Perspective foreshortening introduces ±6cm gap uncertainty to sofa',
          },
          movable: true,
          weightKgEst: 24,
          disassemblyRequired: false,
          colorTag: '#eab308',
        },
        {
          id: 'obj-media-console',
          label: 'Media Console & Bookshelf',
          labelKo: 'Media Console & Bookshelf',
          category: 'furniture',
          epistemic: 'observed',
          confidence: 0.90,
          evidenceSource: 'Flush against East wall with crisp boundary edges',
          bbox2d: { x: 0.68, y: 0.42, w: 0.23, h: 0.38 },
          footprint: {
            xCm: 345,
            yCm: 55,
            widthCm: 65,
            depthCm: 185,
            heightCm: 145,
            rotationDeg: 0,
          },
          uncertainty: {
            posPlusMinusCm: 3,
            dimPlusMinusCm: 3,
            reason: 'Wall-anchored cabinet with low variance',
          },
          movable: true,
          weightKgEst: 64,
          disassemblyRequired: false,
          colorTag: '#6366f1',
        },
        {
          id: 'obj-occluded-trunk',
          label: 'Subwoofer / Storage Trunk',
          labelKo: 'Subwoofer / Storage Trunk',
          category: 'appliance',
          epistemic: 'occluded_prior',
          confidence: 0.58,
          evidenceSource: 'Top corner peeking behind right sofa armrest; inferred from audio cable routing',
          bbox2d: { x: 0.55, y: 0.53, w: 0.11, h: 0.16 },
          footprint: {
            xCm: 268,
            yCm: 82,
            widthCm: 48,
            depthCm: 48,
            heightCm: 55,
            rotationDeg: 0,
          },
          uncertainty: {
            posPlusMinusCm: 10,
            dimPlusMinusCm: 7,
            reason: 'Occluded behind armrest; may narrow passage to media console',
          },
          movable: true,
          weightKgEst: 18,
          disassemblyRequired: false,
          colorTag: '#f43f5e',
        },
      ],
      edges: [
        {
          id: 'edge-sofa-table',
          from: 'obj-sectional-sofa',
          to: 'obj-coffee-table',
          relation: 'clearance_gap',
          distanceCm: 8,
          uncertaintyCm: 10,
          epistemic: 'inferred',
          confidence: 0.75,
          constraintNote: '8cm nominal gap collides under ±10cm epistemic uncertainty',
        },
        {
          id: 'edge-sofa-trunk',
          from: 'obj-sectional-sofa',
          to: 'obj-occluded-trunk',
          relation: 'occludes',
          distanceCm: 8,
          uncertaintyCm: 14,
          epistemic: 'occluded_prior',
          confidence: 0.58,
          constraintNote: 'Sofa armrest occludes storage trunk footprint',
        },
      ],
      epistemicSummary: {
        observedCount: 2,
        inferredCount: 1,
        occludedCount: 1,
        overallConfidence: 0.80,
        blindSpots: [
          {
            id: 'bs-loft-1',
            regionDescription: 'Corridor between right sofa arm and Media Console (x: 260-340cm)',
            riskLevel: 'medium',
            recommendation: 'Verify subwoofer/trunk dimensions to keep a 55cm moving path clear.',
          },
        ],
      },
    },
  },
  {
    id: 'gangnam-creator-studio',
    name: 'Creator Studio Office (Dual Desk + 12U Rack)',
    subtitle: 'Symmetrical workstations, 12U server rack thermal clearance & door swing check',
    badge: 'Small Business · Office Move',
    roomType: 'Creator Office (380 × 360 cm)',
    photoDataUrl: makeRoomSvgDataUrl('gangnam-officetel'),
    roomGraph: {
      schemaVersion: 'roomgraph.v1.2',
      sceneId: 'scene-gangnam-office-03',
      title: 'Creator Studio Office (Dual Workstation)',
      sourcePhotoUrl: makeRoomSvgDataUrl('gangnam-officetel'),
      compileMeta: sampleCompileMeta('sample_office'),
      calibration: {
        referenceObject: 'Standard Studio Desk Tabletop (150cm)',
        referenceDimensionCm: 150,
        pixelToCmRatio: 2.52,
        scaleConfidence: 0.93,
        perspectiveTiltDeg: 11.2,
        method: 'Dual symmetrical desk geometry calibration',
      },
      roomEnvelope: {
        widthCm: 380,
        depthCm: 360,
        ceilingHeightCm: 250,
        uncertaintyCm: 4,
        floorAreaSqm: 13.68,
        openings: [
          {
            id: 'open-office-door',
            kind: 'entry_door',
            label: 'Acoustic Studio Door (South)',
            wall: 'south',
            offsetCm: 260,
            widthCm: 88,
            heightCm: 210,
            swingClearanceCm: 85,
            epistemic: 'observed',
            confidence: 0.95,
          },
        ],
      },
      nodes: [
        {
          id: 'obj-desk-a',
          label: 'Workstation Desk A (1500)',
          labelKo: 'Workstation Desk A (1500)',
          category: 'furniture',
          epistemic: 'observed',
          confidence: 0.95,
          evidenceSource: 'All 4 tabletop corners and West wall contact directly visible',
          bbox2d: { x: 0.14, y: 0.44, w: 0.28, h: 0.22 },
          footprint: {
            xCm: 16,
            yCm: 30,
            widthCm: 150,
            depthCm: 76,
            heightCm: 74,
            rotationDeg: 0,
          },
          uncertainty: {
            posPlusMinusCm: 2,
            dimPlusMinusCm: 3,
            reason: 'High-confidence standard desk geometry',
          },
          movable: true,
          weightKgEst: 48,
          disassemblyRequired: false,
          colorTag: '#0ea5e9',
        },
        {
          id: 'obj-server-cabinet',
          label: '12U NAS & Audio Rack',
          labelKo: '12U NAS & Audio Rack',
          category: 'appliance',
          epistemic: 'inferred',
          confidence: 0.77,
          evidenceSource: '19-inch front rack rails visible; rear XLR/power cable bend depth inferred',
          bbox2d: { x: 0.43, y: 0.38, w: 0.12, h: 0.22 },
          footprint: {
            xCm: 168,
            yCm: 28,
            widthCm: 58,
            depthCm: 68,
            heightCm: 90,
            rotationDeg: 0,
          },
          uncertainty: {
            posPlusMinusCm: 5,
            dimPlusMinusCm: 6,
            reason: 'Rear cable bend radius adds ±6cm depth uncertainty',
          },
          movable: true,
          weightKgEst: 54,
          disassemblyRequired: true,
          colorTag: '#f59e0b',
        },
        {
          id: 'obj-desk-b',
          label: 'Workstation Desk B (1400)',
          labelKo: 'Workstation Desk B (1400)',
          category: 'furniture',
          epistemic: 'observed',
          confidence: 0.93,
          evidenceSource: 'Full tabletop observed along East wall',
          bbox2d: { x: 0.56, y: 0.44, w: 0.28, h: 0.22 },
          footprint: {
            xCm: 228,
            yCm: 30,
            widthCm: 140,
            depthCm: 76,
            heightCm: 74,
            rotationDeg: 0,
          },
          uncertainty: {
            posPlusMinusCm: 3,
            dimPlusMinusCm: 3,
            reason: 'High-confidence standard desk geometry',
          },
          movable: true,
          weightKgEst: 44,
          disassemblyRequired: false,
          colorTag: '#10b981',
        },
        {
          id: 'obj-lounge-bench',
          label: 'Client Waiting Sofa',
          labelKo: 'Client Waiting Sofa',
          category: 'furniture',
          epistemic: 'observed',
          confidence: 0.89,
          evidenceSource: 'Front lower frame and armrests clearly visible',
          bbox2d: { x: 0.17, y: 0.70, w: 0.34, h: 0.22 },
          footprint: {
            xCm: 30,
            yCm: 215,
            widthCm: 155,
            depthCm: 82,
            heightCm: 78,
            rotationDeg: 0,
          },
          uncertainty: {
            posPlusMinusCm: 4,
            dimPlusMinusCm: 4,
            reason: 'Cushion compression variance ±4cm',
          },
          movable: true,
          weightKgEst: 45,
          disassemblyRequired: false,
          colorTag: '#8b5cf6',
        },
      ],
      edges: [
        {
          id: 'edge-deska-rack',
          from: 'obj-desk-a',
          to: 'obj-server-cabinet',
          relation: 'power_tethered',
          distanceCm: 2,
          uncertaintyCm: 7,
          epistemic: 'inferred',
          confidence: 0.77,
          constraintNote: '2cm (±7cm) gap between Desk A and 12U Rack risks thermal/cable pinch',
        },
        {
          id: 'edge-rack-deskb',
          from: 'obj-server-cabinet',
          to: 'obj-desk-b',
          relation: 'power_tethered',
          distanceCm: 2,
          uncertaintyCm: 8,
          epistemic: 'inferred',
          confidence: 0.76,
          constraintNote: 'Tight 2cm clearance on both sides of 12U rack',
        },
      ],
      epistemicSummary: {
        observedCount: 3,
        inferredCount: 1,
        occludedCount: 0,
        overallConfidence: 0.89,
        blindSpots: [
          {
            id: 'bs-office-1',
            regionDescription: 'Rear wiring bay behind 12U NAS & Audio Rack',
            riskLevel: 'medium',
            recommendation: 'Keep at least 10cm rear wall clearance to prevent XLR/fiber bend damage.',
          },
        ],
      },
    },
  },
];
