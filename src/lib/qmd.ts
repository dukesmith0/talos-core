/**
 * QMD SDK Wrapper — lazy store with graceful lifecycle
 */

import type { QMDStore, SearchResult, HybridQueryResult, UpdateResult, EmbedResult, EmbedProgress } from '@tobilu/qmd';
import { resolveConfig } from './config.js';

let _store: QMDStore | null = null;
let _closing = false;

export async function getStore(): Promise<QMDStore> {
  if (_closing) throw new Error('QMD store is closing');
  if (_store) return _store;

  const { createStore } = await import('@tobilu/qmd');
  const config = resolveConfig();
  const vaultPath = config.vault_path;

  if (!vaultPath) throw new Error('vault_path not configured');

  _store = await createStore({
    dbPath: getDbPath(),
    config: {
      collections: {
        vault: { path: vaultPath, pattern: '**/*.md' },
      },
    },
  });

  return _store;
}

export async function closeStore(): Promise<void> {
  if (!_store) return;
  _closing = true;
  try {
    await _store.close();
  } finally {
    _store = null;
    _closing = false;
  }
}

export async function search(query: string, limit = 10): Promise<SearchResult[]> {
  const store = await getStore();
  return store.searchLex(query, { limit });
}

export async function vsearch(query: string, limit = 10): Promise<SearchResult[]> {
  const store = await getStore();
  return store.searchVector(query, { limit });
}

export async function query(query: string, limit = 10): Promise<HybridQueryResult[]> {
  const store = await getStore();
  return store.search({ query, limit });
}

export async function updateIndex(): Promise<UpdateResult> {
  const store = await getStore();
  return store.update();
}

export async function embedPending(onProgress?: (p: EmbedProgress) => void): Promise<EmbedResult> {
  const store = await getStore();
  return store.embed({ onProgress });
}

export async function getStatus(): Promise<{ totalDocs: number; pendingEmbedding: number; collections: number }> {
  const store = await getStore();
  const status = await store.getStatus();
  const health = await store.getIndexHealth();
  return {
    totalDocs: (status as Record<string, unknown>).totalDocuments as number ?? 0,
    pendingEmbedding: (health as Record<string, unknown>).needsEmbedding as number ?? 0,
    collections: ((status as Record<string, unknown>).collections as unknown[])?.length ?? 0,
  };
}

export function getDbPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
  return `${home}/.cache/qmd/index.sqlite`;
}

let _qmdAvailable: boolean | null = null;

export async function checkQmdAvailable(): Promise<boolean> {
  if (_qmdAvailable !== null) return _qmdAvailable;
  try {
    await import('@tobilu/qmd');
    _qmdAvailable = true;
  } catch {
    _qmdAvailable = false;
  }
  return _qmdAvailable;
}

export function isQmdAvailable(): boolean {
  // Synchronous check — returns cached result or true (optimistic)
  // Call checkQmdAvailable() first for accurate result
  return _qmdAvailable ?? true;
}

/** Register cleanup on process exit (idempotent). */
let _cleanupRegistered = false;
export function registerCleanup(): void {
  if (_cleanupRegistered) return;
  _cleanupRegistered = true;
  const cleanup = async () => { await closeStore(); };
  process.on('beforeExit', cleanup);
  process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
  process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });
}
