# Reality Compiler (`roomgraph.v1.2`)

> **Compile Reality into Executable Spatial Data** — Turn single room photographs into **`RoomGraph JSON` (`roomgraph.v1.2`)** with metric dimensions, spatial relation edges, and explicit **epistemic uncertainty (`Observed` vs `Inferred` vs `Occluded Prior`)**, complete with an interactive **3D Epistemic Volumes + 2D Metric Blueprint** workbench, **Moving What-If Verification**, and a **rule-based Moving Quote Estimate (P10 / P50 / P90 range)**.

## Why Epistemic 3D Volumes Instead of Decorative Photogrammetry Meshes?

Traditional 3D room reconstruction tools generate smooth, texture-baked meshes that **hallucinate over blind spots**—creating false precision right where a baseboard, wall outlet, or occluded mini-fridge will cause a collision on moving day.

**Reality Compiler** provides both:
1. **3D Epistemic Volumes View**: Renders `Observed` objects as solid metric cuboids while `Inferred` and `Occluded Prior` objects expose their outer `±cm` wireframe uncertainty shells in 3D orbit space.
2. **2D Metric Blueprint View**: Allows drag-and-drop placement, `90°` rotation, and What-If furniture injection with real-time `UNCERTAINTY_OVERFLOW` and `DOOR_BOTTLENECK` constraint checking.

## Architecture & Partner Stack (Hacktoberfest Week 2)

```text
[realitycompiler.tech] ──► [DigitalOcean App Platform] UI / Express API
                                    │
                                    ▼
                        Compile Workflow (Sentry Agent Tracing)
                                    │
             ┌──────────────────────┼──────────────────────┐
             ▼                      ▼                      ▼
     [Gemma 3: gemma3:4b]   [MongoDB Atlas]       [Moving What-If & Quote Estimate]
      Vision -> RoomGraph    roomgraphs store      Door bottlenecks, ±cm solver & CSV
```

| Tier | Partner | Implementation | Description |
|---|---|---|---|
| Featured ($200) | **Gemma** | [server/gemmaCompiler.ts](server/gemmaCompiler.ts) | `gemma3:4b` vision compiler with 210×82cm door-frame anchor calibration |
| Featured ($200) | **DigitalOcean** | [.do/app.yaml](.do/app.yaml), [deploy/digitalocean-gpu-ollama.sh](deploy/digitalocean-gpu-ollama.sh) | App Platform web/API spec + GPU Droplet `gemma3:4b` provisioning script |
| Partner ($100) | **.tech Domain** | [.do/app.yaml](.do/app.yaml) | Primary custom domain routing for `realitycompiler.tech` |
| Partner ($100) | **MongoDB Atlas** | [server/atlasStore.ts](server/atlasStore.ts) | `roomgraphs` collection upsert & full-text search across furniture/epistemic states |
| Partner ($100) | **Sentry Agent Tracing** | [server/sentryAgentTracer.ts](server/sentryAgentTracer.ts) | Each compile is a `gen_ai.invoke_agent` trace with `gen_ai.chat` (Gemma), `compiler.assemble` and `db.mongodb.upsert` child spans, measured durations and Ollama's real token counts. It is sent to Sentry only when `SENTRY_DSN` is set; otherwise the UI and `/api/health` say it is not sending. Photos, file names and prompts are never attached. |
| Partner ($100) | **Entire** | [.entire/settings.json](.entire/settings.json), [entire-session/devrelay-session.json](entire-session/devrelay-session.json) | Live Entire CLI repository tracking (`entire enable`) + embedded session checkpoints |
| Partner ($100) | **GitHub Copilot** | [.github/copilot-instructions.md](.github/copilot-instructions.md), [.github/workflows/ci.yml](.github/workflows/ci.yml) | Repository instructions enforcing epistemic invariants + GitHub Actions CI gate |

### Moving Quote Estimate: How It Is Computed

The moving quote in [shared/spatialEngine.ts](shared/spatialEngine.ts) is a **hand-written, rule-based formula** over RoomGraph features (movable-item volume in CBM, weight in kg, disassembly count, and the number of Inferred/Occluded items). It is **not** a TabPFN or other trained-model inference. P50 is the formula output; P10 and P90 are fixed heuristic spreads (P90 widens with the Inferred/Occluded item count), not calibrated statistical quantiles. A tabular regressor such as TabPFN is not integrated yet.

## Quick Start

You need Node 20+ and [Ollama](https://ollama.com). The Gemma model is downloaded separately and is under its own terms (see [License](#license)).

```bash
npm install
ollama pull gemma3:4b
npm run dev
```

- Web Studio UI: `http://127.0.0.1:5173`
- Compiler API Health: `http://127.0.0.1:8787/api/health`
- Verification: `npm run typecheck && npm test && npm run build`

## License

The code in this repository is released under the [MIT License](LICENSE). Third-party dependencies keep their own licenses.

### Gemma is licensed separately

This repository contains **no model weights**. Reality Compiler calls `gemma3:4b` through Ollama, and you download that model yourself with `ollama pull gemma3:4b`. The weights are **not** covered by the MIT License. They are provided by Google under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms) and its Prohibited Use Policy, and those terms apply to everyone who uses them.

- **Using Gemma** means accepting those terms, including the Prohibited Use Policy.
- **Distributing Gemma** (or models derived from it) means passing the use restrictions on to recipients and giving them a copy of the terms. The terms count making Gemma available as a hosted service over an API as distribution, so check them before running a public deployment backed by a Gemma server.
- **Other models:** the Gemma Terms of Use cover the Gemma 1, 2, 3 and 3n families, and Gemma 4 has its own license. If you point `GEMMA_MODEL` at a different model, check that model's license.
- **Outputs:** Google states that it claims no rights in what Gemma generates.

This is a summary of public text as of 2026-10-17, not legal advice. Read the current terms before relying on it.
