import { describe, it, expect } from 'vitest';
import { RoomGraphSchema } from '../shared/roomGraphSchema';
import { PRESET_ROOMS } from '../shared/presetRooms';
import { evaluateMovingWhatIf } from '../shared/spatialEngine';

describe('Reality Compiler — RoomGraph v1.2 & Moving What-If Engine', () => {
  it('validates all preset rooms against RoomGraphSchema v1.2', () => {
    for (const preset of PRESET_ROOMS) {
      const parsed = RoomGraphSchema.parse(preset.roomGraph);
      expect(parsed.schemaVersion).toBe('roomgraph.v1.2');
      expect(parsed.nodes.length).toBeGreaterThan(0);
      expect(parsed.epistemicSummary.overallConfidence).toBeGreaterThan(0.5);
    }
  });

  it('distinguishes Nominal feasibility vs Worst-Case Epistemic Uncertainty collisions', () => {
    const mapoStudio = structuredClone(PRESET_ROOMS[0].roomGraph);
    const report = evaluateMovingWhatIf(mapoStudio, 82, 55);

    // Nominal layout has no physical overlaps, so feasibleNominal is true
    expect(report.feasibleNominal).toBe(true);
    // However, ±cm uncertainty between Queen Bed and Standing Floor Lamp (2cm gap vs ±12cm combined uncertainty) triggers UNCERTAINTY_OVERFLOW
    expect(report.feasibleWorstCase).toBe(false);
    expect(
      report.violations.some((v) => v.code === 'UNCERTAINTY_OVERFLOW')
    ).toBe(true);
  });

  it('detects narrow doorway bottleneck when door width is reduced to 76cm', () => {
    const brooklynLoft = structuredClone(PRESET_ROOMS[1].roomGraph);
    const report = evaluateMovingWhatIf(brooklynLoft, 76, 55);

    // Sectional sofa has min cross-section 84cm > 76cm door width
    expect(report.feasibleNominal).toBe(false);
    expect(
      report.violations.some((v) => v.code === 'DOOR_BOTTLENECK')
    ).toBe(true);
    expect(report.tabpfnEstimate.totalVolumeCbm).toBeGreaterThan(1.0);
    expect(report.tabpfnEstimate.estimatedCostKrw.p90).toBeGreaterThan(
      report.tabpfnEstimate.estimatedCostKrw.p50
    );
  });
});
