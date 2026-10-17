import { MongoClient, type Collection } from 'mongodb';
import type { RoomGraph } from '../shared/roomGraphSchema';
import { PRESET_ROOMS } from '../shared/presetRooms';

let client: MongoClient | null = null;
let collection: Collection<RoomGraph> | null = null;
let connectionStatus: 'connected_atlas' | 'local_memory_fallback' = 'local_memory_fallback';
let lastAtlasError: string | null = null;

// Seeded in-memory store so Atlas Search / Gallery works immediately and syncs with MongoDB Atlas when MONGODB_URI is provided
const memoryStore = new Map<string, RoomGraph>();
for (const preset of PRESET_ROOMS) {
  memoryStore.set(preset.roomGraph.sceneId, structuredClone(preset.roomGraph));
}

export async function initAtlasStore(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    connectionStatus = 'local_memory_fallback';
    return;
  }

  try {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 3500,
    });
    await client.connect();
    const dbName = process.env.MONGODB_DB || 'reality_compiler';
    const db = client.db(dbName);
    collection = db.collection<RoomGraph>('roomgraphs');
    await collection.createIndex({ sceneId: 1 }, { unique: true });
    await collection.createIndex({ title: 'text', 'nodes.labelKo': 'text', 'nodes.label': 'text' });
    connectionStatus = 'connected_atlas';

    // Ensure presets are upserted into Atlas
    for (const preset of PRESET_ROOMS) {
      await collection.updateOne(
        { sceneId: preset.roomGraph.sceneId },
        { $set: preset.roomGraph },
        { upsert: true }
      );
    }
  } catch (err) {
    lastAtlasError = err instanceof Error ? err.message : String(err);
    connectionStatus = 'local_memory_fallback';
    collection = null;
  }
}

export function getAtlasHealth() {
  return {
    status: connectionStatus,
    uriConfigured: Boolean(process.env.MONGODB_URI),
    database: process.env.MONGODB_DB || 'reality_compiler',
    collection: 'roomgraphs',
    storedCount: memoryStore.size,
    lastError: lastAtlasError,
  };
}

export async function saveRoomGraph(graph: RoomGraph): Promise<{
  persisted: boolean;
  documentId: string;
  storageBackend: 'mongodb_atlas' | 'memory_replica';
}> {
  memoryStore.set(graph.sceneId, structuredClone(graph));

  if (collection) {
    try {
      const res = await collection.updateOne(
        { sceneId: graph.sceneId },
        { $set: graph },
        { upsert: true }
      );
      const docId =
        res.upsertedId?.toString() ||
        graph.compileMeta.atlasDocumentId ||
        `atlas_${graph.sceneId}`;
      return {
        persisted: true,
        documentId: docId,
        storageBackend: 'mongodb_atlas',
      };
    } catch (err) {
      lastAtlasError = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    persisted: true,
    documentId: graph.compileMeta.atlasDocumentId || `mem_${graph.sceneId}`,
    storageBackend: 'memory_replica',
  };
}

export async function listRoomGraphs(query?: string): Promise<RoomGraph[]> {
  const q = (query || '').trim().toLowerCase();

  if (collection) {
    try {
      const docs = await collection
        .find({})
        .sort({ 'compileMeta.timestamp': -1 })
        .limit(30)
        .toArray();
      if (docs.length > 0) {
        for (const d of docs) {
          memoryStore.set(d.sceneId, d);
        }
      }
    } catch (err) {
      lastAtlasError = err instanceof Error ? err.message : String(err);
    }
  }

  const all = Array.from(memoryStore.values());
  if (!q) return all;

  return all.filter(
    (g) =>
      g.title.toLowerCase().includes(q) ||
      g.sceneId.toLowerCase().includes(q) ||
      g.nodes.some(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.labelKo.toLowerCase().includes(q) ||
          n.epistemic.toLowerCase().includes(q)
      )
  );
}

export async function getRoomGraphById(sceneId: string): Promise<RoomGraph | null> {
  if (collection) {
    try {
      const doc = await collection.findOne({ sceneId });
      if (doc) return doc;
    } catch {
      // fallback to memoryStore
    }
  }
  return memoryStore.get(sceneId) || null;
}
