import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomGraphSchema } from '../shared/roomGraphSchema';
import { PRESET_ROOMS } from '../shared/presetRooms';
import { compileRoomPhoto } from '../server/gemmaCompiler';
import { getSentryStatus } from '../server/sentryAgentTracer';
import { assembleRoomGraph, parseGemmaScene } from '../server/gemmaScene';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const object = (over: Record<string, unknown> = {}) => ({
  label: 'Queen Bed',
  labelKo: '퀸 침대',
  category: 'furniture',
  epistemic: 'observed',
  confidence: 0.9,
  evidence: 'Three floor corners and the headboard are visible.',
  bbox2d: { x1: 100, y1: 400, x2: 400, y2: 700 },
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
});

describe('parseGemmaScene', () => {
  it('drops invalid objects, clamps the bbox and caps overclaimed confidence', () => {
    const { scene, stats } = parseGemmaScene({
      ...validScene(),
      objects: [
        object({ bbox2d: { x1: 800, y1: 100, x2: 1200, y2: 300 } }), // runs off the photo edge
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
    expect(scene.objects[0].bbox2d?.w).toBeCloseTo(0.2);
    expect(stats.fieldsNormalized).toBe(1);
    expect(scene.objects[1].confidence).toBe(0.6);
    expect(stats.confidenceCapped).toBe(1);
    expect(stats.droppedReasons[0]).toMatch(/objects\[2\].*footprint\.widthCm/);
  });

  it('keeps an object with bbox2d = null when the model gives an unusable photo box', () => {
    // Gemma was seen copying footprint numbers into the box; clamped to 0-1000 this has no area.
    const { scene, stats } = parseGemmaScene({
      ...validScene(),
      objects: [object({ bbox2d: { x1: 1500, y1: 1600, x2: 1700, y2: 1800 } })],
    });

    expect(scene.objects).toHaveLength(1);
    expect(scene.objects[0].bbox2d).toBeNull();
    expect(stats.bboxMissing).toBe(1);
  });

  it('counts objects that stick out of the room without dropping them', () => {
    const { scene, stats } = parseGemmaScene({
      ...validScene(),
      objects: [
        object(), // inside the 340x410 room
        object({ label: 'Wardrobe', footprint: { xCm: 300, yCm: 20, widthCm: 120, depthCm: 60, heightCm: 200 } }),
      ],
    });

    expect(scene.objects).toHaveLength(2);
    expect(stats.outOfRoom).toBe(1);
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

    const [request] = ollama.chatCalls();
    expect(request.body.model).toBe('gemma3:4b');
    expect(request.body.format.required).toContain('objects');
    expect(request.body.messages[1].images).toHaveLength(1);
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
