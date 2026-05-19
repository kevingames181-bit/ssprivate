/**
 * rmisService.ts — RMIS upstream proxy.
 * Never throws to callers — returns null/empty on all failures.
 * Callers decide what empty means (empty array, fallback data, etc.)
 */

import { cacheGet, cacheSet } from '../cache/cacheService';
import { logger } from '../logging/logger';

const RMIS_BASE    = 'https://phish.rmis.org';
const OFFICIAL_BASE = 'https://www.rmpc.org/pub/data';
const TIMEOUT_MS   = 10_000; // 10s — fail fast, don't block the response
const MAX_RETRIES  = 1;      // 1 retry only — total max 20s per request
const _inflight    = new Map<string, Promise<{ body: string; contentType: string } | null>>();

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function fetchUpstream(
  url: string,
  attempt = 0,
): Promise<{ body: string; contentType: string; status: number } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'xapikey': process.env.RMIS_API_KEY ?? '',
        'Accept': 'application/json, text/csv, */*',
        'User-Agent': 'SeaScope/2.0',
      },
    });
    clearTimeout(timer);

    const contentType = res.headers.get('content-type') ?? 'application/json';
    const body = await res.text();

    if (res.ok) return { body, contentType, status: res.status };
    // 4xx — don't retry, return as-is
    if (res.status >= 400 && res.status < 500) return { body, contentType, status: res.status };
    // 5xx — retry once
    throw new Error(`RMIS upstream ${res.status}`);
  } catch (err) {
    clearTimeout(timer);
    const msg = (err as Error).message ?? String(err);

    if (attempt < MAX_RETRIES) {
      logger.debug(`RMIS retry ${attempt + 1}`, { url: url.slice(0, 80), error: msg });
      await new Promise(r => setTimeout(r, 800));
      return fetchUpstream(url, attempt + 1);
    }

    // All retries exhausted — log as warn (not error), return null
    logger.warn('RMIS upstream unavailable', { url: url.slice(0, 80), error: msg });
    return null;
  }
}

// ─── Public: proxy RMIS endpoint ─────────────────────────────────────────────

/**
 * Returns { body, contentType, stale } on success.
 * Returns null when upstream is unreachable and no cache exists.
 * NEVER throws.
 */
export async function proxyRmisEndpoint(
  path: string,
  queryParams: Record<string, string> = {},
  ttlMs = 5 * 60_000,
): Promise<{ body: string; contentType: string; stale: boolean } | null> {
  const url = new URL(`${RMIS_BASE}${path}`);
  Object.entries(queryParams).forEach(([k, v]) => url.searchParams.set(k, v));
  const key = `rmis::${url.toString()}`;

  // Serve fresh cache immediately
  const cached = await cacheGet(key);
  if (cached && !cached.stale) {
    return { body: cached.value, contentType: 'application/json', stale: false };
  }

  // Deduplicate in-flight requests
  let p = _inflight.get(key);
  if (!p) {
    p = fetchUpstream(url.toString())
      .then(async result => {
        if (!result) {
          // Upstream failed — serve stale if available
          if (cached) {
            logger.debug('RMIS serving stale cache', { path });
            return { body: cached.value, contentType: 'application/json' };
          }
          return null;
        }
        if (result.status < 400) {
          await cacheSet(key, result.body, ttlMs);
        }
        return { body: result.body, contentType: result.contentType };
      })
      .finally(() => _inflight.delete(key));

    _inflight.set(key, p);
  }

  const result = await p;
  if (!result) return null;
  return { ...result, stale: Boolean(cached?.stale) };
}

// ─── Public: proxy official CSV data ─────────────────────────────────────────

export async function proxyOfficialDataFile(
  filename: string,
): Promise<{ body: string; contentType: string } | null> {
  if (!/^(?:RC\d+_[A-Z0-9]+_\d{4}|LC\d+_[A-Z0-9]+_FULLSET)\.csv$/i.test(filename)) {
    throw new Error('Invalid official data filename');
  }

  const url = `${OFFICIAL_BASE}/${encodeURIComponent(filename)}`;
  const key = `official::${filename}`;

  const cached = await cacheGet(key);
  if (cached && !cached.stale) return { body: cached.value, contentType: 'text/csv; charset=utf-8' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'text/csv,*/*' } });
    clearTimeout(timer);

    if (res.status === 404) return null;
    if (!res.ok) {
      if (cached) return { body: cached.value, contentType: 'text/csv; charset=utf-8' };
      logger.warn('Official data upstream error', { filename, status: res.status });
      return null;
    }

    const body = await res.text();
    const contentType = res.headers.get('content-type') ?? 'text/csv; charset=utf-8';
    await cacheSet(key, body, 24 * 60 * 60_000);
    return { body, contentType };
  } catch (err) {
    clearTimeout(timer);
    if (cached) return { body: cached.value, contentType: 'text/csv; charset=utf-8' };
    logger.warn('Official data fetch failed', { filename, error: (err as Error).message });
    return null;
  }
}
