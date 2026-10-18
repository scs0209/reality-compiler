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
3. Real photos: five room images went through the app's pipeline with two models (see "Which Gemma?"). Four are
   CC0 files from Wikimedia Commons and are credited in the post. The fifth is a bedroom photo you downloaded
   (images.jpeg) whose source and licence I do not know: do not show it, or screenshots of its result, in the post
   or the video. Use a photo you own or can license instead. The app screenshots in the post
   (docs/post-images/app) come from the CC0 dorm-room photo. Still to add: a short video of a real run under "Demo".
4. Prize categories: only Gemma is enabled. The READY-TO-ENABLE blocks at the bottom each say what must be true first.
5. Agent session: none is shared yet. entire-session/devrelay-session.json is not an export from Entire or DevRelay
   and its content is out of date, so do not link it. "My Agent Session" is written (seven moments with my prompts in
   English). The seven cut files are in entire-moments/ (local only, not in git): they hold only the conversation
   (prompts, replies, written reasoning), each with the Korean original and the English translation under it, and
   no tool calls, tool output or local paths. Upload each file to DevRelay as its own session, then replace each bold
   "[EMBED n of 7]" line with the agent_session tag and that session's id (one file per session, so no range is
   needed). Recount the Entire trailers in the first paragraph.
6. Sentry: done. Six real compiles were sent (HTTP 200, no failures) and three screenshots from Sentry's Agents view
   and trace details are in the post (docs/post-images/sentry). The Sentry project also holds unrelated issues from
   another app: do not screenshot its Issues feed or the project switcher.
7. MongoDB Atlas: done. Connected to a real cluster (11 documents); the post shows the app's Atlas tab and two screenshots of the
   roomgraphs collection in Atlas itself (docs/post-images/app/07 and 08, cropped so the organisation name is not visible).
   The MongoDB entry in "Prize Categories" is live. The Entire entry still needs the DevRelay embeds in "My Agent Session".
   Stored documents include the source photo.
8. Rules from the challenge page: submissions close 2026-10-18 11:59 PM PDT (2026-10-19 15:59 KST);
   non-English posts are not eligible for prizes; the page header also showed a "Live / Ended" status, so
   confirm the challenge is still open.
9. Comparison figure: docs/post-images/model-comparison.jpg (credits in docs/post-images/CREDITS.md). The post
   links it through raw.githubusercontent.com on the feature branch, so the image shows up only after you commit and
   push it, and it breaks if the branch is renamed or deleted. After pushing, either pin the URL to a commit SHA, or
   drag the file into the DEV editor to host it there and replace the URL. Do not add the bedroom photo (unknown
   licence) to the repo or the post.
-->

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12)*

## What I Built

Reality Compiler turns **one photo of a room** into a **RoomGraph**: JSON that other tools can read, not a picture to look at.

Most photo-to-room tools aim for a smooth 3D mesh. A mesh looks equally sure of itself everywhere, including behind the bed, where the camera saw nothing. If the next question is "will this sofa get through that door?", that false confidence is the expensive part.

![The 3D view of a real compile: a dorm room with a bed, wardrobe, desk, chair and bedside table, solid volumes for observed objects and dashed ones for inferred objects, each with a plus-or-minus centimetre shell](https://raw.githubusercontent.com/scs0209/reality-compiler/feat/real-gemma-sentry-tracing/docs/post-images/app/01-3d-view.jpg)

This is a real compile of a CC0 dorm-room photo ("Single dorm room, UVA.jpg" on Wikimedia Commons) with `gemma3:4b`, shown in the app's 3D view. Solid volumes are observed, dashed ones are inferred, and every object has its ±cm shell.

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
  "bbox2d": null,
  "footprint": { "xCm": 20, "yCm": 30, "widthCm": 154, "depthCm": 206, "heightCm": 70, "rotationDeg": 0 },
  "uncertainty": {
    "posPlusMinusCm": 8,
    "dimPlusMinusCm": 10,
    "reason": "Headboard hidden by the duvet; sized from a standard-queen prior"
  }
}
```

A real node from the dorm-room compile, as the app's JSON tab shows it:

![One node of the real RoomGraph JSON: the bed with epistemic inferred, confidence 0.85, bbox2d null and its footprint](https://raw.githubusercontent.com/scs0209/reality-compiler/feat/real-gemma-sentry-tracing/docs/post-images/app/04-roomgraph-json.jpg)

And the same bed in the inspector. Gemma had placed it outside the room, so the code moved it 20 cm inside, took it from observed to inferred and wrote the move into its reason. Its position is a guess, not a reading.

![The scene inspector for the bed: inferred, 85 percent confidence, plus-or-minus 20 cm on position, and the reason that says the model placed it outside the room and it was moved 20 cm to fit inside](https://raw.githubusercontent.com/scs0209/reality-compiler/feat/real-gemma-sentry-tracing/docs/post-images/app/02-inspector-moved-bed.jpg)

### The side hustle

The idea is for people who plan moves or furniture deliveries without visiting the room: a small moving crew pricing a studio from a customer's photo, or a tenant asking "does the 140 cm standing desk still fit if I rotate it?". I haven't put it in front of a real customer, so treat that as a hypothesis, not a result.

## Demo

![An 11-step walkthrough of one real compile: upload a dorm-room photo, gemma3:4b compiles it in 48 seconds, the RoomGraph appears as a 3D room, the inspector shows the bed as inferred and moved 20 cm into the room, the what-if verifier flags collisions, then the JSON, the Sentry trace and the MongoDB Atlas tab](https://raw.githubusercontent.com/scs0209/reality-compiler/feat/real-gemma-sentry-tracing/docs/post-images/app/demo.gif)

The GIF is one real compile of a CC0 dorm-room photo with `gemma3:4b` on my Mac. It is stitched from screenshots taken during that run, not a continuous screen recording, and the 48 s wait is cut. The captions say what each step shows.

It runs locally. You need Node 20 or newer and [Ollama](https://ollama.com).

```bash
npm install
ollama pull gemma3:4b
npm run dev
```

Then open the Vite URL it prints (`http://127.0.0.1:5173` by default), upload a PNG, JPEG or WebP, set the reference object (a 210 cm door frame by default) and wait. On my Mac a compile takes 40 to 50 seconds, and 90 to 110 seconds when Gemma's first answer is rejected and it gets a second try.

If Gemma can't produce a usable answer, the app does not pretend. It shows a bundled sample room under an amber banner that says it is **not your photo** and why, and it does not save that result automatically. The three rooms in the sidebar are hand-authored samples, labelled as such; loading one does not call a model.

### What a compile gives you

The source photo stays next to the result at its own aspect ratio. Compiled rooms get no object boxes, because `gemma3:4b` could not place them, and the panel says so instead of drawing guesses.

![The source photo panel for the dorm-room compile, with a note that no object boxes are drawn because the vision model is not asked to locate objects](https://raw.githubusercontent.com/scs0209/reality-compiler/feat/real-gemma-sentry-tracing/docs/post-images/app/03-evidence-photo.jpg)

The moving what-if check runs on the same graph. Here the nominal layout is blocked by a desk and chair that overlap by 10 cm, and the worst-case run adds the gaps that look fine but could be wrong: the desk and the bedside table touch at 0 cm, with a combined uncertainty of ±46 cm.

![The what-if verifier: nominal geometry blocked by a collision, worst-case uncertainty collision, and a list of alerts such as OBJECT_COLLISION and UNCERTAINTY_OVERFLOW with a note to verify one gap with a tape measure](https://raw.githubusercontent.com/scs0209/reality-compiler/feat/real-gemma-sentry-tracing/docs/post-images/app/05-whatif-verifier.jpg)

## Code

Repository: [github.com/scs0209/reality-compiler](https://github.com/scs0209/reality-compiler)

Stack: TypeScript, React, Vite, Tailwind, Three.js, Express, Zod, Vitest, Ollama. The code is MIT-licensed; Gemma is not part of the repo and stays under Google's Gemma Terms of Use.

- `shared/roomGraphSchema.ts`: the `roomgraph.v1.2` schema.
- `server/gemmaCompiler.ts`: the Ollama call, the retry, and the fallback.
- `server/gemmaScene.ts`: the prompt, the JSON Schema given to Ollama, validation of Gemma's answer, and edge derivation.
- `shared/spatialEngine.ts`: the what-if checks and the quote formula.
- `server/sentryAgentTracer.ts`: tracing (optional, see below).
- `tests/`: 33 tests. Ollama is mocked, and Sentry's outgoing envelopes are intercepted to check what would be sent.

## How I Built It

**Schema first.** `roomgraph.v1.2` is a Zod schema, and every graph, whether it comes from Gemma or a sample, has to pass it.

**Ask the model for less.** A 4B model is not a surveyor. Gemma gets the photo, a reference object of known size, and a JSON Schema that Ollama uses to constrain decoding. It returns the room size, the objects, the openings and the blind spots. Everything else is code: ids, the relations between objects (derived from footprint geometry), and the epistemic counts.

**Don't trust the model's own confidence.** An object marked `inferred` is capped at 0.85 and an `occluded_prior` one at 0.6, however sure Gemma sounds, and the number of capped objects is recorded.

**A failure that looks like a success is worse than a failure.** A rejected answer is retried once with the validation error in the prompt. If that fails too, the user sees the sample room and the reason. An earlier version of this project returned canned sample data with made-up token counts when the model wasn't reachable. I deleted all of that. Token counts now come from Ollama, and durations are measured.

**What broke.**

- *Photo boxes.* First Gemma copied the footprint's centimetre values into the box field, so every box had zero area. I fixed the wording, but on a real room photo the boxes then landed in the top-left corner of the photo, or on the wrong object (the bed's box over the window, a chair's box over a shelf), whether I asked for 0 to 1000 or for pixels. That was one photo, not a benchmark, but it was enough: the model is no longer asked for boxes. Compiled rooms have none, the UI says so, and only the hand-authored samples draw boxes on their photo.
- *Placement.* Gemma also places objects outside the room it just described, even when told not to. On that same photo it put a 280 cm bed 300 cm from the west wall of a 360 cm room. I couldn't prompt that away, so the code moves such an object back inside, marks it `inferred` with a wider ± band, and writes the move into its reason. Its position is a guess, not a reading. The number of moved objects is recorded in the trace.
- *A range check that doubled the run time.* `gemma3:4b` writes the ceiling height in millimetres: 2700 and 2400 for 270 cm and 240 cm ceilings. My validation rejected anything above 600 cm, so two of my five test photos were thrown away and asked again, taking 107.8 s and 90.6 s instead of about 45. The ceiling height only sets the wall height in the views, so it is now corrected instead of rejected: 1800 to 6000 is read as millimetres, any other value outside 180 to 600 cm is clamped, and each correction is recorded in the trace (`gemma.ceiling_height_adjusted`). The same two photos now pass on the first attempt, in 46.2 s and 40.0 s. Room width and depth keep their strict checks, because a "corrected" room size would just be a wrong one.

**Which Gemma?** The newer Gemma 4 exists, and `gemma4:e4b` (6.6 GB in Ollama, shipped with an Apache 2.0 licence file) fits on my 16 GB Mac, so I ran the same five room images through both models: same prompt, same schema, temperature 0, one run each.

| | `gemma3:4b` | `gemma4:e4b` |
|---|---|---|
| Time per photo | 40 to 51 s | 107 to 120 s |
| Output tokens per attempt | 1.2k to 1.4k | 2.4k to 2.9k |
| Photos that ended in a usable RoomGraph | 5 of 5 | 4 of 5 |
| Objects the model placed outside the room | 4 of 28 | 2 of 20 |

On the four photos where both finished, that last row is 3 of 22 against 2 of 20. Gemma 4 failed on the busiest room (a dining area with a shelving unit): both attempts ran into the 3,500-token output limit, so the app showed its sample room after 285 seconds.

![Four room images from Wikimedia Commons, each with the floor objects gemma3:4b and gemma4:e4b listed for it, plus time and the number of objects placed outside the room](https://raw.githubusercontent.com/scs0209/reality-compiler/feat/real-gemma-sentry-tracing/docs/post-images/model-comparison.jpg)

The figure shows the four images I can show, with what each model listed. The fifth, a bedroom photo, is in the table above but not in the figure (see below).

What I saw, judged by eye: Gemma 4 was better on a living room (sofa, armchair, TV console and three plants, missing only the floor lamp) and slightly cleaner on a 3D render. Gemma 3 was better on a bedroom (bed, chair, shelf, plant and stool, where Gemma 4 gave bed, nightstand, drawers and chair). Both found the bed, desk, chair and wardrobe in a dorm room. Both make mistakes: Gemma 3 called a cat a dog and listed a TV and a candle as floor objects; Gemma 4 returned Korean labels for one photo and `snake_case` names for another although the prompt asks for English names.

My reading: Gemma 4 E4B put fewer objects outside the room, but not by enough to matter in five photos, and it was about 2.4 times slower and less reliable on a busy room. The app keeps `gemma3:4b` as its default. I did not tune the prompt or raise the output limit for Gemma 4, so this compares one setup, not the models.

The limits of this test: five images, one run each, no labelled ground truth, so "right" and "wrong" are my own reading of each picture. One image is a 3D render, not a photograph, and a difference of one or two objects is noise at this size. It is not a benchmark. The bedroom photo is one I found online without recording its source or licence, so I don't show it here. The other four are CC0 files from Wikimedia Commons, credited here and in the figure although CC0 does not require it: "Single dorm room, UVA.jpg", "Living room (Unsplash).jpg", "The living room that needs houseplants.jpg", and "Living Room Interior Designer - Picker Online.jpg" (the 3D render). Authors and source pages are in `docs/post-images/CREDITS.md`.

**Optional integrations.** With `SENTRY_DSN` set, each compile is sent to Sentry as a `gen_ai.invoke_agent` trace: one span for the preflight check, one for each Gemma request (with Ollama's real input and output token counts), one for validation and one for the save. Photos, file names and prompt text are never attached. Without a DSN nothing is sent, and the header and `/api/health` say "not sending". With `MONGODB_URI` set, compiled RoomGraphs are stored in MongoDB Atlas; note that this includes the source photo, so it is an explicit opt-in.

Here is a normal `gemma3:4b` compile in Sentry. The whole run is 46.67 s and the model call is 46.58 s of it, about 99.8%. The Ollama preflight takes 13 ms, validation 3 ms and the Atlas save 40 ms, so the model is the only thing worth optimising.

![The Sentry waterfall of a gemma3:4b compile: gen_ai.invoke_agent of 46.67 seconds with a preflight, one gen_ai.chat span of 46.58 seconds, compiler.assemble and db.mongodb.upsert](https://raw.githubusercontent.com/scs0209/reality-compiler/feat/real-gemma-sentry-tracing/docs/post-images/sentry/04-gemma3-run-waterfall.jpg)

And the run that failed: `gemma4:e4b` on the busiest of my five rooms. Two `gen_ai.chat` spans of 2.26 and 2.20 minutes each ended at the 3.5k output-token limit, both answers were cut off, and the app fell back to its sample room after 4.45 minutes. Sentry's Agents view lists it with one error, and nothing was saved to Atlas.

![The Sentry waterfall of the failed gemma4:e4b run: two gen_ai.chat spans of about two minutes each, two compiler.assemble spans and then compiler.fallback_preset](https://raw.githubusercontent.com/scs0209/reality-compiler/feat/real-gemma-sentry-tracing/docs/post-images/sentry/02-failed-run-waterfall.jpg)

![Sentry's Agents view listing six compiles of the same test set, with root duration, errors, LLM calls and total tokens, and the failed run marked with one error](https://raw.githubusercontent.com/scs0209/reality-compiler/feat/real-gemma-sentry-tracing/docs/post-images/sentry/01-agents-six-traces.jpg)

And the saved-rooms list in the app, read back from the Atlas collection: the three sample rooms and the compiles stored there.

![The app's MongoDB Atlas tab: a search box, an upsert button and the list of saved rooms with their scene ids and object counts](https://raw.githubusercontent.com/scs0209/reality-compiler/feat/real-gemma-sentry-tracing/docs/post-images/app/06-atlas-saved-rooms.jpg)

And the collection in Atlas itself: 11 documents and 3 indexes (the default `_id`, a unique `sceneId` and the text index), with the three seeded sample rooms first.

![The roomgraphs collection in MongoDB Atlas: database reality_compiler, 11 documents, 3 indexes, and the first two seeded sample rooms as documents](https://raw.githubusercontent.com/scs0209/reality-compiler/feat/real-gemma-sentry-tracing/docs/post-images/app/07-atlas-roomgraphs-collection.jpg)

Opened on one stored compile, `compileMeta` holds the model that answered, its runtime and measured latency (46,634 ms) and the Sentry trace id, so a stored room can be matched to its trace. It is the same run as the first Sentry waterfall above.

![One stored compile in Atlas with compileMeta expanded: model gemma3:4b, runtime ollama-gemma3:4b, latencyMs 46634 and the Sentry trace id](https://raw.githubusercontent.com/scs0209/reality-compiler/feat/real-gemma-sentry-tracing/docs/post-images/app/08-atlas-compiled-document.jpg)

## Why Does Open Innovation Matter?

- **Photos of your home are private.** With `gemma3:4b` running locally through Ollama, the photo stays on your machine. That changes if you point the app at a remote Ollama or turn on Atlas storage, and both are your choice.
- **Open weights let the whole pipeline run on one machine.** A pinned model, schema-constrained decoding and no network dependency make "validate it, retry once, show the failure" cheap enough to do on every photo.
- **The trade-off is speed.** There is no per-photo API bill, but a compile takes 40 to 50 seconds on my Mac. That suits "check before moving day", not interactive editing.
- **Be precise about "open".** Gemma 3 is open-weight under Google's own terms, not open source in the OSI sense; the Gemma 4 build I tried ships with an Apache 2.0 licence file. The model name is a config value (`GEMMA_MODEL`). I compared `gemma3:4b` and `gemma4:e4b` on five images (see "Which Gemma?"), and the default and the demo use `gemma3:4b`.

## My Agent Session

I built this with Claude Code, and [Entire](https://entire.io) recorded the sessions and linked them to
commits: 14 of the repository's 15 commits carry an `Entire-Checkpoint:` trailer. The records are in a private repository because they also contain my
local paths and e-mail address. Entire kept two session records for this build; the second overlaps the
first and holds 42 of my prompts against 64 in the first.

My prompts were in Korean. Each heading below is my English translation, and the Korean original is under
it. The embedded sessions show only the conversation: my prompts, the agent's replies and its written
reasoning, each with the Korean original and my English translation under it. Tool calls and their output
are left out. I picked seven moments where something was decided or broke, including several where
something was wrong and had to be undone.

### 1. "Start with the real Gemma integration. Validate Ollama's structured output with RoomGraphSchema, say in the UI when it falls back, and remove the fake token and latency values."

> Gemma 실제 연동부터 시작해줘. Ollama 구조화 출력을 RoomGraphSchema로 검증해서 쓰고, 실패하면 폴백임을 UI에 명시해줘. 가짜 토큰·지연 값도 제거해줘. gemma3:4b 다운로드(ollama pull)는 허락해.

An earlier prototype of this project returned canned data with made-up token counts when the model was not
reachable. The agent replaced it with a real Ollama call that asks for JSON Schema output, validates the
answer against the RoomGraph schema, retries once with the validation error, and otherwise shows a
bundled sample room under a banner that says it is not your photo. Tokens now come from Ollama and durations
are measured. My next prompt asked for the same honesty from Sentry: real `gen_ai` spans, a real trace id,
and a header that says "not sending" when there is no DSN. The TabPFN labels went too, because the moving quote
is a hand-written formula and not a model.

Commit: [2f22321](https://github.com/scs0209/reality-compiler/commit/2f22321) "Wire Gemma and Sentry for real; drop fabricated telemetry and TabPFN claims"

**[EMBED 1 of 7] Upload `entire-moments/moment-1-real-gemma-and-sentry.jsonl` to DevRelay and replace this whole line with the agent_session tag for that session.**

### 2. "[Pasted: RoomGraph JSON / Sentry trace / MongoDB Atlas (4) / Entire CLI session] And on the page, I see why RoomGraph JSON is needed, but is there a reason for the others? On the dashboard."

> [붙여넣음: RoomGraph JSON / Sentry 트레이스 / MongoDB Atlas (4) / Entire CLI 세션] 그리고 페이지에서 RoomGraph JSON은 필요한거 알겠는데 나머지가 필요한 이유가 있어? 대시보드에서

The Sentry and Atlas tabs show real data from the compile, so they stayed. The Entire tab did not: it was
hand-written text with no connection to Entire, and it said the CLI was "active" while reading nothing from it.
It came out of the app, together with three toolbar chips that were always shown on wide screens (DigitalOcean,
a domain I do not own, and "Entire CLI tracked"). Entire belongs in this section of the post, not in the interface.

Commit: [416d025](https://github.com/scs0209/reality-compiler/commit/416d025) "Show the source photo at its own aspect ratio, say when there are no boxes, and drop the Entire tab"

**[EMBED 2 of 7] Upload `entire-moments/moment-2-dashboard-tabs.jsonl` to DevRelay and replace this whole line with the agent_session tag for that session.**

### 3. "No, why is the floor plan in the corner of the photo?"

> 아니 도면도가 왜 사진 구석탱이에 있어?

The agent read "floor plan" as the object boxes drawn over the photo, which sat in its top-left corner, and my
next prompt went along with that. Before touching any code it asked Gemma for one object's box in three
coordinate conventions and drew the answers on the photo; none was accurate. It then ran the full request
again with pixel coordinates: the boxes spread out but landed on the wrong objects (the bed's box over the
window, a chair's box over a shelf). So the display was faithful and the model could not point at objects.
I chose the option that stops asking:

> A로 진행해줘. 모델에게 bbox를 요청하지 말고 컴파일 결과의 bbox2d는 null로 두어서 오버레이·크롭이 사진에서 빠지게 해줘. 방 밖으로 나간 물체를 방 안으로 보정하는 것도 같이 해줘(보정된 물체는 inferred로 내리고 표시). 테스트도 추가해줘.

Translation: "Go with A. Don't ask the model for bboxes; leave bbox2d null in the compile result so the overlay and
the crop drop out of the photo. Also correct objects that went outside the room back inside (mark corrected
objects as inferred, shown as such). Add tests too."

Commit: [b01a9f3](https://github.com/scs0209/reality-compiler/commit/b01a9f3) "Stop asking Gemma for photo boxes, keep objects inside the room, and survive long answers"

**[EMBED 3 of 7] Upload `entire-moments/moment-3-boxes-in-the-corner.jsonl` to DevRelay and replace this whole line with the agent_session tag for that session.**

### 4. "Setting aside the photo being cropped, don't you feel the positions look odd in the picture with the floor plan?"

> 사진이 잘리는거랑 상관없이 도면이 있는 사진에 위치가 이상하다고 느끼지 않니?

The agent had just fixed the cropped photo panel and was explaining the box coordinates. I asked about the
layout itself, and it measured instead of agreeing: in my run 4 of 11 objects were outside the room the model had just described, and in two runs the
model put a bed starting 300 cm from the west wall of a 360 cm room, 220 to 240 cm outside it. That became
the repair step: move the object back inside, mark it inferred, widen its band and write the move into its
reason. The repair only stops impossible placements. It does not make a wrong position right.

Commit: [b01a9f3](https://github.com/scs0209/reality-compiler/commit/b01a9f3) (same commit as moment 3)

**[EMBED 4 of 7] Upload `entire-moments/moment-4-bed-outside-the-room.jsonl` to DevRelay and replace this whole line with the agent_session tag for that session.**

### 5. "Fix the problem where gemma3:4b's first attempt is rejected because of the ceiling height (over 600). Don't reject the whole answer for an out-of-range ceilingHeightCm; correct it into range and use it, and record how many times that happens. Add tests, and re-measure first-attempt success and time on the same photos."

> gemma3:4b 첫 시도가 천장 높이(600 초과) 때문에 거부되는 문제를 고쳐줘. 범위를 벗어난 ceilingHeightCm은 답 전체를 거부하지 말고 범위 안으로 보정해서 쓰고 그 횟수를 기록해줘. 테스트도 추가하고, 같은 사진 p0, p1로 첫 시도 성공과 시간을 다시 재줘.

The agent first printed what the model really wrote: 2700 and 2400, which are millimetres. Clamping to 600
would have turned a 270 cm ceiling into a 600 cm one, so a value from 1800 to 6000 is read as millimetres and
anything else out of range is clamped. Each correction is counted on the trace. The two test photos went from
107.8 s and 90.6 s (a second attempt each) to 46.2 s and 40.0 s on the first attempt. Putting the old range
check back made the new tests fail with the same error.

Commit: [c97f4f0](https://github.com/scs0209/reality-compiler/commit/c97f4f0) "Correct an out-of-range ceiling height instead of rejecting the whole answer"

**[EMBED 5 of 7] Upload `entire-moments/moment-5-ceiling-height.jsonl` to DevRelay and replace this whole line with the agent_session tag for that session.**

### 6. "First push with --no-verify and check that origin has 0 entire refs. Then I allow the gemma4:e4b download (about 6.6 GB). Compare it with gemma3:4b on 3 to 5 photos and report the number of objects outside the room, the time, and the object recognition."

> 먼저 --no-verify로 푸시하고 origin의 entire 참조 0개를 확인해줘. 그다음 gemma4:e4b(약 6.6GB) 다운로드를 허락할게. 사진 3~5장으로 gemma3:4b와 비교해서 방 밖 물체 수, 소요 시간, 객체 인식을 보고해줘.

I had one real photo, so the agent found four CC0 room images on Wikimedia Commons and asked before
downloading them. One earlier candidate turned out to be a portrait and not a room, and it was deleted unused.
On five images Gemma 4 E4B put fewer objects outside the room (2 of 20 against 4 of 28), but it was about
2.4 times slower and failed on the busiest room, so `gemma3:4b` stays the default. The post says what the test
cannot show: five images, one run each, my own judgement of what was right.

Commit: [bd3dbb5](https://github.com/scs0209/reality-compiler/commit/bd3dbb5) "Add the model comparison, photo credits and agent-session slots to the DEV draft"

**[EMBED 6 of 7] Upload `entire-moments/moment-6-gemma3-vs-gemma4.jsonl` to DevRelay and replace this whole line with the agent_session tag for that session.**

### 7. "No, I'm saying the image has to be visible, not a path! How did you write the post?" and "Shouldn't our project's images be visible?"

> 아니 경로를 넣는게 아니라 이미지가 보여야된다니까? 너 글을 어떻게 작성한거야
>
> 우리 프로젝트 이미지가 보여야되는거 아님?

Two mistakes of the agent's. The post linked its comparison figure through a `raw.githubusercontent.com` address
that returned 404 until the file was pushed, and the post had no picture of the app itself, only a figure of
other people's photos. The agent pushed (hooks skipped, so no Entire checkpoint reached the public
repository), opened every image address to check it, and added five screenshots of a real compile plus the
Sentry captures. It had offered a relative path first, which would have looked right in a preview and
broken on DEV.

Commit: [d1ed312](https://github.com/scs0209/reality-compiler/commit/d1ed312) "Show the app itself in the DEV draft: screenshots of a real compile and of Sentry"

**[EMBED 7 of 7] Upload `entire-moments/moment-7-show-the-project.jsonl` to DevRelay and replace this whole line with the agent_session tag for that session.**

<!--
TEMPLATE POSITION. The challenge template puts "My First User" right after "My Agent Session", then "Prize Categories".
Move this block out of the comment only when it is real.

## My First User

[One real person who uploaded a room photo, and what they said. Ask them first and leave out anything that
identifies them.]
-->

## Limitations

- I have tried five room images, one run each, one of them a 3D render. Gemma gets a broad inventory of the room right more often than the layout: positions and sizes are rough, and it mislabelled a cat as a dog and listed a TV and a candle as floor objects. That is not a benchmark, and the app puts no photo boxes on compiled rooms because the model could not place them.
- Gemma's geometry from a single photo is rough, which is why every object carries a label and a ±cm band.
- There is no pixel-level calibration. The scale comes from Gemma's estimate using the reference object, and the app shows `px/cm: n/a` rather than inventing a ratio.
- The moving quote is a formula, not a learned model.

## Prize Categories

**Best Use of Gemma ($200).** `gemma3:4b` runs locally through Ollama and is the only source of the objects, sizes and epistemic labels in a compiled RoomGraph. Its answer is requested with a JSON Schema, validated against the RoomGraph schema, retried once on failure, and replaced by a clearly labelled sample if it still fails. The code is in `server/gemmaCompiler.ts` and `server/gemmaScene.ts`.

**Best Use of Sentry Agent Tracing ($100).** Every compile is one `gen_ai.invoke_agent` trace: a span for the Ollama preflight, one `gen_ai.chat` span per Gemma request with the model name and Ollama's real input and output token counts, one for validation and one for the Atlas save. No prompt or photo is attached. The screenshots above are from real runs against a real Sentry project. A normal `gemma3:4b` compile is about 47 s with the model call 99.8% of it, and the `gemma4:e4b` run on the busiest room shows two attempts of about 2.2 minutes that each hit the 3.5k output-token limit before the app fell back to its sample room. The code is in `server/sentryAgentTracer.ts`.

**Best Use of MongoDB Atlas ($100).** Atlas is the data layer behind the app. Every compile is saved as one document in the `roomgraphs` collection of a real Atlas cluster, keyed by a unique `sceneId`, and the saved-rooms list in the app is read back from it; the three sample rooms are seeded there too. A text index over titles and labels exists, but the app's search still filters in code, so I do not claim Atlas search. Documents include the source photo, so storing in Atlas is opt-in through `MONGODB_URI`; without it the header says "memory only". The code is in `server/atlasStore.ts`.

**Best Use of Entire ($100).** Entire recorded the Claude Code sessions behind this build and linked them to commits: 14 of the repository's 15 commits carry an `Entire-Checkpoint:` trailer. The records are in a private repository. Seven moments of them are embedded under "My Agent Session", with the dialogue translated into English.

<!--
READY-TO-ENABLE. Move a block above this comment only once its condition is true.
Anything you cannot show in the post should stay out.

**Best Use of DigitalOcean ($200).** [Enable when the app is really deployed on App Platform and/or a GPU Droplet running Ollama, and you have opened the URL. The spec is .do/app.yaml and the Droplet script is deploy/digitalocean-gpu-ollama.sh. Neither has been verified. Review the script first: it binds Ollama to 0.0.0.0, so a firewall or VPC-only access is required.]

**Best Use of a .tech Domain ($100).** [Enable when the project is live on a .tech domain you claimed through Hacktoberfest. The challenge page asks for that; realitycompiler.tech appears in .do/app.yaml but is not verified.]



**Best Use of GitHub Copilot ($100).** [Enable only if you actually built the project with Copilot's coding agent, CLI or app. The repo has .github/copilot-instructions.md and a CI workflow, but that is not the same thing.]
-->
