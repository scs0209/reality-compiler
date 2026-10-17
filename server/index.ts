import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initSentryAgentTracing,
  getRecentAgentTraces,
  getSentryStatus,
  flushSentryAgentTracing,
} from './sentryAgentTracer';
import {
  initAtlasStore,
  getAtlasHealth,
  listRoomGraphs,
  saveRoomGraph,
  getRoomGraphById,
} from './atlasStore';
import { checkOllama, compileRoomPhoto, GEMMA3_SYSTEM_PROMPT } from './gemmaCompiler';
import { PRESET_ROOMS } from '../shared/presetRooms';
import { RoomGraphSchema } from '../shared/roomGraphSchema';
import { evaluateMovingWhatIf } from '../shared/spatialEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local development: read a git-ignored .env from the repo root. Variables that are already set in
// the real environment (for example on DigitalOcean) win over the file.
const envFile = path.resolve(__dirname, '../.env');
if (existsSync(envFile)) {
  if (typeof process.loadEnvFile !== 'function') {
    console.warn('[env] .env found, but this Node version cannot load it (needs 20.12+). Set variables in the shell instead.');
  } else {
    try {
      process.loadEnvFile(envFile);
      console.log('[env] loaded .env');
    } catch (err) {
      console.error(`[env] could not read .env: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

initSentryAgentTracing();

const app = express();
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', async (_req, res) => {
  const atlas = getAtlasHealth();
  const ollama = await checkOllama();
  res.json({
    ok: true,
    service: 'reality-compiler',
    version: '1.0.0',
    schemaVersion: 'roomgraph.v1.2',
    partners: {
      gemma: {
        model: ollama.model,
        ollamaBaseUrl: ollama.endpoint,
        ollamaReachable: ollama.reachable,
        modelInstalled: ollama.modelInstalled,
        systemPromptPreview: GEMMA3_SYSTEM_PROMPT.slice(0, 180) + '...',
      },
      digitalOcean: {
        platform: 'DigitalOcean App Platform + GPU Droplet (Ollama gemma3:4b)',
        specFile: '.do/app.yaml',
      },
      domainTech: {
        demoUrl: process.env.PUBLIC_TECH_DOMAIN || 'https://realitycompiler.tech',
      },
      mongodbAtlas: atlas,
      // `enabled` is true only when a DSN is configured and the SDK is running; the counters are
      // what the SDK reported back about delivery, not just what was queued.
      sentryAgentTracing: {
        ...getSentryStatus(),
        traceCount: getRecentAgentTraces().length,
      },
      entireDevRelay: {
        sessionFile: 'entire-session/devrelay-session.json',
        embeddedInSubmission: true,
      },
      movingQuote: {
        method: 'rule_based_formula',
        tabpfnIntegrated: false,
      },
    },
  });
});

app.get('/api/presets', (_req, res) => {
  res.json({
    presets: PRESET_ROOMS,
  });
});

app.post('/api/compile', async (req, res) => {
  try {
    const {
      photoDataUrl,
      fileName,
      presetId,
      calibrationObject,
      calibrationDimensionCm,
      roomNotes,
    } = req.body || {};

    if (!photoDataUrl && !presetId) {
      res.status(400).json({ error: 'photoDataUrl or presetId is required' });
      return;
    }

    const result = await compileRoomPhoto({
      photoDataUrl: photoDataUrl || PRESET_ROOMS[0].photoDataUrl,
      fileName,
      presetId,
      calibrationObject,
      calibrationDimensionCm: Number(calibrationDimensionCm) || 210,
      roomNotes,
    });

    const whatIf = evaluateMovingWhatIf(result.roomGraph);

    res.json({
      roomGraph: result.roomGraph,
      whatIf,
      ollamaLiveUsed: result.ollamaLiveUsed,
      fallback: result.roomGraph.compileMeta.fallback ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post('/api/what-if', (req, res) => {
  try {
    const { roomGraph, doorWidthOverrideCm, minWalkwayCm } = req.body || {};
    const parsed = RoomGraphSchema.parse(roomGraph);
    const report = evaluateMovingWhatIf(
      parsed,
      doorWidthOverrideCm ? Number(doorWidthOverrideCm) : undefined,
      minWalkwayCm ? Number(minWalkwayCm) : 55
    );
    res.json({ report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

app.get('/api/roomgraphs', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const items = await listRoomGraphs(q);
  res.json({
    items,
    atlas: getAtlasHealth(),
  });
});

app.get('/api/roomgraphs/:sceneId', async (req, res) => {
  const doc = await getRoomGraphById(req.params.sceneId);
  if (!doc) {
    res.status(404).json({ error: 'RoomGraph not found' });
    return;
  }
  res.json({ roomGraph: doc });
});

app.post('/api/roomgraphs', async (req, res) => {
  try {
    const parsed = RoomGraphSchema.parse(req.body?.roomGraph || req.body);
    const saved = await saveRoomGraph(parsed);
    res.json({
      ok: true,
      ...saved,
      atlas: getAtlasHealth(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

app.get('/api/traces', (_req, res) => {
  res.json({
    traces: getRecentAgentTraces(),
  });
});

// Serve production frontend if built
const distDir = path.resolve(__dirname, '../dist');
app.use(express.static(distDir));
app.get(/^\/(?!api).*/, (_req, res, next) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) next();
  });
});

const PORT = Number(process.env.PORT) || 8787;

initAtlasStore().finally(() => {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[Reality Compiler API] listening on http://127.0.0.1:${PORT}`);
    const sentry = getSentryStatus();
    console.log(
      sentry.enabled
        ? `[Sentry] agent tracing on (tracesSampleRate ${sentry.tracesSampleRate})`
        : `[Sentry] agent tracing off: ${sentry.reason}`
    );
  });
});

// Spans are sent in the background; give the SDK a moment to deliver the last ones on shutdown.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    flushSentryAgentTracing().finally(() => process.exit(0));
  });
}
