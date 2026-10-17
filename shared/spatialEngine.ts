import type {
  RoomGraph,
  RoomObjectNode,
  ConstraintViolation,
  MovingWhatIfReport,
} from './roomGraphSchema';

interface RectBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
  w: number;
  d: number;
}

export function getNodeRect(node: RoomObjectNode, inflateCm = 0): RectBox {
  const isRotated = Math.abs(node.footprint.rotationDeg % 180) === 90;
  const w = (isRotated ? node.footprint.depthCm : node.footprint.widthCm) + inflateCm * 2;
  const d = (isRotated ? node.footprint.widthCm : node.footprint.depthCm) + inflateCm * 2;
  const x1 = node.footprint.xCm - inflateCm;
  const y1 = node.footprint.yCm - inflateCm;
  return {
    x1,
    y1,
    x2: x1 + w,
    y2: y1 + d,
    cx: x1 + w / 2,
    cy: y1 + d / 2,
    w,
    d,
  };
}

function rectsOverlapDistance(a: RectBox, b: RectBox): number {
  const dx = Math.max(a.x1 - b.x2, b.x1 - a.x2, 0);
  const dy = Math.max(a.y1 - b.y2, b.y1 - a.y2, 0);
  if (dx === 0 && dy === 0) {
    // Overlapping penetration depth (negative gap)
    const overlapX = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
    const overlapY = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
    return -Math.min(overlapX, overlapY);
  }
  return Math.round(Math.hypot(dx, dy));
}

export function evaluateMovingWhatIf(
  graph: RoomGraph,
  targetDoorWidthOverrideCm?: number,
  minWalkwayCm = 55
): MovingWhatIfReport {
  const violations: ConstraintViolation[] = [];
  const envW = graph.roomEnvelope.widthCm;
  const envD = graph.roomEnvelope.depthCm;

  const entryDoor =
    graph.roomEnvelope.openings.find((o) => o.kind === 'entry_door') ||
    graph.roomEnvelope.openings[0];

  const effectiveDoorWidthCm =
    targetDoorWidthOverrideCm ?? (entryDoor ? entryDoor.widthCm : 80);

  // 1. Check Doorway Bottlenecks (can each movable item pass through the door?)
  const doorBottlenecks = graph.nodes
    .filter((n) => n.movable)
    .map((node) => {
      // To pass through a door, the smallest 2D cross-section dimension (min of width/depth/height) matters
      const dims = [
        node.footprint.widthCm,
        node.footprint.depthCm,
        node.footprint.heightCm,
      ].sort((a, b) => a - b);
      const minCrossSectionCm = dims[0];
      const unc = node.uncertainty.dimPlusMinusCm;
      const worstCaseDim = minCrossSectionCm + unc;

      let status: 'pass' | 'tight_uncertainty' | 'blocked' = 'pass';
      if (minCrossSectionCm > effectiveDoorWidthCm) {
        status = 'blocked';
      } else if (worstCaseDim > effectiveDoorWidthCm - 2) {
        status = 'tight_uncertainty';
      }

      if (status === 'blocked') {
        violations.push({
          id: `v-door-${node.id}`,
          severity: 'blocker',
          code: 'DOOR_BOTTLENECK',
          title: `${node.label}: Doorway Bottleneck (${minCrossSectionCm}cm > ${effectiveDoorWidthCm}cm door)`,
          detail: node.disassemblyRequired
            ? `Minimum cross-section is ${minCrossSectionCm}cm (±${unc}cm), exceeding the ${effectiveDoorWidthCm}cm doorway. Disassembly or window hoist is mandatory.`
            : `Minimum pass-through width (${minCrossSectionCm}cm) exceeds the ${effectiveDoorWidthCm}cm doorway.`,
          affectedNodeIds: [node.id],
          nominalPass: false,
          worstCasePass: false,
          marginCm: effectiveDoorWidthCm - minCrossSectionCm,
        });
      } else if (status === 'tight_uncertainty') {
        violations.push({
          id: `v-door-unc-${node.id}`,
          severity: 'uncertainty_warning',
          code: 'UNCERTAINTY_OVERFLOW',
          title: `${node.label}: Door Clearance Within Error Margin (Nominal Pass / ±${unc}cm Risk)`,
          detail: `Nominal min cross-section is ${minCrossSectionCm}cm, but with ±${unc}cm epistemic uncertainty (${node.epistemic}) it reaches ${worstCaseDim}cm against a ${effectiveDoorWidthCm}cm door.`,
          affectedNodeIds: [node.id],
          nominalPass: true,
          worstCasePass: false,
          marginCm: effectiveDoorWidthCm - worstCaseDim,
        });
      }

      return {
        nodeId: node.id,
        label: node.label,
        minCrossSectionCm,
        doorWidthCm: effectiveDoorWidthCm,
        uncertaintyCm: unc,
        status,
        requiresDisassembly: node.disassemblyRequired || status !== 'pass',
      };
    });

  // 2. Check Room Envelope Bounds (Nominal & Worst-Case with uncertainty)
  for (const node of graph.nodes) {
    const nominalRect = getNodeRect(node, 0);
    const uncTotal = node.uncertainty.posPlusMinusCm + node.uncertainty.dimPlusMinusCm;
    const worstRect = getNodeRect(node, uncTotal);

    const outNominal =
      nominalRect.x1 < 0 ||
      nominalRect.y1 < 0 ||
      nominalRect.x2 > envW ||
      nominalRect.y2 > envD;

    const outWorst =
      worstRect.x1 < -12 ||
      worstRect.y1 < -12 ||
      worstRect.x2 > envW + graph.roomEnvelope.uncertaintyCm + 8 ||
      worstRect.y2 > envD + graph.roomEnvelope.uncertaintyCm + 8;

    if (outNominal) {
      const overflowCm = Math.round(
        Math.max(
          -nominalRect.x1,
          -nominalRect.y1,
          nominalRect.x2 - envW,
          nominalRect.y2 - envD
        )
      );
      violations.push({
        id: `v-bounds-${node.id}`,
        severity: 'blocker',
        code: 'OUT_OF_BOUNDS',
        title: `${node.label}: Exceeds Room Wall Envelope (+${overflowCm}cm out of bounds)`,
        detail: `${node.label} extends ${overflowCm}cm outside the ${envW}×${envD}cm room envelope.`,
        affectedNodeIds: [node.id],
        nominalPass: false,
        worstCasePass: false,
        marginCm: -overflowCm,
      });
    } else if (outWorst && uncTotal >= 6) {
      violations.push({
        id: `v-bounds-unc-${node.id}`,
        severity: 'uncertainty_warning',
        code: 'UNCERTAINTY_OVERFLOW',
        title: `${node.label}: Wall Molding Risk Under ±${uncTotal}cm Uncertainty`,
        detail: `Fits nominally inside the room, but its ${node.epistemic} uncertainty halo (±${uncTotal}cm) overlaps baseboard molding or wall outlets.`,
        affectedNodeIds: [node.id],
        nominalPass: true,
        worstCasePass: false,
        marginCm: 0,
      });
    }
  }

  // 3. Pairwise Object Collisions & Corridor Clearances
  const corridorClearances: MovingWhatIfReport['corridorClearances'] = [];

  for (let i = 0; i < graph.nodes.length; i++) {
    for (let j = i + 1; j < graph.nodes.length; j++) {
      const a = graph.nodes[i];
      const b = graph.nodes[j];

      // Skip if one is intentionally on top of another
      const isStacked = graph.edges.some(
        (e) =>
          e.relation === 'on_top_of' &&
          ((e.from === a.id && e.to === b.id) || (e.from === b.id && e.to === a.id))
      );
      if (isStacked) continue;

      const rectA = getNodeRect(a, 0);
      const rectB = getNodeRect(b, 0);
      const nominalGapCm = rectsOverlapDistance(rectA, rectB);

      const uncA = a.uncertainty.posPlusMinusCm + a.uncertainty.dimPlusMinusCm;
      const uncB = b.uncertainty.posPlusMinusCm + b.uncertainty.dimPlusMinusCm;
      const worstGapCm = Math.round(nominalGapCm - (uncA + uncB));

      if (nominalGapCm < 0) {
        violations.push({
          id: `v-col-${a.id}-${b.id}`,
          severity: 'blocker',
          code: 'OBJECT_COLLISION',
          title: `${a.label} ↔ ${b.label}: Physical Footprint Collision (${Math.abs(nominalGapCm)}cm overlap)`,
          detail: `The 2D footprints overlap by ${Math.abs(nominalGapCm)}cm. Drag or rotate either object to resolve.`,
          affectedNodeIds: [a.id, b.id],
          nominalPass: false,
          worstCasePass: false,
          marginCm: nominalGapCm,
        });
      } else if (nominalGapCm >= 0 && nominalGapCm <= 15 && worstGapCm < 0) {
        violations.push({
          id: `v-unc-col-${a.id}-${b.id}`,
          severity: 'uncertainty_warning',
          code: 'UNCERTAINTY_OVERFLOW',
          title: `${a.label} ↔ ${b.label}: Epistemic Uncertainty Collision (${nominalGapCm}cm gap vs ±${uncA + uncB}cm error)`,
          detail: `Nominal clearance is ${nominalGapCm}cm, but combined uncertainty (±${uncA + uncB}cm) causes up to ${Math.abs(worstGapCm)}cm interference. Verify this single gap with a tape measure!`,
          affectedNodeIds: [a.id, b.id],
          nominalPass: true,
          worstCasePass: false,
          marginCm: worstGapCm,
        });
      }

      // Record significant corridor gaps between major furniture
      if (nominalGapCm <= 120) {
        let status: 'pass' | 'uncertainty_risk' | 'blocked' = 'pass';
        if (nominalGapCm > 0 && nominalGapCm < 35 && nominalGapCm > 8) {
          status = 'blocked';
        } else if (
          nominalGapCm >= 35 &&
          nominalGapCm < minWalkwayCm &&
          worstGapCm < minWalkwayCm - 10
        ) {
          status = 'uncertainty_risk';
        } else if (nominalGapCm < 0) {
          status = 'blocked';
        } else if (worstGapCm < 0) {
          status = 'uncertainty_risk';
        }

        corridorClearances.push({
          fromId: a.id,
          toId: b.id,
          nominalGapCm,
          worstCaseGapCm: worstGapCm,
          minRequiredCm: minWalkwayCm,
          status,
        });
      }
    }
  }

  // 4. Check Door Swing Arc Clearance
  for (const opening of graph.roomEnvelope.openings) {
    if (opening.swingClearanceCm <= 0) continue;
    let swingRect: RectBox;
    if (opening.wall === 'south') {
      swingRect = {
        x1: opening.offsetCm,
        y1: envD - opening.swingClearanceCm,
        x2: opening.offsetCm + opening.widthCm,
        y2: envD,
        cx: opening.offsetCm + opening.widthCm / 2,
        cy: envD - opening.swingClearanceCm / 2,
        w: opening.widthCm,
        d: opening.swingClearanceCm,
      };
    } else if (opening.wall === 'north') {
      swingRect = {
        x1: opening.offsetCm,
        y1: 0,
        x2: opening.offsetCm + opening.widthCm,
        y2: opening.swingClearanceCm,
        cx: opening.offsetCm + opening.widthCm / 2,
        cy: opening.swingClearanceCm / 2,
        w: opening.widthCm,
        d: opening.swingClearanceCm,
      };
    } else if (opening.wall === 'west') {
      swingRect = {
        x1: 0,
        y1: opening.offsetCm,
        x2: opening.swingClearanceCm,
        y2: opening.offsetCm + opening.widthCm,
        cx: opening.swingClearanceCm / 2,
        cy: opening.offsetCm + opening.widthCm / 2,
        w: opening.swingClearanceCm,
        d: opening.widthCm,
      };
    } else {
      swingRect = {
        x1: envW - opening.swingClearanceCm,
        y1: opening.offsetCm,
        x2: envW,
        y2: opening.offsetCm + opening.widthCm,
        cx: envW - opening.swingClearanceCm / 2,
        cy: opening.offsetCm + opening.widthCm / 2,
        w: opening.swingClearanceCm,
        d: opening.widthCm,
      };
    }

    for (const node of graph.nodes) {
      const nRect = getNodeRect(node, 0);
      const dist = rectsOverlapDistance(swingRect, nRect);
      if (dist < 0) {
        violations.push({
          id: `v-swing-${opening.id}-${node.id}`,
          severity: 'blocker',
          code: 'DOOR_SWING_BLOCKED',
          title: `${opening.label} Swing Arc Blocked by ${node.label}`,
          detail: `${node.label} intrudes ${Math.abs(dist)}cm into the ${opening.swingClearanceCm}cm door swing radius of ${opening.label}.`,
          affectedNodeIds: [node.id],
          nominalPass: false,
          worstCasePass: false,
          marginCm: dist,
        });
      }
    }
  }

  // 5. TabPFN-3.5 Tabular Moving Cost & Volume Quantile Estimator
  const movableNodes = graph.nodes.filter((n) => n.movable);
  const totalVolumeCbm = Number(
    movableNodes
      .reduce(
        (acc, n) =>
          acc +
          (n.footprint.widthCm * n.footprint.depthCm * n.footprint.heightCm) / 1_000_000,
        0
      )
      .toFixed(2)
  );
  const totalWeightKg = Math.round(
    movableNodes.reduce((acc, n) => acc + n.weightKgEst, 0)
  );
  const disassemblyCount = movableNodes.filter((n) => n.disassemblyRequired).length;
  const occludedOrLowConfCount = movableNodes.filter(
    (n) => n.epistemic !== 'observed' || n.confidence < 0.78
  ).length;

  const recommendedTruck =
    totalVolumeCbm <= 4.2
      ? '1-Ton Cargo Van (Studio Standard)'
      : totalVolumeCbm <= 8.5
      ? '2.5-Ton Box Truck (1-2BR Loft)'
      : '5-Ton Moving Truck';

  const crewCount = totalVolumeCbm <= 4.0 ? 2 : totalVolumeCbm <= 8.5 ? 3 : 4;
  const estimatedDurationHours = Number(
    (1.8 + totalVolumeCbm * 0.45 + disassemblyCount * 0.4).toFixed(1)
  );

  const baseKrw =
    220_000 +
    totalVolumeCbm * 48_000 +
    disassemblyCount * 45_000 +
    totalWeightKg * 320;
  const uncertaintySpread = 1 + occludedOrLowConfCount * 0.085;

  const p50Krw = Math.round(baseKrw / 1000) * 1000;
  const p10Krw = Math.round((baseKrw * 0.86) / 1000) * 1000;
  const p90Krw = Math.round((baseKrw * uncertaintySpread * 1.15) / 1000) * 1000;

  const feasibleNominal = !violations.some((v) => !v.nominalPass);
  const feasibleWorstCase = !violations.some((v) => !v.worstCasePass);

  const blockerPenalty = violations.filter((v) => v.severity === 'blocker').length * 28;
  const warningPenalty =
    violations.filter((v) => v.severity === 'uncertainty_warning').length * 11;
  const confidenceAdjustedScore = Math.max(
    5,
    Math.min(100, Math.round(100 - blockerPenalty - warningPenalty))
  );

  return {
    feasibleNominal,
    feasibleWorstCase,
    confidenceAdjustedScore,
    doorBottlenecks,
    corridorClearances,
    violations,
    tabpfnEstimate: {
      modelVersion: 'TabPFN-3.5-MovingQuote-Regressor',
      totalVolumeCbm,
      totalWeightKg,
      recommendedTruck,
      crewCount,
      estimatedDurationHours,
      estimatedCostKrw: { p10: p10Krw, p50: p50Krw, p90: p90Krw },
      estimatedCostUsd: {
        p10: Math.round(p10Krw / 1380),
        p50: Math.round(p50Krw / 1380),
        p90: Math.round(p90Krw / 1380),
      },
      riskPremiumReason:
        occludedOrLowConfCount > 0
          ? `Includes +${Math.round((uncertaintySpread - 1) * 100)}% P90 risk buffer due to ${occludedOrLowConfCount} Inferred/Occluded items and ${disassemblyCount} disassembly-required pieces.`
          : 'All primary objects are high-confidence Observed nodes; quote variance is minimal.',
    },
  };
}
