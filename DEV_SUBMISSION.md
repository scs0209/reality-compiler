---
title: "Reality Compiler: Gemma 3 Turns a Room Photo into Data You Can Check, Including What It Can't See"
published: false
tags: devchallenge, hf26challenge, ai, opensource
---

<!--
BEFORE YOU PUBLISH. This comment is not rendered on DEV; delete it when you are done.

Open items. The post does not claim anything that is still unverified:
1. Code link: done. The repo is public at https://github.com/scs0209/reality-compiler (MIT) and the link is
   under "Code". Two things to decide before you publish: the default branch is still feat/real-gemma-sentry-tracing
   while main holds the first commit, so visitors land on the feature branch; and the history still contains the
   earlier prototype, whose canned telemetry and TabPFN labels were removed in the later commits. Pushes also run
   Entire's pre-push hook, which uploads session logs, so skip hooks (git push with the no-verify flag) unless you
   mean to share them, and keep HANDOFF.md out of anything you push (a local entire/* branch contains it).
2. Live demo: nothing is deployed that I could check. Add a URL only after opening it yourself.
   Add screenshots or a short video of real runs under "Demo".
3. Real photos: every successful run so far used a diagram image, not a photograph. Run 3 to 5 real room
   photos, then add what you saw to "Demo" and update "Limitations".
4. Prize categories: only Gemma is enabled. The READY-TO-ENABLE blocks at the bottom each say what must be true first.
5. Agent session: none is shared yet. entire-session/devrelay-session.json is not an export from Entire or DevRelay
   and its content is out of date, so do not link it. Add "My Agent Session" with a real link.
6. Sentry: traces were checked only against a local stand-in for Sentry's ingest endpoint. Set a real SENTRY_DSN,
   run a few compiles, and look at the trace in Sentry (including its AI Agents view) before claiming anything.
7. MongoDB Atlas: implemented but never connected to a real cluster.
8. Rules from the challenge page: submissions close 2026-10-18 11:59 PM PDT (2026-10-19 15:59 KST);
   non-English posts are not eligible for prizes; the page header also showed a "Live / Ended" status, so
   confirm the challenge is still open.
-->

*This is a submission for the [Hacktoberfest Open-Source AI Challenge: Week 2 (Side Hustle)](https://dev.to/challenges/hacktoberfest-week2-2026-10-12).*

## What I Built

Reality Compiler turns **one photo of a room** into a **RoomGraph**: JSON that other tools can read, not a picture to look at.

Most photo-to-room tools aim for a smooth 3D mesh. A mesh looks equally sure of itself everywhere, including behind the bed, where the camera saw nothing. If the next question is "will this sofa get through that door?", that false confidence is the expensive part.

So the output is data with its doubt attached:

- **Every object says how it is known.** Each node is `observed` (its floor corners were visible), `inferred` (partly hidden, or sized from a standard-furniture prior) or `occluded_prior` (in a blind spot, deduced from context). It also carries a confidence and a ±cm band on position and size.
- **A moving what-if check runs on top of that.** It evaluates the layout twice: with the nominal numbers, and with every error band pushed the wrong way. It reports `DOOR_BOTTLENECK`, `OBJECT_COLLISION`, `OUT_OF_BOUNDS` and `UNCERTAINTY_OVERFLOW`, so a 2 cm gap that could really be negative becomes "measure this one gap with a tape measure" instead of a green tick.
- **A workbench to look at it.** A 2D top-down blueprint (drag, rotate by 90°, drop in a King bed or a washer-dryer to test), a 3D view (Three.js) where observed objects are solid, inferred ones see-through and occluded ones ghosted, with dashed ±cm uncertainty shells, and where you can drag objects across the floor, JSON and CSV export, and an English/Korean UI.
- **A rough moving quote.** It is a hand-written formula over volume, weight and disassembly count, with a wider upper bound when many objects are inferred. It is not machine learning, and the P10/P90 values are heuristic spreads, not calibrated quantiles.

One node of the output looks like this (trimmed; values are illustrative):

```json
{
  "id": "obj-1-queen-bed",
  "label": "Queen Bed",
  "epistemic": "inferred",
  "confidence": 0.82,
  "bbox2d": { "x": 0.10, "y": 0.40, "w": 0.30, "h": 0.30 },
  "footprint": { "xCm": 20, "yCm": 30, "widthCm": 154, "depthCm": 206, "heightCm": 70, "rotationDeg": 0 },
  "uncertainty": {
    "posPlusMinusCm": 8,
    "dimPlusMinusCm": 10,
    "reason": "Headboard hidden by the duvet; sized from a standard-queen prior"
  }
}
```

### The side hustle

The idea is for people who plan moves or furniture deliveries without visiting the room: a small moving crew pricing a studio from a customer's photo, or a tenant asking "does the 140 cm standing desk still fit if I rotate it?". I haven't put it in front of a real customer, so treat that as a hypothesis, not a result.

## Demo

It runs locally. You need Node 20 or newer and [Ollama](https://ollama.com).

```bash
npm install
ollama pull gemma3:4b
npm run dev
```

Then open the Vite URL it prints (`http://127.0.0.1:5173` by default), upload a PNG, JPEG or WebP, set the reference object (a 210 cm door frame by default) and wait. On my Mac a compile takes about 50 seconds, and about 90 seconds when Gemma's first answer is rejected and it gets a second try.

If Gemma can't produce a usable answer, the app does not pretend. It shows a bundled sample room under an amber banner that says it is **not your photo** and why, and it does not save that result automatically. The three rooms in the sidebar are hand-authored samples, labelled as such; loading one does not call a model.

## Code

Repository: [github.com/scs0209/reality-compiler](https://github.com/scs0209/reality-compiler)

Stack: TypeScript, React, Vite, Tailwind, Three.js, Express, Zod, Vitest, Ollama. The code is MIT-licensed; Gemma is not part of the repo and stays under Google's Gemma Terms of Use.

- `shared/roomGraphSchema.ts`: the `roomgraph.v1.2` schema.
- `server/gemmaCompiler.ts`: the Ollama call, the retry, and the fallback.
- `server/gemmaScene.ts`: the prompt, the JSON Schema given to Ollama, validation of Gemma's answer, and edge derivation.
- `shared/spatialEngine.ts`: the what-if checks and the quote formula.
- `server/sentryAgentTracer.ts`: tracing (optional, see below).
- `tests/`: 22 tests. Ollama is mocked, and Sentry's outgoing envelopes are intercepted to check what would be sent.

## How I Built It

**Schema first.** `roomgraph.v1.2` is a Zod schema, and every graph, whether it comes from Gemma or a sample, has to pass it.

**Ask the model for less.** A 4B model is not a surveyor. Gemma gets the photo, a reference object of known size, and a JSON Schema that Ollama uses to constrain decoding. It returns the room size, the objects, the openings and the blind spots. Everything else is code: ids, the relations between objects (derived from footprint geometry), and the epistemic counts.

**Don't trust the model's own confidence.** An object marked `inferred` is capped at 0.85 and an `occluded_prior` one at 0.6, however sure Gemma sounds, and the number of capped objects is recorded.

**A failure that looks like a success is worse than a failure.** A rejected answer is retried once with the validation error in the prompt. If that fails too, the user sees the sample room and the reason. An earlier version of this project returned canned sample data with made-up token counts when the model wasn't reachable. I deleted all of that. Token counts now come from Ollama, and durations are measured.

**What broke.**

- *Photo boxes.* Gemma copied the footprint's centimetre values into the field for the box around the object in the photo, so the boxes came out with zero area and, in the failing runs, every object was thrown away. I changed that field to integer corners from 0 to 1000 with the range enforced in the schema, and an unusable box now just means "no box" instead of "no object". After that, the first attempt succeeded in my runs.
- *Placement.* Gemma still places some objects outside the room it just described, even when told not to. I couldn't prompt that away. The number is recorded, and the what-if check flags it as `OUT_OF_BOUNDS`.

**Optional integrations.** With `SENTRY_DSN` set, each compile is sent to Sentry as a `gen_ai.invoke_agent` trace: one span for the preflight check, one for each Gemma request (with Ollama's real input and output token counts), one for validation and one for the save. Photos, file names and prompt text are never attached. Without a DSN nothing is sent, and the header and `/api/health` say "not sending". With `MONGODB_URI` set, compiled RoomGraphs are stored in MongoDB Atlas; note that this includes the source photo, so it is an explicit opt-in.

## Why Does Open Innovation Matter?

- **Photos of your home are private.** With `gemma3:4b` running locally through Ollama, the photo stays on your machine. That changes if you point the app at a remote Ollama or turn on Atlas storage, and both are your choice.
- **Open weights let the whole pipeline run on one machine.** A pinned model, schema-constrained decoding and no network dependency make "validate it, retry once, show the failure" cheap enough to do on every photo.
- **The trade-off is speed.** There is no per-photo API bill, but a compile takes about a minute on my Mac. That suits "check before moving day", not interactive editing.
- **Be precise about "open".** Gemma is open-weight under Google's own terms, not open source in the OSI sense. The model name is a config value (`GEMMA_MODEL`), but I have only tested `gemma3:4b`.

## Limitations

- Every successful run so far used a diagram image, not a photograph, and Gemma mislabelled some objects in it. I have not yet measured how it does on real photos.
- Gemma's geometry from a single photo is rough, which is why every object carries a label and a ±cm band.
- There is no pixel-level calibration. The scale comes from Gemma's estimate using the reference object, and the app shows `px/cm: n/a` rather than inventing a ratio.
- The moving quote is a formula, not a learned model.

## Prize Categories

**Best Use of Gemma ($200).** `gemma3:4b` runs locally through Ollama and is the only source of the objects, sizes and epistemic labels in a compiled RoomGraph. Its answer is requested with a JSON Schema, validated against the RoomGraph schema, retried once on failure, and replaced by a clearly labelled sample if it still fails. The code is in `server/gemmaCompiler.ts` and `server/gemmaScene.ts`.

<!--
READY-TO-ENABLE. Move a block above this comment only once its condition is true.
Anything you cannot show in the post should stay out.

**Best Use of DigitalOcean ($200).** [Enable when the app is really deployed on App Platform and/or a GPU Droplet running Ollama, and you have opened the URL. The spec is .do/app.yaml and the Droplet script is deploy/digitalocean-gpu-ollama.sh. Neither has been verified. Review the script first: it binds Ollama to 0.0.0.0, so a firewall or VPC-only access is required.]

**Best Use of a .tech Domain ($100).** [Enable when the project is live on a .tech domain you claimed through Hacktoberfest. The challenge page asks for that; realitycompiler.tech appears in .do/app.yaml but is not verified.]

**Best Use of MongoDB Atlas ($100).** [Enable when MONGODB_URI points at a real cluster and /api/health reports Atlas as connected. Code: server/atlasStore.ts, with a text index over titles and labels.]

**Best Use of Sentry Agent Tracing ($100).** [Enable when you have run compiles against a real Sentry project and put a trace screenshot in this post. Code: server/sentryAgentTracer.ts.]

**Best Use of Entire ($100).** [Enable when you have shared a real agent session in this post under "My Agent Session".]

**Best Use of GitHub Copilot ($100).** [Enable only if you actually built the project with Copilot's coding agent, CLI or app. The repo has .github/copilot-instructions.md and a CI workflow, but that is not the same thing.]
-->
