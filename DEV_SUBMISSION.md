---
title: "Reality Compiler: Compiling Room Photos into Epistemic Spatial Graphs with Gemma 3 (Not Just Pretty 3D Meshes)"
published: false
tags: devchallenge, hf26challenge, ai, opensource
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge: Week 2 (Side Hustle)](https://dev.to/challenges/hacktoberfest-week2-2026-10-12).*

## What I Built: Reality Compiler (`roomgraph.v1.2`)

When you are planning a studio move or helping a small office relocate, **a pretty 3D mesh is a trap**. Photogrammetry and generative 3D tools hallucinate smooth geometry over blind spots—giving you false precision right where a baseboard, a power outlet, or a partially occluded mini-fridge will ruin moving day.

**Reality Compiler** compiles a single room photograph into **`RoomGraph` (`roomgraph.v1.2`)**—an executable JSON spatial model built for downstream tools rather than visual eye-candy:
1. **Epistemic Honesty (`Observed` vs `Inferred` vs `Occluded Prior`)**: Every node explicitly declares whether its footprint corners were directly observed in the photo, inferred from standard furniture priors, or deduced from a blind spot, along with metric error bars (`±posPlusMinusCm`, `±dimPlusMinusCm`).
2. **Interactive 2D Top-Down Spatial Workbench**: Drag, rotate (`90°`), and inject new furniture (e.g., upgrading to a King bed or adding a WashTower) while visualizing `±cm` uncertainty halos in real time.
3. **Downstream #1 — Moving What-If & Bottleneck Verifier**: Evaluates both **Nominal Feasibility** and **Worst-Case Uncertainty Feasibility**. If a Queen bed and a floor lamp have a `2cm` nominal clearance but `±8cm` epistemic uncertainty, Reality Compiler flags an `UNCERTAINTY_OVERFLOW` warning and tells you the exact single spot to check with a tape measure.
4. **TabPFN-3.5 Moving Quote Quantiles (P10 / P50 / P90)**: Converts the compiled RoomGraph into a tabular logistics manifest (CBM volume, kg weight, disassembly count, and occluded-item risk buffer) to estimate truck size and moving cost quantiles.

### Live Demo & Repository
- **Live Demo (`.tech` Domain)**: [https://realitycompiler.tech](https://realitycompiler.tech)
- **Entire / DevRelay Build Session**: Included in [`entire-session/devrelay-session.json`](./entire-session/devrelay-session.json) and viewable directly inside the app's **Entire / DevRelay** tab.

---

## Who Would Pay For This (The Side Hustle)

1. **Independent Moving Estimators & Small Relocation Teams**: In dense cities like Seoul or New York, sending an estimator in person for a 1-ton studio move costs more than the margin on the job. Customers send 1–2 room photos on KakaoTalk or WhatsApp. Reality Compiler turns those photos into a structured `RoomGraph` + CSV manifest, flags narrow 76cm hallway door bottlenecks requiring ladder trucks or disassembly, and prices the P90 uncertainty risk into the quote.
2. **Studio Tenants & Small Office Operators**: Before paying for a furniture delivery or signing a lease, tenants can test "What if I rotate the 1400mm standing desk and bring a 3-seater sofa?" in 10 seconds.

---

## Why Open Innovation Matters (`gemma3:4b` Local & Self-Hosted Vision)

1. **Privacy for Inside-Home Photos**: Nobody wants photos of the inside of their bedroom or studio uploaded to a closed commercial training pipeline. Running Google's open-weight **`gemma3:4b`** locally via Ollama or on our own dedicated **DigitalOcean GPU Droplet** keeps private home imagery under strict control.
2. **Unit Economics that Make a $9 Side Hustle Viable**: Calling a proprietary frontier multimodal API repeatedly during interactive layout calibration destroys margins. `gemma3:4b` (4-bit quantized) runs fast, deterministic JSON schema extraction at near-zero marginal cost.
3. **Schema-First Determinism**: By pairing `gemma3:4b` with our open `roomgraph.v1.2` Zod schema and a deterministic 2D uncertainty constraint engine, we can swap or fine-tune the vision backbone without breaking downstream tools.

---

## Partner Technologies Used (Prize Categories)

- **Best Use of Gemma ($200)**: Uses Google's open-weight **`gemma3:4b`** multimodal model (`server/gemmaCompiler.ts`) with a two-stage calibration prompt (locking onto KS standard 210×82cm door frames before extracting 2D bboxes, metric footprints, and epistemic status).
- **Best Use of DigitalOcean ($200)**: Configured for deployment on **DigitalOcean App Platform** (`.do/app.yaml`) backed by a **DigitalOcean GPU Droplet** running Ollama `gemma3:4b` (`deploy/digitalocean-gpu-ollama.sh`).
- **Best Use of a `.tech` Domain ($100)**: Configured for **`realitycompiler.tech`** as the primary custom domain in `.do/app.yaml` and the API health manifest.
- **Best Use of MongoDB Atlas ($100)**: Stores, indexes, and searches compiled `RoomGraph` documents in **MongoDB Atlas** (`server/atlasStore.ts`, `roomgraphs` collection with text search across furniture labels and epistemic states).
- **Best Use of Sentry Agent Tracing ($100)**: Tracks every compile execution (`server/sentryAgentTracer.ts`) with OpenTelemetry GenAI spans (`vision.calibrate`, `ai.run.gemma3`, `compiler.uncertainty_solver`, `db.mongodb.upsert`), recording latency waterfalls and prompt/completion token counts—and renders a live **Sentry Agent Trace Waterfall** inside the UI.
- **Best Use of Entire ($100)**: Recorded our architecture and prompt engineering checkpoints in `entire-session/devrelay-session.json` and embedded an interactive **Entire / DevRelay Session Inspector** in the studio UI explaining *why* we chose epistemic uncertainty bands over 3D meshes.
- **Best Use of GitHub Copilot ($100)**: Includes `.github/copilot-instructions.md` enforcing epistemic uncertainty invariants and `.github/workflows/ci.yml` gating every PR with TypeScript, unit tests, and bundle verification.
- **Best Use of TabPFN ($200)**: Uses RoomGraph's tabular logistics export (volume CBM, weight kg, disassembly flags, and epistemic uncertainty counts) to compute P10/P50/P90 moving cost quantiles and CSV manifests.
