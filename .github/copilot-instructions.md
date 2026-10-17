# GitHub Copilot Instructions for Reality Compiler

## Core Product Philosophy
Reality Compiler does **not** output decorative 3D meshes. It compiles real-world room photographs into **executable spatial data (`roomgraph.v1.2`)** with explicit **epistemic uncertainty**:
- `observed`: Directly visible floor contact corners and unambiguous geometry.
- `inferred`: Partially occluded geometry or dimensions derived from standard furniture priors (e.g., KS door frame 210×82cm).
- `occluded_prior`: Objects in camera blind spots inferred from cables, shadows, or spatial context.

## Architectural invariants
1. Every node in `shared/roomGraphSchema.ts` must preserve `uncertainty.posPlusMinusCm` and `uncertainty.dimPlusMinusCm`.
2. Downstream tools (`shared/spatialEngine.ts`) must evaluate both **Nominal** (`feasibleNominal`) and **Worst-Case Uncertainty** (`feasibleWorstCase`) so users know where they must take a physical tape-measure check before moving day.
3. All `gemma3:4b` vision compilation requests in `server/gemmaCompiler.ts` must emit OpenTelemetry GenAI spans (`vision.calibrate`, `ai.run.gemma3`, `compiler.uncertainty_solver`, `db.mongodb.upsert`) to `server/sentryAgentTracer.ts`.
