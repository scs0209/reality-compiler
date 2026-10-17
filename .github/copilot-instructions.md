# GitHub Copilot Instructions for Reality Compiler

## Core Product Philosophy
Reality Compiler does **not** output decorative 3D meshes. It compiles real-world room photographs into **executable spatial data (`roomgraph.v1.2`)** with explicit **epistemic uncertainty**:
- `observed`: Directly visible floor contact corners and unambiguous geometry.
- `inferred`: Partially occluded geometry or dimensions derived from standard furniture priors (e.g., KS door frame 210×82cm).
- `occluded_prior`: Objects in camera blind spots inferred from cables, shadows, or spatial context.

## Architectural invariants
1. Every node in `shared/roomGraphSchema.ts` must preserve `uncertainty.posPlusMinusCm` and `uncertainty.dimPlusMinusCm`.
2. Downstream tools (`shared/spatialEngine.ts`) must evaluate both **Nominal** (`feasibleNominal`) and **Worst-Case Uncertainty** (`feasibleWorstCase`) so users know where they must take a physical tape-measure check before moving day.
3. Every compile in `server/gemmaCompiler.ts` must record measured spans (`compiler.preflight`, `ai.run.gemma3`, `compiler.assemble`, `db.mongodb.upsert`, or `compiler.fallback_preset` when Gemma fails) through `server/sentryAgentTracer.ts` (`runCompileTrace` / `trace.span`, so Sentry and the in-app waterfall share one measurement), with real durations and real token counts from Ollama. Never pad durations, invent token counts, or fabricate a Sentry trace id: `compileMeta.sentryTraceId` is empty unless Sentry actually traced the compile. Never attach photos, file names or prompt text to spans.
4. A failed Gemma run must surface as a fallback (`compileMeta.runtime = "fallback-preset"` plus `compileMeta.fallback`) and be shown as such in the UI. Never present bundled sample data as the result of compiling the user's photo.
