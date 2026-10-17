import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  flushSentryAgentTracing,
  getSentryStatus,
  initSentryAgentTracing,
} from '../server/sentryAgentTracer';
import { compileRoomPhoto } from '../server/gemmaCompiler';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_BASE64 = PNG_1X1.split(',')[1];
const FILE_NAME = 'private-bedroom-photo.png';

const scene = {
  room: { widthCm: 340, depthCm: 410, ceilingHeightCm: 235, uncertaintyCm: 8, scaleConfidence: 0.7, perspectiveTiltDeg: 3 },
  objects: [
    {
      label: 'Queen Bed',
      labelKo: '퀸 침대',
      category: 'furniture',
      epistemic: 'observed',
      confidence: 0.9,
      evidence: 'Three floor corners visible.',
      bbox2d: { x1: 100, y1: 400, x2: 400, y2: 700 },
      footprint: { xCm: 20, yCm: 30, widthCm: 154, depthCm: 206, heightCm: 70, rotationDeg: 0 },
      uncertainty: { posPlusMinusCm: 4, dimPlusMinusCm: 5, reason: 'Duvet overhang' },
      movable: true,
      weightKgEst: 60,
      disassemblyRequired: true,
    },
  ],
  openings: [],
  blindSpots: [],
};

interface CapturedEvent {
  type?: string;
  transaction?: string;
  contexts?: { trace?: { trace_id?: string; span_id?: string; op?: string; status?: string } };
  spans?: {
    op?: string;
    description?: string;
    start_timestamp: number;
    timestamp: number;
    data?: Record<string, unknown>;
  }[];
}

// Everything the SDK hands to its transport, i.e. exactly what would go over the wire to Sentry.
const envelopes: unknown[] = [];

function transactions(): CapturedEvent[] {
  const out: CapturedEvent[] = [];
  for (const envelope of envelopes as [unknown, [{ type?: string }, CapturedEvent][]][]) {
    for (const [header, payload] of envelope[1]) {
      if (header.type === 'transaction') out.push(payload);
    }
  }
  return out;
}

function stubFetch(opts: { ollamaUp: boolean; delayMs?: number }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (!opts.ollamaUp) throw new Error('ECONNREFUSED');
      if (url.endsWith('/api/tags')) {
        return new Response(JSON.stringify({ models: [{ name: 'gemma3:4b' }] }), { status: 200 });
      }
      await new Promise((r) => setTimeout(r, opts.delayMs ?? 0));
      return new Response(
        JSON.stringify({
          model: 'gemma3:4b',
          message: { content: JSON.stringify(scene) },
          prompt_eval_count: 1234,
          eval_count: 567,
        }),
        { status: 200 }
      );
    })
  );
}

beforeAll(() => {
  initSentryAgentTracing({
    dsn: 'https://publickey@o0.ingest.sentry.io/1',
    transport: () => ({
      send: async (envelope) => {
        envelopes.push(envelope);
        return { statusCode: 200 };
      },
      flush: async () => true,
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  envelopes.length = 0;
});

describe('Sentry agent tracing', () => {
  it('reports itself as sending once a DSN is configured', () => {
    const status = getSentryStatus();
    expect(status.enabled).toBe(true);
    expect(status.mode).toBe('sending');
    expect(status.reason).toBeNull();
  });

  it('sends a gen_ai.invoke_agent transaction whose trace id is the one in compileMeta', async () => {
    stubFetch({ ollamaUp: true, delayMs: 60 });

    const { roomGraph } = await compileRoomPhoto({ photoDataUrl: PNG_1X1, fileName: FILE_NAME });
    await flushSentryAgentTracing();

    const [event] = transactions();
    expect(transactions()).toHaveLength(1);
    expect(event.transaction).toBe('invoke_agent reality-compiler');
    expect(event.contexts?.trace?.op).toBe('gen_ai.invoke_agent');

    // The id shown in the app is Sentry's own, not a locally made-up one.
    const traceId = event.contexts?.trace?.trace_id;
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(roomGraph.compileMeta.sentryTraceId).toBe(traceId);
    expect(roomGraph.compileMeta.sentrySpanId).toBe(event.contexts?.trace?.span_id);

    const spans = [...(event.spans ?? [])].sort((a, b) => a.start_timestamp - b.start_timestamp);
    expect(spans.map((s) => s.op)).toEqual([
      'compiler.preflight',
      'gen_ai.chat',
      'compiler.assemble',
      'db.mongodb.upsert',
    ]);

    const chat = spans[1];
    expect(chat.description).toBe('chat gemma3:4b');
    expect(chat.data).toMatchObject({
      'gen_ai.operation.name': 'chat',
      'gen_ai.provider.name': 'ollama',
      'gen_ai.request.model': 'gemma3:4b',
      'gen_ai.response.model': 'gemma3:4b',
      'gen_ai.agent.name': 'reality-compiler',
      'gen_ai.usage.input_tokens': 1234,
      'gen_ai.usage.output_tokens': 567,
      'gen_ai.usage.total_tokens': 1801,
      'app.step': 'ai.run.gemma3',
    });

    // Both views of the span carry the same measured duration, and it is a real one.
    const sentryMs = (chat.timestamp - chat.start_timestamp) * 1000;
    const localMs = roomGraph.compileMeta.spans[1].durationMs;
    expect(sentryMs).toBeGreaterThanOrEqual(55);
    expect(Math.abs(sentryMs - localMs)).toBeLessThan(15);
  });

  it('never sends the photo, its file name or prompt text', async () => {
    stubFetch({ ollamaUp: true });

    await compileRoomPhoto({ photoDataUrl: PNG_1X1, fileName: FILE_NAME, roomNotes: 'secret notes' });
    await flushSentryAgentTracing();

    // Guard against passing vacuously: something really was sent.
    expect(transactions()).toHaveLength(1);
    const wire = JSON.stringify(envelopes);
    expect(wire).not.toContain(PNG_BASE64);
    expect(wire).not.toContain(FILE_NAME);
    expect(wire).not.toContain('secret notes');
    expect(wire).not.toContain('Reality Compiler, a spatial analyst');
  });

  it('marks a failed compile as an error in Sentry and still reports a real trace id', async () => {
    stubFetch({ ollamaUp: false });

    const { roomGraph } = await compileRoomPhoto({ photoDataUrl: PNG_1X1, fileName: FILE_NAME });
    await flushSentryAgentTracing();

    const [event] = transactions();
    expect(roomGraph.compileMeta.runtime).toBe('fallback-preset');
    expect(roomGraph.compileMeta.sentryTraceId).toBe(event.contexts?.trace?.trace_id);
    expect(event.contexts?.trace?.status).not.toBe('ok');

    // Ollama was never reached, so there is no LLM request span: the failure is on the preflight.
    expect(event.spans?.some((s) => s.op === 'gen_ai.chat')).toBe(false);
    const preflight = event.spans?.find((s) => s.op === 'compiler.preflight');
    expect(preflight?.data).toMatchObject({ 'error.type': 'unavailable', 'reality.status': 'fallback' });
  });

  it('counts transactions the SDK reports as delivered', async () => {
    stubFetch({ ollamaUp: true });
    const before = getSentryStatus().transactionsSent;

    await compileRoomPhoto({ photoDataUrl: PNG_1X1, fileName: FILE_NAME });
    await flushSentryAgentTracing();

    await vi.waitFor(() => expect(getSentryStatus().transactionsSent).toBe(before + 1));
    expect(getSentryStatus().transactionsFailed).toBe(0);
  });
});
