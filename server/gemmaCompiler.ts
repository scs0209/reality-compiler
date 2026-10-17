import crypto from 'node:crypto';
import {
  RoomGraphSchema,
  type FallbackStage,
  type RoomGraph,
} from '../shared/roomGraphSchema';
import { PRESET_ROOMS } from '../shared/presetRooms';
import {
  createLocalTraceId,
  recordAgentTrace,
  runCompileTrace,
  type CompileTrace,
} from './sentryAgentTracer';
import { saveRoomGraph } from './atlasStore';
import {
  GEMMA3_SYSTEM_PROMPT,
  GEMMA_RESPONSE_JSON_SCHEMA,
  assembleRoomGraph,
  buildGemmaUserPrompt,
  parseGemmaScene,
  type GemmaParseStats,
} from './gemmaScene';

export { GEMMA3_SYSTEM_PROMPT };

export interface CompileRoomInput {
  photoDataUrl: string;
  fileName?: string;
  presetId?: string;
  calibrationObject?: string;
  calibrationDimensionCm?: number;
  roomNotes?: string;
}

const AGENT_NAME = 'reality-compiler';
const MAX_ATTEMPTS = 2;
const MAX_OUTPUT_TOKENS = 3500;

export function ollamaConfig() {
  return {
    endpoint: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    model: process.env.GEMMA_MODEL || 'gemma3:4b',
    // CPU/small-GPU inference of an image plus ~2k tokens of JSON is slow; allow for it.
    timeoutMs: Number(process.env.GEMMA_TIMEOUT_MS) || 180_000,
  };
}

export interface OllamaHealth {
  endpoint: string;
  model: string;
  reachable: boolean;
  modelInstalled: boolean;
}

export async function checkOllama(): Promise<OllamaHealth> {
  const { endpoint, model } = ollamaConfig();
  const health: OllamaHealth = { endpoint, model, reachable: false, modelInstalled: false };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${endpoint}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return health;
    health.reachable = true;
    const data = (await res.json()) as { models?: { name?: string; model?: string }[] };
    const wanted = model.includes(':') ? model : `${model}:latest`;
    health.modelInstalled = Boolean(
      data.models?.some((m) => (m.name ?? m.model) === wanted)
    );
  } catch {
    // unreachable: reachable stays false
  }
  return health;
}

function extractBase64Payload(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  return match ? match[2] : null;
}

interface OllamaChatResponse {
  model?: string;
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number; // nanoseconds
}

class OllamaHttpError extends Error {
  constructor(
    readonly status: number,
    detail: string
  ) {
    super(`Ollama returned HTTP ${status}${detail ? `: ${detail}` : ''}`);
  }
}

async function ollamaChat(body: unknown): Promise<OllamaChatResponse> {
  const { endpoint, timeoutMs } = ollamaConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new OllamaHttpError(res.status, (await res.text()).slice(0, 200));
    return (await res.json()) as OllamaChatResponse;
  } finally {
    clearTimeout(timer);
  }
}

const isAbort = (err: unknown) =>
  err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

type Failure = { stage: FallbackStage; reason: string };

interface GemmaRun {
  graph?: Omit<RoomGraph, 'compileMeta'>;
  failure?: Failure;
  model: string;
  tokens: { prompt: number; completion: number };
  attempts: number;
  stats?: GemmaParseStats;
}

const GraphWithoutMeta = RoomGraphSchema.omit({ compileMeta: true });

type CallResult = { ok: true; content: string } | { ok: false; failure: Failure };
type AssembleResult =
  | { ok: true; graph: Omit<RoomGraph, 'compileMeta'>; stats: GemmaParseStats }
  | { ok: false; failure: Failure };

/**
 * Asks Gemma for the scene, up to MAX_ATTEMPTS times. Every Ollama request and every validation
 * pass is its own span, so retries show up in the trace with their own durations and token counts.
 */
async function runGemma(
  input: CompileRoomInput,
  reference: { object: string; cm: number },
  sceneId: string,
  trace: CompileTrace
): Promise<GemmaRun> {
  const { model, timeoutMs } = ollamaConfig();
  const run: GemmaRun = { model, tokens: { prompt: 0, completion: 0 }, attempts: 0 };
  const fail = (failure: Failure): GemmaRun => ({ ...run, failure });

  const image = extractBase64Payload(input.photoDataUrl);
  const title = input.fileName
    ? `${input.fileName.replace(/\.[^.]+$/, '')} — Compiled RoomGraph`
    : 'Compiled RoomGraph';

  // Checked in its own span so that `gen_ai.chat` spans only ever mean a real LLM request.
  const preflightFailure = await trace.span(
    {
      step: 'compiler.preflight',
      description: 'Check the photo type and that Ollama is up with the model installed',
      sentryOp: 'compiler.preflight',
      sentryName: 'preflight Ollama',
      attributes: { 'gen_ai.request.model': model },
    },
    async (h): Promise<Failure | null> => {
      const stop = (failure: Failure): Failure => {
        h.setStatus('fallback', failure.stage);
        h.setAttributes({
          'fallback.stage': failure.stage,
          'fallback.reason': failure.reason.slice(0, 200),
        });
        return failure;
      };
      if (!image) {
        return stop({
          stage: 'unsupported_image',
          reason: 'Photo must be PNG, JPEG or WebP to reach the vision model.',
        });
      }
      const health = await checkOllama();
      h.setAttributes({
        'ollama.reachable': health.reachable,
        'ollama.model_installed': health.modelInstalled,
      });
      if (!health.reachable) {
        return stop({
          stage: 'unavailable',
          reason: `Ollama is not reachable at ${health.endpoint}.`,
        });
      }
      if (!health.modelInstalled) {
        return stop({
          stage: 'model_missing',
          reason: `Model ${health.model} is not installed. Run: ollama pull ${health.model}`,
        });
      }
      return null;
    }
  );
  if (preflightFailure) return fail(preflightFailure);

  let previousError: string | undefined;
  let lastFailure: Failure | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    run.attempts = attempt;

    const call = await trace.span(
      {
        step: 'ai.run.gemma3',
        description: `Ollama ${model} vision inference (attempt ${attempt}, structured JSON output)`,
        sentryOp: 'gen_ai.chat',
        sentryName: `chat ${model}`,
        attributes: {
          'gen_ai.operation.name': 'chat',
          'gen_ai.provider.name': 'ollama',
          'gen_ai.request.model': model,
          'gen_ai.agent.name': AGENT_NAME,
          'gen_ai.request.temperature': 0,
          'gen_ai.request.max_tokens': MAX_OUTPUT_TOKENS,
          'gemma.attempt': attempt,
        },
      },
      async (h): Promise<CallResult> => {
        const stop = (failure: Failure): CallResult => {
          h.setStatus('fallback', failure.stage);
          h.setDescription(`Ollama ${model} vision inference failed: ${failure.stage}`);
          h.setAttributes({
            'fallback.stage': failure.stage,
            'fallback.reason': failure.reason.slice(0, 200),
          });
          return { ok: false, failure };
        };

        try {
          const res = await ollamaChat({
            model,
            stream: false,
            format: GEMMA_RESPONSE_JSON_SCHEMA,
            options: { temperature: 0, num_ctx: 8192, num_predict: MAX_OUTPUT_TOKENS },
            messages: [
              { role: 'system', content: GEMMA3_SYSTEM_PROMPT },
              {
                role: 'user',
                content: buildGemmaUserPrompt({
                  referenceObject: reference.object,
                  referenceDimensionCm: reference.cm,
                  roomNotes: input.roomNotes,
                  previousError,
                }),
                images: [image as string],
              },
            ],
          });
          const prompt = res.prompt_eval_count ?? 0;
          const completion = res.eval_count ?? 0;
          run.tokens.prompt += prompt;
          run.tokens.completion += completion;
          if (res.model) run.model = res.model;
          h.setAttributes({
            'gen_ai.response.model': res.model ?? model,
            'gen_ai.usage.input_tokens': prompt,
            'gen_ai.usage.output_tokens': completion,
            'gen_ai.usage.total_tokens': prompt + completion,
            ...(typeof res.total_duration === 'number' && {
              'ollama.total_duration_ms': Math.round(res.total_duration / 1e6),
            }),
          });
          return { ok: true, content: res.message?.content ?? '' };
        } catch (err) {
          if (isAbort(err)) {
            return stop({
              stage: 'timeout',
              reason: `No answer from ${model} within ${timeoutMs / 1000}s.`,
            });
          }
          if (err instanceof OllamaHttpError) return stop({ stage: 'http_error', reason: err.message });
          return stop({ stage: 'unavailable', reason: `Request to Ollama failed: ${errorMessage(err)}` });
        }
      }
    );

    // Transport failures are not worth a retry.
    if (!call.ok) return fail(call.failure);

    const isLastAttempt = attempt === MAX_ATTEMPTS;
    const assembled = await trace.span(
      {
        step: 'compiler.assemble',
        description: 'Validate Gemma output, derive edges and epistemic summary, check RoomGraphSchema',
        sentryOp: 'compiler.assemble',
        sentryName: 'assemble RoomGraph',
        attributes: { 'gemma.attempt': attempt },
      },
      (h): AssembleResult => {
        const reject = (failure: Failure): AssembleResult => {
          previousError = failure.reason.slice(0, 300);
          h.setStatus(isLastAttempt ? 'fallback' : 'degraded', failure.stage);
          h.setAttributes({ 'retry.reason': previousError, 'fallback.stage': failure.stage });
          return { ok: false, failure };
        };

        let json: unknown;
        try {
          json = JSON.parse(call.content);
        } catch {
          return reject({
            stage: 'invalid_json',
            reason: 'Gemma returned text that is not valid JSON.',
          });
        }

        try {
          const { scene, stats } = parseGemmaScene(json);
          const graph = GraphWithoutMeta.parse(
            assembleRoomGraph(scene, {
              sceneId,
              title,
              sourcePhotoUrl: input.photoDataUrl,
              referenceObject: reference.object,
              referenceDimensionCm: reference.cm,
            })
          );
          h.setAttributes({
            'gemma.objects_returned': stats.objectsReturned,
            'gemma.objects_kept': stats.objectsKept,
            'gemma.fields_normalized': stats.fieldsNormalized,
            'gemma.bbox_missing': stats.bboxMissing,
            'gemma.objects_out_of_room': stats.outOfRoom,
            'gemma.confidence_capped': stats.confidenceCapped,
            ...(stats.droppedReasons.length > 0 && {
              'gemma.dropped_reasons': stats.droppedReasons.join(' | ').slice(0, 300),
            }),
            'epistemic.observed_count': graph.epistemicSummary.observedCount,
            'epistemic.inferred_count': graph.epistemicSummary.inferredCount,
            'epistemic.occluded_count': graph.epistemicSummary.occludedCount,
            'edges.derived_count': graph.edges.length,
          });
          return { ok: true, graph, stats };
        } catch (err) {
          return reject({ stage: 'schema_invalid', reason: errorMessage(err) });
        }
      }
    );

    if (assembled.ok) return { ...run, graph: assembled.graph, stats: assembled.stats };
    lastFailure = assembled.failure;
  }

  return fail(lastFailure ?? { stage: 'schema_invalid', reason: 'No usable answer.' });
}

export async function compileRoomPhoto(input: CompileRoomInput): Promise<{
  roomGraph: RoomGraph;
  ollamaLiveUsed: boolean;
}> {
  // A preset is a hand-authored sample, not a compile: no model runs and nothing is claimed about one.
  const preset = input.presetId ? PRESET_ROOMS.find((p) => p.id === input.presetId) : undefined;
  if (preset) {
    return { roomGraph: structuredClone(preset.roomGraph), ollamaLiveUsed: false };
  }

  const reference = {
    object: input.calibrationObject || 'Standard Door Frame (210cm × 82cm)',
    cm: input.calibrationDimensionCm || 210,
  };

  return runCompileTrace(
    { agentName: AGENT_NAME, model: ollamaConfig().model },
    async (trace) => {
      const t0 = performance.now();
      const compileId = `cmp_${crypto.randomBytes(4).toString('hex')}`;

      const run = await runGemma(
        input,
        reference,
        `scene-${crypto.randomBytes(4).toString('hex')}`,
        trace
      );
      const succeeded = Boolean(run.graph);

      const baseMeta = {
        compileId,
        timestamp: new Date().toISOString(),
        // Real Sentry ids, or '' when this compile was not traced by Sentry.
        sentryTraceId: trace.traceId,
        sentrySpanId: trace.rootSpanId,
        atlasPersisted: false, // set after the save below, if one happens
        tokens: {
          prompt: run.tokens.prompt,
          completion: run.tokens.completion,
          total: run.tokens.prompt + run.tokens.completion,
        },
      };

      let graph: RoomGraph;

      if (run.graph) {
        graph = {
          ...run.graph,
          compileMeta: {
            ...baseMeta,
            model: run.model,
            runtime: 'ollama-gemma3:4b',
            latencyMs: 0,
            spans: trace.spans,
          },
        };

        const saved = await trace.span(
          {
            step: 'db.mongodb.upsert',
            description: 'Save RoomGraph (collection: roomgraphs)',
            sentryOp: 'db.mongodb.upsert',
            sentryName: 'upsert roomgraphs',
            attributes: {
              'db.system': 'mongodb',
              'db.operation': 'upsert',
              'db.collection.name': 'roomgraphs',
            },
          },
          async (h) => {
            const result = await saveRoomGraph(graph);
            const atlas = result.storageBackend === 'mongodb_atlas';
            h.setDescription(`Save RoomGraph to ${result.storageBackend} (collection: roomgraphs)`);
            h.setAttributes({
              'db.backend': result.storageBackend,
              'db.document_id': result.documentId,
            });
            // Memory-only storage is reported as degraded: nothing reached MongoDB Atlas.
            h.setStatus(atlas ? 'ok' : 'degraded');
            return result;
          }
        );
        graph.compileMeta.atlasPersisted = saved.storageBackend === 'mongodb_atlas';
        graph.compileMeta.atlasDocumentId = saved.documentId;
      } else {
        // Never presented as the user's room: the compile metadata says so and the UI shows a banner.
        const sample = structuredClone(PRESET_ROOMS[0].roomGraph);
        graph = {
          ...sample,
          sceneId: `scene-fallback-${crypto.randomBytes(3).toString('hex')}`,
          title: `Fallback sample — ${sample.title}`,
          compileMeta: {
            ...baseMeta,
            model: 'none (fallback sample)',
            runtime: 'fallback-preset',
            fallback: run.failure,
            latencyMs: 0,
            spans: trace.spans,
          },
        };
        await trace.span(
          {
            step: 'compiler.fallback_preset',
            description: `Gemma produced no usable graph; returned bundled sample "${PRESET_ROOMS[0].id}"`,
            sentryOp: 'compiler.fallback_preset',
            sentryName: 'fallback to bundled sample',
            attributes: {
              'preset.id': PRESET_ROOMS[0].id,
              'fallback.stage': run.failure?.stage ?? 'unknown',
            },
          },
          (h) => {
            h.setStatus('fallback', run.failure?.stage);
          }
        );
      }

      graph.compileMeta.latencyMs = Math.round(performance.now() - t0);

      trace.setRootAttributes({
        'gen_ai.usage.input_tokens': run.tokens.prompt,
        'gen_ai.usage.output_tokens': run.tokens.completion,
        'gen_ai.usage.total_tokens': run.tokens.prompt + run.tokens.completion,
        'gen_ai.response.model': run.model,
        'gemma.attempts': run.attempts,
        'reality.compile_id': compileId,
        'reality.runtime': graph.compileMeta.runtime,
      });
      if (run.failure) trace.setRootStatus('fallback', run.failure.stage);
      else trace.setRootStatus(run.attempts > 1 ? 'degraded' : 'ok');

      const validated = RoomGraphSchema.parse(graph);

      recordAgentTrace({
        traceId: trace.traceId || createLocalTraceId(),
        sentryTraced: trace.sentryTraced,
        rootSpanId: trace.rootSpanId,
        compileId,
        timestamp: validated.compileMeta.timestamp,
        model: validated.compileMeta.model,
        runtime: validated.compileMeta.runtime,
        latencyMs: validated.compileMeta.latencyMs,
        tokens: validated.compileMeta.tokens,
        status: succeeded && run.attempts === 1 ? 'ok' : 'degraded',
        errorMessage: run.failure?.reason,
        spans: validated.compileMeta.spans,
      });

      return { roomGraph: validated, ollamaLiveUsed: succeeded };
    }
  );
}
