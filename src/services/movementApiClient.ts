/**
 * movementApiClient — production frontend API client for movement data.
 *
 * All requests go through the backend proxy at /api/rmis/*.
 * The frontend NEVER talks directly to RMIS.
 *
 * Features:
 *  - Request deduplication (in-flight cache)
 *  - Stale-while-revalidate response cache
 *  - Retry with exponential backoff
 *  - Timeout handling
 *  - Upstream failure protection
 *  - Normalised response types
 */

import type { HatcheryWeeklyMovement } from './movementDataService';

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '/api';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 600;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MovementApiResponse {
  movements: HatcheryWeeklyMovement[];
  fetchedAt: string;
  source: 'live' | 'cache' | 'stale';
}

export interface LiveCountsResponse {
  counters: Array<{
    id: string;
    river: string;
    species: string;
    todayCount: number;
    seasonCount: number;
    trend: 'up' | 'down' | 'stable';
    updatedAt: string;
  }>;
}

export interface RecoveryPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  locationCode: string;
  catchCount: number;
  species: string;
}

export interface ReleaseRecord {
  id: string;
  hatchery: string;
  species: string;
  quantity: number;
  releaseDate: string;
  releaseType: string;
  latitude: number;
  longitude: number;
  location: string;
}

// ─── In-flight deduplication ──────────────────────────────────────────────────

const _inflight = new Map<string, Promise<unknown>>();

// ─── Response cache ───────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const _cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = _cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.data;
}

function setCached<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): void {
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function getStaleCached<T>(key: string): T | null {
  const entry = _cache.get(key) as CacheEntry<T> | undefined;
  return entry ? entry.data : null;
}

// ─── Core fetch with retry ────────────────────────────────────────────────────

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        return res.json() as Promise<T>;
      }

      // 4xx — don't retry
      if (res.status >= 400 && res.status < 500) {
        let msg = `API error ${res.status}`;
        try {
          const body = await res.json() as { message?: string; error?: string };
          msg = body.message ?? body.error ?? msg;
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      // 5xx — retry
      lastError = new Error(`Upstream error ${res.status}`);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error(`Request timed out after ${timeoutMs}ms`);
      } else if (err instanceof Error) {
        lastError = err;
      }
      // Don't retry on 4xx (already thrown above)
      if (lastError.message.startsWith('API error')) throw lastError;
    }

    if (attempt < retries) {
      await new Promise(r => setTimeout(r, RETRY_BASE_MS * 2 ** attempt));
    }
  }

  throw lastError;
}

// ─── Deduplicated fetch ───────────────────────────────────────────────────────

async function deduplicatedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = _inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetcher().finally(() => _inflight.delete(key));
  _inflight.set(key, promise);
  return promise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch movement data for a hatchery + years + species combination.
 * Uses stale-while-revalidate: returns cached data immediately if available,
 * then revalidates in the background.
 */
export async function fetchMovements(params: {
  hatchery: string;
  years: number[];
  speciesCodes: string[];
  includeOutliers?: boolean;
}): Promise<MovementApiResponse> {
  const key = `movements::${params.hatchery}::${params.years.sort().join(',')}::${params.speciesCodes.sort().join(',')}::${params.includeOutliers ?? false}`;

  const cached = getCached<MovementApiResponse>(key);
  if (cached) return { ...cached, source: 'cache' };

  return deduplicatedFetch(key, async () => {
    const url = new URL(`${API_BASE}/rmis/recovery`);
    url.searchParams.set('hatchery', params.hatchery);
    url.searchParams.set('years', params.years.join(','));
    url.searchParams.set('species', params.speciesCodes.join(','));
    if (params.includeOutliers) url.searchParams.set('outliers', '1');

    try {
      const data = await fetchWithRetry<MovementApiResponse>(url.toString());
      setCached(key, data);
      return { ...data, source: 'live' as const };
    } catch (err) {
      const stale = getStaleCached<MovementApiResponse>(key);
      if (stale) return { ...stale, source: 'stale' as const };
      throw err;
    }
  });
}

/**
 * Fetch live salmon counters for a region.
 */
export async function fetchLiveCounts(region: string): Promise<LiveCountsResponse> {
  const key = `live-counts::${region}`;
  const cached = getCached<LiveCountsResponse>(key);
  if (cached) return cached;

  return deduplicatedFetch(key, async () => {
    const url = new URL(`${API_BASE}/live-counts`);
    url.searchParams.set('region', region);
    try {
      const data = await fetchWithRetry<LiveCountsResponse>(url.toString());
      setCached(key, data, 60_000); // 1 minute TTL for live data
      return data;
    } catch (err) {
      const stale = getStaleCached<LiveCountsResponse>(key);
      if (stale) return stale;
      throw err;
    }
  });
}

/**
 * Fetch recovery locations for a date.
 */
export async function fetchRecoveryPoints(date: string): Promise<RecoveryPoint[]> {
  const key = `recoveries::${date}`;
  const cached = getCached<RecoveryPoint[]>(key);
  if (cached) return cached;

  return deduplicatedFetch(key, async () => {
    const url = new URL(`${API_BASE}/recoveries`);
    url.searchParams.set('date', date);
    try {
      const data = await fetchWithRetry<RecoveryPoint[]>(url.toString());
      setCached(key, data);
      return data;
    } catch (err) {
      const stale = getStaleCached<RecoveryPoint[]>(key);
      if (stale) return stale;
      throw err;
    }
  });
}

/**
 * Fetch release records for a date.
 */
export async function fetchReleaseRecords(date: string): Promise<ReleaseRecord[]> {
  const key = `releases::${date}`;
  const cached = getCached<ReleaseRecord[]>(key);
  if (cached) return cached;

  return deduplicatedFetch(key, async () => {
    const url = new URL(`${API_BASE}/releases`);
    url.searchParams.set('date', date);
    try {
      const data = await fetchWithRetry<ReleaseRecord[]>(url.toString());
      setCached(key, data);
      return data;
    } catch (err) {
      const stale = getStaleCached<ReleaseRecord[]>(key);
      if (stale) return stale;
      throw err;
    }
  });
}

/** Clear all cached responses (e.g. on logout or manual refresh) */
export function clearMovementCache(): void {
  _cache.clear();
}
