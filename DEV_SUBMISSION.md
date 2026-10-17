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
4. **Rule-Based Moving Quote Estimate (P10 / P50 / P90 range)**: Converts the compiled RoomGraph into a logistics manifest (CBM volume, kg weight, disassembly count, and occluded-item risk buffer) and applies a hand-written formula to estimate truck size and a moving cost range. P50 is the formula output; P10/P90 are heuristic spreads (P90 widens with the number of Inferred/Occluded items), not calibrated statistical quantiles. No trained model such as TabPFN is used.

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

- **Best Use of Gemma ($200)**: Runs Google's open-weight **`gemma3:4b`** vision model locally through Ollama (`server/gemmaCompiler.ts`). One call per photo, constrained by a JSON Schema (structured output): the user's calibration reference (e.g. a 210×82cm door frame) goes in the prompt, and Gemma returns the room size, objects with metric footprints, photo boxes, epistemic status and uncertainty bands. The answer is validated against `RoomGraphSchema` (`server/gemmaScene.ts`); edges and summaries are derived in code, a rejected answer is retried once with the validation error, and if it still fails the UI says plainly that it is showing a sample room, not the photo. Gemma's geometry from a single photo is rough, which is exactly why every object carries an `Observed` / `Inferred` / `Occluded Prior` label and a ±cm band.
- **Best Use of DigitalOcean ($200)**: Configured for deployment on **DigitalOcean App Platform** (`.do/app.yaml`) backed by a **DigitalOcean GPU Droplet** running Ollama `gemma3:4b` (`deploy/digitalocean-gpu-ollama.sh`).
- **Best Use of a `.tech` Domain ($100)**: Configured for **`realitycompiler.tech`** as the primary custom domain in `.do/app.yaml` and the API health manifest.
- **Best Use of MongoDB Atlas ($100)**: Stores, indexes, and searches compiled `RoomGraph` documents in **MongoDB Atlas** (`server/atlasStore.ts`, `roomgraphs` collection with text search across furniture labels and epistemic states).
- **Best Use of Sentry Agent Tracing ($100)**: Every compile (`server/sentryAgentTracer.ts`) is a Sentry `gen_ai.invoke_agent` trace with child spans for the Gemma request (`gen_ai.chat`, with Ollama's real input/output token counts and model), `compiler.assemble` and `db.mongodb.upsert`, all with measured durations. A failed or retried Gemma call shows up as its own span (error status when it falls back to the sample room). Room photos, file names and prompt text are never attached to spans. The app shows the same spans in a waterfall, and the header and `/api/health` say plainly when Sentry is not sending (no `SENTRY_DSN`).
- **Best Use of Entire ($100)**: Recorded our architecture and prompt engineering checkpoints in `entire-session/devrelay-session.json` and embedded an interactive **Entire / DevRelay Session Inspector** in the studio UI explaining *why* we chose epistemic uncertainty bands over 3D meshes.
- **Best Use of GitHub Copilot ($100)**: Includes `.github/copilot-instructions.md` enforcing epistemic uncertainty invariants and `.github/workflows/ci.yml` gating every PR with TypeScript, unit tests, and bundle verification.