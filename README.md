# Reality Compiler (`roomgraph.v1.2`)

> **Compile Reality into Executable Spatial Data** — Turn single room photographs into **`RoomGraph JSON` (`roomgraph.v1.2`)** with metric dimensions, spatial relation edges, and explicit **epistemic uncertainty (`Observed` vs `Inferred` vs `Occluded Prior`)**, complete with an interactive **3D Epistemic Volumes + 2D Metric Blueprint** workbench, **Moving What-If Verification**, and **TabPFN Moving Quote Quantiles**.

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
     [Gemma 3: gemma3:4b]   [MongoDB Atlas]       [Moving What-If & TabPFN]
      Vision -> RoomGraph    roomgraphs store      Door bottlenecks, ±cm solver & CSV
```

| Tier | Partner | Implementation | Description |
|---|---|---|---|
| Featured ($200) | **Gemma** | [server/gemmaCompiler.ts](server/gemmaCompiler.ts) | `gemma3:4b` vision compiler with 210×82cm door-frame anchor calibration |
| Featured ($200) | **DigitalOcean** | [.do/app.yaml](.do/app.yaml), [deploy/digitalocean-gpu-ollama.sh](deploy/digitalocean-gpu-ollama.sh) | App Platform web/API spec + GPU Droplet `gemma3:4b` provisioning script |
| Partner ($100) | **.tech Domain** | [.do/app.yaml](.do/app.yaml) | Primary custom domain routing for `realitycompiler.tech` |
| Partner ($100) | **MongoDB Atlas** | [server/atlasStore.ts](server/atlasStore.ts) | `roomgraphs` collection upsert & full-text search across furniture/epistemic states |
| Partner ($100) | **Sentry Agent Tracing** | [server/sentryAgentTracer.ts](server/sentryAgentTracer.ts) | OpenTelemetry GenAI spans, latency waterfall, and prompt/completion token tracking |
| Partner ($100) | **Entire** | [.entire/settings.json](.entire/settings.json), [entire-session/devrelay-session.json](entire-session/devrelay-session.json) | Live Entire CLI repository tracking (`entire enable`) + embedded session checkpoints |
| Partner ($100) | **GitHub Copilot** | [.github/copilot-instructions.md](.github/copilot-instructions.md), [.github/workflows/ci.yml](.github/workflows/ci.yml) | Repository instructions enforcing epistemic invariants + GitHub Actions CI gate |
| Featured ($200) | **TabPFN** | [shared/spatialEngine.ts](shared/spatialEngine.ts) | P10/P50/P90 moving cost quantiles and CSV logistics manifest from RoomGraph features |

## Quick Start

```bash
npm install
npm run dev
```

- Web Studio UI: `http://127.0.0.1:5173`
- Compiler API Health: `http://127.0.0.1:8787/api/health`
- Verification: `npm run typecheck && npm test && npm run build`
