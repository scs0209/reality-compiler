import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  flushSentryAgentTracing,
  getSentryStatus,
  initSentryAgentTracing,
} from '../server/sentryAgentTracer';
import { compileRoomPhoto } from '../server/gemmaCompiler';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Sentry with the SDK default transport', () => {
  it('starts with only a DSN and reports delivery failures instead of hiding them', async () => {
    // Regression: passing `transport: undefined` used to replace the SDK's default transport and
    // crash start-up whenever a real DSN was configured. Port 9 is closed locally, so delivery fails.
    expect(() => initSentryAgentTracing({ dsn: 'http://publickey@127.0.0.1:9/1' })).not.toThrow();
    expect(getSentryStatus().enabled).toBe(true);

    // Ollama unreachable keeps the compile fast; the trace is still created and sent.
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('ECONNREFUSED'))));
    const { roomGraph } = await compileRoomPhoto({ photoDataUrl: PNG_1X1, fileName: 'a.png' });
    // A failed delivery must not make flush throw; it reports false and is counted below.
    await expect(flushSentryAgentTracing(3000)).resolves.toBe(false);

    expect(roomGraph.compileMeta.sentryTraceId).toMatch(/^[0-9a-f]{32}$/);
    await vi.waitFor(() => expect(getSentryStatus().transactionsFailed).toBe(1), { timeout: 5000 });
    expect(getSentryStatus().transactionsSent).toBe(0);
    expect(getSentryStatus().lastError).toBeTruthy();
  });
});
