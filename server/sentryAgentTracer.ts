import * as Sentry from '@sentry/node';
import crypto from 'node:crypto';
import type { CompileTelemetry } from '../shared/roomGraphSchema';

export interface AgentTraceEnvelope {
  traceId: string;
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

const sentryDsn = process.env.SENTRY_DSN || '';
let sentryInitialized = false;

export function initSentryAgentTracing(): void {
  if (sentryInitialized) return;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      tracesSampleRate: 1.0,
      environment: process.env.NODE_ENV || 'development',
      release: 'reality-compiler@1.0.0',
    });
  }
  sentryInitialized = true;
}

export function getRecentAgentTraces(): AgentTraceEnvelope[] {
  return recentTraces.slice(0, 25);
}

export function recordAgentTrace(envelope: AgentTraceEnvelope): void {
  recentTraces.unshift(envelope);
  if (recentTraces.length > 50) {
    recentTraces.pop();
  }
}

export function createTraceIds(): { traceId: string; spanId: string } {
  return {
    traceId: crypto.randomBytes(16).toString('hex'),
    spanId: crypto.randomBytes(8).toString('hex'),
  };
}
