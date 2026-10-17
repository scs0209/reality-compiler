import * as Sentry from '@sentry/node';
import crypto from 'node:crypto';
import type { CompileTelemetry } from '../shared/roomGraphSchema';

type SpanRecord = CompileTelemetry['spans'][number];
export type SpanStatus = SpanRecord['status'];
type Attributes = SpanRecord['attributes'];

export interface AgentTraceEnvelope {
  // Sentry's trace id when Sentry traced this compile, otherwise a local id.
  traceId: string;
  sentryTraced: boolean;
  rootSpanId: string;
  compileId: string;
  timestamp: string;
  model: string;
  runtime: CompileTelemetry['runtime'];
  latencyMs: number;
  tokens: { prompt: number; completion: number; total: number };
  status: 'ok' | 'degraded' | 'error';
  errorMessage?: string;
  spans: CompileTelemetry['spans'];
}

const recentTraces: AgentTraceEnvelope[] = [];

export function getRecentAgentTraces(): AgentTraceEnvelope[] {
  return recentTraces.slice(0, 25);
}

export function recordAgentTrace(envelope: AgentTraceEnvelope): void {
  recentTraces.unshift(envelope);
  if (recentTraces.length > 50) {
    recentTraces.pop();
  }
}

export function createLocalTraceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

// --- Sentry setup -----------------------------------------------------------------------------

let initialized = false;

// What the SDK reports back about delivery of transactions (not just that they were queued).
const delivery = {
  sent: 0,
  failed: 0,
  lastStatusCode: null as number | null,
  lastError: null as string | null,
};

export interface SentryInitOverrides {
  dsn?: string;
  transport?: Sentry.NodeOptions['transport'];
}

/** Starts Sentry only when a DSN is configured; without one nothing is initialised or sent. */
export function initSentryAgentTracing(overrides: SentryInitOverrides = {}): void {
  if (initialized) return;
  initialized = true;

  const dsn = overrides.dsn ?? process.env.SENTRY_DSN;
  if (!dsn) return;

  const rawRate = process.env.SENTRY_TRACES_SAMPLE_RATE;
  const parsedRate = rawRate === undefined || rawRate === '' ? 1 : Number(rawRate);

  Sentry.init({
    dsn,
    tracesSampleRate: Number.isFinite(parsedRate) ? parsedRate : 1,
    environment: process.env.NODE_ENV || 'development',
    release: 'reality-compiler@1.0.0',
    // Room photos and prompts never leave this server: no PII, and no message content on spans.
    sendDefaultPii: false,
    // Only set when overridden: an explicit `undefined` would replace the SDK's default transport.
    ...(overrides.transport && { transport: overrides.transport }),
  });

  Sentry.getClient()?.on('afterSendEvent', (event, response) => {
    if (event.type !== 'transaction') return;
    const code =
      response && typeof response === 'object' && 'statusCode' in response
        ? response.statusCode
        : undefined;
    if (typeof code === 'number' && code >= 200 && code < 300) {
      delivery.sent += 1;
      delivery.lastStatusCode = code;
      delivery.lastError = null;
    } else {
      delivery.failed += 1;
      delivery.lastStatusCode = typeof code === 'number' ? code : null;
      delivery.lastError =
        response instanceof Error ? response.message : `HTTP ${code ?? 'no response'}`;
    }
  });
}

export function getSentryStatus() {
  const client = Sentry.getClient();
  const enabled = Boolean(client);
  return {
    enabled,
    mode: enabled ? ('sending' as const) : ('disabled' as const),
    reason: enabled ? null : 'SENTRY_DSN is not set, so no spans are sent to Sentry.',
    tracesSampleRate: client?.getOptions().tracesSampleRate ?? null,
    transactionsSent: delivery.sent,
    transactionsFailed: delivery.failed,
    lastStatusCode: delivery.lastStatusCode,
    lastError: delivery.lastError,
  };
}

/** True when everything queued was delivered; false on timeout or a failed delivery (never throws). */
export async function flushSentryAgentTracing(timeoutMs = 2000): Promise<boolean> {
  if (!Sentry.getClient()) return true;
  try {
    return await Sentry.flush(timeoutMs);
  } catch {
    // The SDK rejects the flush when a delivery failed; that failure is already counted in the status.
    return false;
  }
}

// --- Tracing helper ---------------------------------------------------------------------------

export interface SpanHandle {
  setAttributes(attributes: Attributes): void;
  /** `errorType` is only used for the 'fallback' status, where it marks the Sentry span as an error. */
  setStatus(status: SpanStatus, errorType?: string): void;
  setDescription(description: string): void;
}

export interface SpanSpec {
  // Name shown in this app's waterfall and stored in compileMeta.spans.
  step: string;
  description: string;
  // Op and name used on the Sentry side. Sentry's AI Agents view keys off `gen_ai.*` ops.
  sentryOp: string;
  sentryName: string;
  attributes?: Attributes;
}

export interface CompileTrace {
  /** True only when Sentry is initialised and this compile's spans are being recorded by it. */
  readonly sentryTraced: boolean;
  /** Sentry's real trace id, or '' when this compile is not traced by Sentry. */
  readonly traceId: string;
  readonly rootSpanId: string;
  /** Every span this trace ran, in order, with measured durations. */
  readonly spans: SpanRecord[];
  span<T>(spec: SpanSpec, work: (handle: SpanHandle) => Promise<T> | T): Promise<T>;
  setRootAttributes(attributes: Attributes): void;
  setRootStatus(status: SpanStatus, errorType?: string): void;
}

function applyStatus(span: Sentry.Span, status: SpanStatus, errorType?: string) {
  if (status === 'fallback') {
    span.setStatus({ code: 2, message: errorType || 'fallback' });
    if (errorType) span.setAttribute('error.type', errorType);
  } else {
    span.setStatus({ code: 1 });
  }
  span.setAttribute('reality.status', status);
}

function makeTrace(root: Sentry.Span | null): CompileTrace {
  const sentryTraced = Boolean(root && root.isRecording());
  const context = root?.spanContext();
  const spans: SpanRecord[] = [];

  const span: CompileTrace['span'] = async (spec, work) => {
    const attributes: Attributes = { ...spec.attributes, 'app.step': spec.step };
    let status: SpanStatus = 'ok';
    let errorType: string | undefined;
    let description = spec.description;
    const handle: SpanHandle = {
      setAttributes: (extra) => Object.assign(attributes, extra),
      setStatus: (s, e) => {
        status = s;
        errorType = e;
      },
      setDescription: (d) => {
        description = d;
      },
    };

    const run = async (sentrySpan?: Sentry.Span): Promise<Awaited<ReturnType<typeof work>>> => {
      const start = performance.now();
      try {
        return await work(handle);
      } catch (err) {
        status = 'fallback';
        errorType = err instanceof Error ? err.name : 'error';
        throw err;
      } finally {
        spans.push({
          op: spec.step,
          description,
          durationMs: Math.round(performance.now() - start),
          status,
          attributes: { ...attributes },
        });
        if (sentrySpan) {
          sentrySpan.setAttributes(attributes);
          applyStatus(sentrySpan, status, errorType);
        }
      }
    };

    if (!sentryTraced) return run();
    return Sentry.startSpan(
      { name: spec.sentryName, op: spec.sentryOp, attributes },
      (sentrySpan) => run(sentrySpan)
    );
  };

  return {
    sentryTraced,
    traceId: sentryTraced ? (context?.traceId ?? '') : '',
    rootSpanId: sentryTraced ? (context?.spanId ?? '') : '',
    spans,
    span,
    setRootAttributes: (attributes) => {
      if (sentryTraced) root?.setAttributes(attributes);
    },
    setRootStatus: (status, errorType) => {
      if (sentryTraced && root) applyStatus(root, status, errorType);
    },
  };
}

/**
 * Runs one agent invocation (a compile) as a Sentry `gen_ai.invoke_agent` trace. Without Sentry
 * configured the work still runs and the spans are still measured, but nothing is sent.
 */
export function runCompileTrace<T>(
  opts: { agentName: string; model: string },
  fn: (trace: CompileTrace) => Promise<T>
): Promise<T> {
  if (!Sentry.getClient()) return fn(makeTrace(null));
  return Sentry.startSpan(
    {
      name: `invoke_agent ${opts.agentName}`,
      op: 'gen_ai.invoke_agent',
      attributes: {
        'gen_ai.operation.name': 'invoke_agent',
        'gen_ai.agent.name': opts.agentName,
        'gen_ai.request.model': opts.model,
      },
    },
    (root) => fn(makeTrace(root))
  );
}
