import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomGraphSchema } from '../shared/roomGraphSchema';
import { PRESET_ROOMS } from '../shared/presetRooms';
import { getRoomGraphById } from '../server/atlasStore';
import { compileRoomPhoto } from '../server/gemmaCompiler';
import { getSentryStatus } from '../server/sentryAgentTracer';
import {
  assembleRoomGraph,
  fitFootprintIntoRoom,
  normalizeCeilingHeightCm,
  parseGemmaScene,
} from '../server/gemmaScene';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const object = (over: Record<string, unknown> = {}) => ({
  label: 'Queen Bed',
  labelKo: '퀸 침대',
  category: 'furniture',
  epistemic: 'observed',
  confidence: 0.9,
  evidence: 'Three floor corners and the headboard are visible.',
  footprint: { xCm: 20, yCm: 30, widthCm: 154, depthCm: 206, heightCm: 70, rotationDeg: 0 },
  uncertainty: { posPlusMinusCm: 4, dimPlusMinusCm: 5, reason: 'Duvet overhang' },
  movable: true,
  weightKgEst: 60,
  disassemblyRequired: true,
  ...over,
});

const validScene = () => ({
  room: {
    widthCm: 340,
    depthCm: 410,
    ceilingHeightCm: 235,
    uncertaintyCm: 8,
    scaleConfidence: 0.7,
    perspectiveTiltDeg: 3,
  },
  objects: [
    object(),
    object({
      label: 'Floor Lamp',
      footprint: { xCm: 176, yCm: 30, widthCm: 30, depthCm: 30, heightCm: 160, rotationDeg: 0 },
      bbox2d: { x1: 600, y1: 200, x2: 650, y2: 600 },
    }),
  ],
  openings: [
    {
      kind: 'entry_door',
      label: 'Entry door',
      wall: 'south',
      offsetCm: 200,
      widthCm: 82,
      heightCm: 210,
      epistemic: 'observed',
      confidence: 0.9,
    },
  ],
  blindSpots: [
    { regionDescription: 'Behind the bed', riskLevel: 'medium', recommendation: 'Measure the gap' },
  ],
});

interface Stub {
  tags?: unknown | Error;
  chat: (call: number, body: any) => Response | Error;
}

function stubOllama({ tags = { models: [{ name: 'gemma3:4b' }] }, chat }: Stub) {
  let chatCalls = 0;
  const calls: { url: string; body?: any }[] = [];
  const fetchMock = vi.fn(async (input: unknown, init?: { body?: string }) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    if (url.endsWith('/api/tags')) {
      if (tags instanceof Error) throw tags;
      return new Response(JSON.stringify(tags), { status: 200 });
    }
    if (url.endsWith('/api/chat')) {
      const out = chat(++chatCalls, body);
      if (out instanceof Error) throw out;
      return out;
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, chatCalls: () => calls.filter((c) => c.url.endsWith('/api/chat')) };
}

const chatReply = (content: string, prompt = 1234, completion = 567) =>
  new Response(
    JSON.stringify({
      model: 'gemma3:4b',
      message: { content },
      prompt_eval_count: prompt,
      eval_count: completion,
    }),
    { status: 200 }
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('parseGemmaScene', () => {
  it('drops invalid objects, clamps confidence and caps overclaimed confidence', () => {
    const { scene, stats } = parseGemmaScene({
      ...validScene(),
      objects: [
        object({ confidence: 1.4 }), // out of range
        object({
          label: 'Mini Fridge',
          epistemic: 'occluded_prior',
          confidence: 0.95, // overclaim for a blind-spot object
        }),
        object({ label: 'Broken', footprint: { xCm: 0, yCm: 0, widthCm: -5, depthCm: 10, heightCm: 10 } }),
      ],
    });

    expect(stats.objectsReturned).toBe(3);
    expect(stats.objectsKept).toBe(2);
    expect(scene.objects[0].confidence).toBe(1);
    expect(stats.fieldsNormalized).toBe(1);
    expect(scene.objects[1].confidence).toBe(0.6);
    expect(stats.confidenceCapped).toBe(1);
    expect(stats.droppedReasons[0]).toMatch(/objects\[2\].*footprint\.widthCm/);
  });

  it('ignores a photo box if the model sends one anyway', () => {
    const { scene } = parseGemmaScene({
      ...validScene(),
      objects: [object({ bbox2d: { x1: 100, y1: 400, x2: 400, y2: 700 } })],
    });

    expect(scene.objects).toHaveLength(1);
    expect(scene.objects[0]).not.toHaveProperty('bbox2d');
  });

  it('moves an object that sticks out of the room back inside and downgrades it to an estimate', () => {
    const { scene, stats } = parseGemmaScene({
      ...validScene(),
      objects: [
        object(), // inside the 340x410 room: untouched
        // 300 + 120 = 420 > 340, as the 4B model did with a bed in a real photo
        object({ label: 'Wardrobe', footprint: { xCm: 300, yCm: 20, widthCm: 120, depthCm: 60, heightCm: 200 } }),
      ],
    });

    const [bed, wardrobe] = scene.objects;
    expect(stats.outOfRoom).toBe(1);
    expect(stats.repairedIntoRoom).toBe(1);
    expect(wardrobe.footprint).toMatchObject({ xCm: 220, yCm: 20, widthCm: 120, depthCm: 60 });
    // No longer an observation, its confidence follows the cap for an estimate, and the move is
    // written into the uncertainty so the UI can show it.
    expect(wardrobe.epistemic).toBe('inferred');
    expect(wardrobe.confidence).toBe(0.85);
    expect(wardrobe.uncertainty.posPlusMinusCm).toBe(80);
    expect(wardrobe.uncertainty.reason).toMatch(/Placed outside the room.*moved 80 cm/);
    expect(stats.confidenceCapped).toBe(1);
    // The object that already fitted is exactly as the model gave it.
    expect(bed.epistemic).toBe('observed');
    expect(bed.confidence).toBe(0.9);
    expect(bed.footprint).toMatchObject({ xCm: 20, yCm: 30, widthCm: 154, depthCm: 206 });
    expect(bed.uncertainty.reason).toBe('Duvet overhang');
  });

  it('shrinks an object that is bigger than the room and keeps blind-spot objects blind-spot', () => {
    const { scene } = parseGemmaScene({
      ...validScene(),
      objects: [
        object({ label: 'Counter', footprint: { xCm: 10, yCm: 10, widthCm: 500, depthCm: 60, heightCm: 90 } }),
        object({
          label: 'Mini Fridge',
          epistemic: 'occluded_prior',
          confidence: 0.5,
          footprint: { xCm: 330, yCm: 400, widthCm: 60, depthCm: 60, heightCm: 85 },
        }),
      ],
    });

    const [counter, fridge] = scene.objects;
    expect(counter.footprint).toMatchObject({ xCm: 0, yCm: 10, widthCm: 340, depthCm: 60 });
    expect(counter.uncertainty.dimPlusMinusCm).toBe(160);
    expect(counter.uncertainty.reason).toMatch(/shrunk 160 cm/);
    expect(fridge.epistemic).toBe('occluded_prior');
    expect(fridge.footprint).toMatchObject({ xCm: 280, yCm: 350 });
  });

  it('measures a rotated object by its turned sides when fitting it into the room', () => {
    const rotated = { xCm: 300, yCm: 300, widthCm: 100, depthCm: 200, heightCm: 80, rotationDeg: 90 };
    // Turned a quarter, it spans 200 along x and 100 along y: 300 + 200 > 340 but 300 + 100 <= 410.
    expect(fitFootprintIntoRoom(rotated, { widthCm: 340, depthCm: 410 })).toMatchObject({
      footprint: { xCm: 140, yCm: 300, widthCm: 100, depthCm: 200 },
      movedCm: 160,
      shrunkCm: 0,
    });
    // Already inside: nothing to do.
    expect(fitFootprintIntoRoom({ ...rotated, xCm: 100 }, { widthCm: 340, depthCm: 410 })).toBeNull();
  });

  it('leaves out windows, wall decor and things resting on furniture, and says which', () => {
    // A bedroom answer from the 4B model listed all of these as floor objects.
    const { scene, stats } = parseGemmaScene({
      ...validScene(),
      objects: [
        object({ label: 'Bed', labelKo: '침대' }),
        object({ label: 'Window', labelKo: '창문', category: 'opening' }),
        object({ label: 'Curtain', labelKo: '커튼', category: 'obstacle' }),
        object({ label: 'Mirror', labelKo: '거울', category: 'obstacle' }),
        object({ label: 'Artwork', labelKo: '그림', category: 'obstacle' }),
        object({ label: 'Pillow', labelKo: '베개' }),
        object({ label: 'Book', labelKo: '책', category: 'obstacle' }),
        object({ label: 'Floor Mirror', labelKo: '전신 거울' }), // stands on the floor: kept
        object({ label: 'Bookshelf', labelKo: '책장' }), // not a book
        object({ label: 'Bed Frame', labelKo: '침대 프레임' }), // not a picture frame
      ],
    });

    expect(scene.objects.map((o) => o.label)).toEqual(['Bed', 'Floor Mirror', 'Bookshelf', 'Bed Frame']);
    expect(stats.objectsReturned).toBe(10);
    expect(stats.objectsKept).toBe(4);
    expect(stats.skippedNotOnFloor).toEqual([
      'Window (opening, listed under openings)',
      'Curtain (wall-mounted)',
      'Mirror (wall-mounted)',
      'Artwork (wall-mounted)',
      'Pillow (rests on furniture)',
      'Book (rests on furniture)',
    ]);
  });

  it('corrects a ceiling height written in millimetres or out of range instead of rejecting the answer', () => {
    const withCeiling = (ceilingHeightCm: number) =>
      parseGemmaScene({ ...validScene(), room: { ...validScene().room, ceilingHeightCm } });

    // gemma3:4b wrote 2700 and 2400 for 270 cm and 240 cm ceilings; this used to fail validation.
    const mm = withCeiling(2700);
    expect(mm.scene.room.ceilingHeightCm).toBe(270);
    expect(mm.stats.ceilingHeightAdjusted).toBe(1);
    expect(mm.stats.ceilingHeightNote).toBe('2700 read as mm = 270 cm');
    expect(mm.stats.fieldsNormalized).toBe(1);

    expect(withCeiling(700).scene.room.ceilingHeightCm).toBe(600); // not a plausible mm value: clamped
    expect(withCeiling(700).stats.ceilingHeightNote).toBe('700 clamped to 600 cm');
    expect(withCeiling(90).scene.room.ceilingHeightCm).toBe(180);
    expect(withCeiling(12000).scene.room.ceilingHeightCm).toBe(600);

    const fine = withCeiling(235);
    expect(fine.scene.room.ceilingHeightCm).toBe(235);
    expect(fine.stats.ceilingHeightAdjusted).toBe(0);
    expect(fine.stats.ceilingHeightNote).toBeNull();
    expect(fine.stats.fieldsNormalized).toBe(0);
  });

  it('draws the line between millimetres and out-of-range centimetres at 1800 and 6000', () => {
    expect(normalizeCeilingHeightCm(1800)).toEqual({ valueCm: 180, note: '1800 read as mm = 180 cm' });
    expect(normalizeCeilingHeightCm(6000)).toEqual({ valueCm: 600, note: '6000 read as mm = 600 cm' });
    expect(normalizeCeilingHeightCm(1799).valueCm).toBe(600);
    expect(normalizeCeilingHeightCm(6001).valueCm).toBe(600);
    expect(normalizeCeilingHeightCm(180)).toEqual({ valueCm: 180, note: null });
    expect(normalizeCeilingHeightCm(600)).toEqual({ valueCm: 600, note: null });
    expect(normalizeCeilingHeightCm(-5).valueCm).toBe(180);
  });

  it('rejects an answer with no usable objects or no room', () => {
    expect(() => parseGemmaScene({ ...validScene(), objects: [{ label: 'x' }] })).toThrow(
      /no usable objects/
    );
    expect(() => parseGemmaScene({ objects: [object()] })).toThrow(/room/);
  });
});

describe('assembleRoomGraph', () => {
  it('builds a schema-valid graph with derived edges and an honest calibration block', () => {
    const { scene } = parseGemmaScene(validScene());
    const graph = assembleRoomGraph(scene, {
      sceneId: 'scene-test',
      title: 'Test',
      sourcePhotoUrl: PNG_1X1,
      referenceObject: 'Door',
      referenceDimensionCm: 210,
    });

    const parsed = RoomGraphSchema.omit({ compileMeta: true }).parse(graph);
    expect(parsed.nodes).toHaveLength(2);
    // The model is not asked where objects are in the photo, so no node claims a photo region.
    expect(parsed.nodes.every((n) => n.bbox2d === null)).toBe(true);
    expect(parsed.epistemicSummary.observedCount).toBe(2);
    expect(parsed.calibration.pixelToCmRatio).toBeNull();
    // Bed ends at x=174, lamp starts at x=176: a 2cm gap derived from footprints.
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.edges[0].relation).toBe('adjacent_to');
    expect(parsed.edges[0].distanceCm).toBe(2);
    expect(parsed.edges[0].uncertaintyCm).toBe(8);
  });
});

describe('compileRoomPhoto', () => {
  it('uses the Gemma answer and reports real tokens and spans', async () => {
    const ollama = stubOllama({ chat: () => chatReply(JSON.stringify(validScene())) });

    const { roomGraph, ollamaLiveUsed } = await compileRoomPhoto({
      photoDataUrl: PNG_1X1,
      fileName: 'my-room.png',
    });

    expect(ollamaLiveUsed).toBe(true);
    expect(roomGraph.compileMeta.runtime).toBe('ollama-gemma3:4b');
    expect(roomGraph.compileMeta.fallback).toBeUndefined();
    expect(roomGraph.nodes.map((n) => n.label)).toEqual(['Queen Bed', 'Floor Lamp']);
    expect(roomGraph.sourcePhotoUrl).toBe(PNG_1X1);
    expect(roomGraph.compileMeta.tokens).toEqual({ prompt: 1234, completion: 567, total: 1801 });
    expect(roomGraph.compileMeta.spans.map((s) => s.op)).toEqual([
      'compiler.preflight',
      'ai.run.gemma3',
      'compiler.assemble',
      'db.mongodb.upsert',
    ]);
    expect(roomGraph.compileMeta.spans[1].attributes['gen_ai.usage.input_tokens']).toBe(1234);
    expect(roomGraph.compileMeta.spans[1].attributes['gen_ai.usage.output_tokens']).toBe(567);
    // Sentry is not configured here, so there is no Sentry trace to point at.
    expect(getSentryStatus().enabled).toBe(false);
    expect(roomGraph.compileMeta.sentryTraceId).toBe('');
    expect(roomGraph.compileMeta.sentrySpanId).toBe('');
    // No MongoDB URI in tests, so the save went to the in-memory copy only.
    expect(roomGraph.compileMeta.atlasPersisted).toBe(false);
    // What was stored is the final document (with the measured latency and the final spans), not
    // the one saved before those were known.
    expect(await getRoomGraphById(roomGraph.sceneId)).toEqual(roomGraph);

    const [request] = ollama.chatCalls();
    expect(request.body.model).toBe('gemma3:4b');
    expect(request.body.format.required).toContain('objects');
    expect(request.body.messages[1].images).toHaveLength(1);
    // Neither the schema nor the prompt asks the model to box objects in the photo.
    const objectProps = request.body.format.properties.objects.items;
    expect(objectProps.properties).not.toHaveProperty('bbox2d');
    expect(objectProps.required).not.toContain('bbox2d');
    expect(request.body.messages[0].content).not.toMatch(/bbox/i);
    expect(roomGraph.nodes.every((n) => n.bbox2d === null)).toBe(true);
  });

  it('labels the runtime with the model that answered instead of a fixed gemma3 name', async () => {
    // Seen when GEMMA_MODEL=gemma4:e4b: the graph, the UI and the Sentry trace said gemma3:4b.
    vi.stubEnv('GEMMA_MODEL', 'gemma4:e4b');
    const ollama = stubOllama({
      tags: { models: [{ name: 'gemma4:e4b' }] },
      chat: () =>
        new Response(
          JSON.stringify({
            model: 'gemma4:e4b',
            message: { content: JSON.stringify(validScene()) },
            prompt_eval_count: 10,
            eval_count: 20,
          }),
          { status: 200 }
        ),
    });

    const { roomGraph } = await compileRoomPhoto({ photoDataUrl: PNG_1X1, fileName: 'a.png' });

    expect(ollama.chatCalls()[0].body.model).toBe('gemma4:e4b');
    expect(roomGraph.compileMeta.model).toBe('gemma4:e4b');
    expect(roomGraph.compileMeta.runtime).toBe('ollama-gemma4:e4b');
  });

  it('accepts a first answer with the ceiling height in millimetres, without a second attempt', async () => {
    const scene = validScene();
    scene.room.ceilingHeightCm = 2700;
    const ollama = stubOllama({ chat: () => chatReply(JSON.stringify(scene)) });

    const { roomGraph, ollamaLiveUsed } = await compileRoomPhoto({ photoDataUrl: PNG_1X1, fileName: 'a.png' });

    expect(ollamaLiveUsed).toBe(true);
    expect(ollama.chatCalls()).toHaveLength(1);
    expect(roomGraph.roomEnvelope.ceilingHeightCm).toBe(270);
    const assemble = roomGraph.compileMeta.spans.filter((s) => s.op === 'compiler.assemble');
    expect(assemble).toHaveLength(1);
    expect(assemble[0].status).toBe('ok');
    expect(assemble[0].attributes['gemma.ceiling_height_adjusted']).toBe(1);
    expect(assemble[0].attributes['gemma.ceiling_height_note']).toBe('2700 read as mm = 270 cm');
  });

  it('retries once with the validation error and records each attempt as its own span', async () => {
    const ollama = stubOllama({
      chat: (call) => (call === 1 ? chatReply('not json', 100, 10) : chatReply(JSON.stringify(validScene()), 200, 20)),
    });

    const { roomGraph } = await compileRoomPhoto({ photoDataUrl: PNG_1X1, fileName: 'a.png' });
    const spans = roomGraph.compileMeta.spans;

    expect(roomGraph.compileMeta.runtime).toBe('ollama-gemma3:4b');
    expect(roomGraph.compileMeta.tokens.total).toBe(330);
    expect(spans.map((s) => [s.op, s.status])).toEqual([
      ['compiler.preflight', 'ok'],
      ['ai.run.gemma3', 'ok'],
      ['compiler.assemble', 'degraded'],
      ['ai.run.gemma3', 'ok'],
      ['compiler.assemble', 'ok'],
      ['db.mongodb.upsert', 'degraded'],
    ]);
    expect(spans[1].attributes['gen_ai.usage.input_tokens']).toBe(100);
    expect(spans[3].attributes['gen_ai.usage.input_tokens']).toBe(200);
    expect(String(spans[2].attributes['retry.reason'])).toContain('not valid JSON');
    expect(ollama.chatCalls()[1].body.messages[1].content).toContain('not valid JSON');
  });

  it('falls back and says so when Ollama is unreachable', async () => {
    stubOllama({ tags: new Error('ECONNREFUSED'), chat: () => new Error('should not be called') });

    const { roomGraph, ollamaLiveUsed } = await compileRoomPhoto({
      photoDataUrl: PNG_1X1,
      fileName: 'a.png',
    });

    expect(ollamaLiveUsed).toBe(false);
    expect(roomGraph.compileMeta.runtime).toBe('fallback-preset');
    expect(roomGraph.compileMeta.fallback?.stage).toBe('unavailable');
    expect(roomGraph.compileMeta.model).toMatch(/^none/);
    expect(roomGraph.compileMeta.tokens.total).toBe(0);
    expect(roomGraph.compileMeta.atlasPersisted).toBe(false);
    expect(roomGraph.title).toMatch(/^Fallback sample/);
    expect(roomGraph.sourcePhotoUrl).not.toBe(PNG_1X1);
    expect(roomGraph.compileMeta.spans.map((s) => [s.op, s.status])).toEqual([
      ['compiler.preflight', 'fallback'],
      ['compiler.fallback_preset', 'fallback'],
    ]);
  });

  it('tells the retry to be shorter when the first answer was cut off by the output limit', async () => {
    const cutOff = new Response(
      JSON.stringify({
        model: 'gemma3:4b',
        message: { content: '{"room":{"widthCm":340,"objects":[{"label":"Bed"' }, // never closed
        prompt_eval_count: 1000,
        eval_count: 3500,
        done_reason: 'length',
      }),
      { status: 200 }
    );
    const ollama = stubOllama({
      chat: (call) => (call === 1 ? cutOff : chatReply(JSON.stringify(validScene()))),
    });

    const { roomGraph, ollamaLiveUsed } = await compileRoomPhoto({ photoDataUrl: PNG_1X1, fileName: 'busy.png' });

    expect(ollamaLiveUsed).toBe(true);
    expect(roomGraph.compileMeta.runtime).toBe('ollama-gemma3:4b');
    const [first, second] = ollama.chatCalls();
    expect(first.body.messages[1].content).not.toMatch(/previous answer was rejected/);
    expect(second.body.messages[1].content).toMatch(/cut off for being too long/);
    expect(second.body.messages[1].content).toMatch(/at most 8 objects/);
    // Tokens of the wasted first attempt are still counted.
    expect(roomGraph.compileMeta.tokens.completion).toBe(3500 + 567);
  });

  it('reports a missing model without calling the chat endpoint', async () => {
    const ollama = stubOllama({
      tags: { models: [{ name: 'qwen2.5:7b' }] },
      chat: () => new Error('should not be called'),
    });

    const { roomGraph } = await compileRoomPhoto({ photoDataUrl: PNG_1X1, fileName: 'a.png' });

    expect(roomGraph.compileMeta.fallback?.stage).toBe('model_missing');
    expect(roomGraph.compileMeta.fallback?.reason).toContain('ollama pull gemma3:4b');
    expect(ollama.chatCalls()).toHaveLength(0);
  });

  it('gives up after two invalid answers and keeps the tokens it really spent', async () => {
    stubOllama({ chat: () => chatReply('{"nope":true}', 50, 5) });

    const { roomGraph } = await compileRoomPhoto({ photoDataUrl: PNG_1X1, fileName: 'a.png' });

    expect(roomGraph.compileMeta.runtime).toBe('fallback-preset');
    expect(roomGraph.compileMeta.fallback?.stage).toBe('schema_invalid');
    expect(roomGraph.compileMeta.tokens.total).toBe(110);
    expect(roomGraph.compileMeta.spans.map((s) => [s.op, s.status])).toEqual([
      ['compiler.preflight', 'ok'],
      ['ai.run.gemma3', 'ok'],
      ['compiler.assemble', 'degraded'],
      ['ai.run.gemma3', 'ok'],
      ['compiler.assemble', 'fallback'],
      ['compiler.fallback_preset', 'fallback'],
    ]);
  });

  it('reports a timeout as a fallback', async () => {
    stubOllama({
      chat: () => Object.assign(new Error('aborted'), { name: 'AbortError' }),
    });

    const { roomGraph } = await compileRoomPhoto({ photoDataUrl: PNG_1X1, fileName: 'a.png' });

    expect(roomGraph.compileMeta.fallback?.stage).toBe('timeout');
  });

  it('does not send unsupported image types to the model', async () => {
    const ollama = stubOllama({ chat: () => new Error('should not be called') });

    const { roomGraph } = await compileRoomPhoto({
      photoDataUrl: PRESET_ROOMS[0].photoDataUrl, // an SVG illustration
      fileName: 'a.svg',
    });

    expect(roomGraph.compileMeta.fallback?.stage).toBe('unsupported_image');
    expect(ollama.calls).toHaveLength(0);
  });

  it('returns a preset as a labelled sample without running any model', async () => {
    const ollama = stubOllama({ chat: () => new Error('should not be called') });

    const { roomGraph, ollamaLiveUsed } = await compileRoomPhoto({
      photoDataUrl: PNG_1X1,
      presetId: PRESET_ROOMS[1].id,
    });

    expect(ollamaLiveUsed).toBe(false);
    expect(roomGraph.compileMeta.runtime).toBe('preset-sample');
    expect(roomGraph.compileMeta.tokens.total).toBe(0);
    expect(roomGraph.compileMeta.spans).toHaveLength(0);
    expect(ollama.calls).toHaveLength(0);
  });
});
