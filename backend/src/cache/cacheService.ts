/**
 * cacheService.ts — Two-tier cache: Redis (primary) + in-memory (fallback).
 */

import { logger } from '../logging/logger';

// ─── In-memory fallback ───────────────────────────────────────────────────────

interface MemEntry { value: string; expiresAt: number; }
const MAX = 2000;
const _mem = new Map<string, MemEntry>();

function memGet(key: string): { value: string; stale: boolean } | null {
  const e = _mem.get(key);
  if (!e) return null;
  return { value: e.value, stale: Date.now() > e.expiresAt };
}
function memSet(key: string, value: string, ttlMs: number) {
  if (_mem.size >= MAX) { const k = _mem.keys().next().value; if (k) _mem.delete(k); }
  _mem.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// ─── Redis (optional) ─────────────────────────────────────────────────────────

let _redis: any = null;
let _ready = false;

function initRedis() {
  const url = process.env.REDIS_URL;
  if (!url || _redis) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require('ioredis');
    _redis = new Redis(url, { maxRetriesPerRequest: 2, connectTimeout: 3000, lazyConnect: true, enableOfflineQueue: false });
    _redis.on('ready', () => { _ready = true; logger.info('Redis connected'); });
    _redis.on('error', (e: Error) => { _ready = false; logger.warn('Redis error', { error: e.message }); });
    _redis.connect().catch(() => { _ready = false; });
  } catch { /* ioredis not installed — memory only */ }
}

initRedis();

// ─── Public API ───────────────────────────────────────────────────────────────

export async function cacheGet(key: string): Promise<{ value: string; stale: boolean; source: 'redis' | 'memory' } | null> {
  if (_redis && _ready) {
    try {
      const [val, ttl] = await Promise.all([_redis.get(key), _redis.ttl(key)]);
      if (val !== null) return { value: val, stale: ttl <= 0, source: 'redis' };
    } catch { /* fall through */ }
  }
  const m = memGet(key);
  return m ? { ...m, source: 'memory' } : null;
}

export async function cacheSet(key: string, value: string, ttlMs: number): Promise<void> {
  if (_redis && _ready) {
    try { await _redis.set(key, value, 'EX', Math.ceil(ttlMs / 1000)); return; } catch { /* fall through */ }
  }
  memSet(key, value, ttlMs);
}

export async function cacheStatus(): Promise<{ redis: boolean; memoryEntries: number }> {
  return { redis: _ready, memoryEntries: _mem.size };
}

export async function withCache<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
  const cached = await cacheGet(key);
  if (cached && !cached.stale) return JSON.parse(cached.value) as T;
  if (cached && cached.stale) {
    setImmediate(async () => {
      try { const f = await fetcher(); await cacheSet(key, JSON.stringify(f), ttlMs); } catch { /* silent */ }
    });
    return JSON.parse(cached.value) as T;
  }
  const fresh = await fetcher();
  await cacheSet(key, JSON.stringify(fresh), ttlMs);
  return fresh;
}
