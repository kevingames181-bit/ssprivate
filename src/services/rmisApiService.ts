/**
 * RMIS (Regional Mark Information System) API Service
 * Regional Mark Processing Center (RMPC) — Pacific States Marine Fisheries Commission
 *
 * API Base: https://phish.rmis.org
 * Documentation: https://www.rmpc.org/submission/api/
 * API Key: provided via VITE_RMIS_API_KEY env var
 *
 * Endpoints:
 *   GET /recovery      — CWT recovery records
 *   GET /release       — CWT release records
 *   GET /location      — Location reference data
 *   GET /catchsample   — Catch & sample records
 *   GET /description   — Dataset description/metadata
 *   GET /files         — Uploaded file listing
 *
 * CORS note: phish.rmis.org reflects the request Origin in Access-Control-Allow-Origin
 * but does NOT allow the xapikey header in preflight. The API key is passed as a query
 * param instead, which bypasses the preflight restriction.
 */

// Prefer backend proxy when available (more reliable than browser CORS/key handling).
// - Backend proxy: `${VITE_API_URL}/api/rmis/*` injects key server-side
// - Direct RMIS:    `https://phish.rmis.org/*` uses `xapikey` query param (requires VITE_RMIS_API_KEY)
const RAW_API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '');
const API_URL =
  typeof window !== 'undefined' && RAW_API_URL?.startsWith('/')
    ? `${window.location.origin}${RAW_API_URL}`
    : RAW_API_URL;
const RMIS_API_KEY = import.meta.env.VITE_RMIS_API_KEY as string | undefined;
const ALLOW_DIRECT_DATA_FALLBACK =
  import.meta.env.DEV || import.meta.env.VITE_ALLOW_DIRECT_DATA_FALLBACK === 'true';
// If API_URL points to the backend API root (commonly "/api"), RMIS proxy lives at `${API_URL}/rmis/*`.
// Example:
//   VITE_API_URL=/api            -> http://127.0.0.1:5174/api/rmis/location
//   VITE_API_URL=http://host/api -> http://host/api/rmis/location
const RMIS_DIRECT_BASE = 'https://phish.rmis.org';
const RMIS_PROXY_BASE = API_URL ? `${API_URL}/rmis` : null;
const OFFICIAL_DATA_PROXY_BASE = API_URL ? `${API_URL}/rmis/official-data` : null;
const OFFICIAL_DATA_DIRECT_BASE = 'https://www.rmpc.org/pub/data';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RmisPagedResponse<T> {
  totalCount: number;
  count: number;
  page: number;
  records: T[];
}

export interface RmisRecovery {
  id: string;
  record_code: string;
  format_version: string;
  submission_date: string;
  reporting_agency: string;
  sampling_agency?: string;
  recovery_id: string;
  species: string;
  run_year: number;
  recovery_date_year: number;
  recovery_date_month: number;
  recovery_date_day: number;
  recovery_date_type?: string;
  period_type: string;
  period?: string;
  fishery: string;
  gear?: string;
  adclip_selective_fishery?: string;
  estimation_level?: string;
  recovery_location_code: string;
  sampling_site?: string;
  recorded_mark?: string;
  tag_code?: string;
  tag_status?: string;
  unresolved_reason?: string;
  cwt_1st_mark?: string;
  cwt_1st_mark_count?: number;
  cwt_2nd_mark?: string;
  cwt_2nd_mark_count?: number;
  estimated_number?: number;
  number_cwt_estimated?: number;  // actual field name returned by /recovery API
  sampled_maturity?: string;
  sampled_sex?: string;
  sampled_run?: string;
  sampled_length?: number;
  sampled_weight?: number;
  sampled_age?: number;
  detection_method?: string;
  [key: string]: unknown;
}

export interface RmisRelease {
  id: string;
  record_code: string;
  format_version: string;
  submission_date: string;
  reporting_agency: string;
  release_agency: string;
  coordinator?: string;
  tag_code_or_release_id: string;
  species: string;
  run?: string;
  rearing_type: string;
  release_stage?: string;
  release_strategy?: string;
  brood_year: number;
  release_year: number;
  release_date_year?: number;
  release_date_month?: number;
  release_date_day?: number;
  release_location_code: string;
  hatchery_location_code?: string;
  stock_location_code?: string;
  psc_region?: string;
  psc_basin?: string;
  tag_type?: string;
  marks?: string;
  cwt_1st_mark?: string;
  cwt_1st_mark_count?: number;
  cwt_2nd_mark?: string;
  cwt_2nd_mark_count?: number;
  non_cwt_1st_mark?: string;
  non_cwt_1st_mark_count?: number;
  non_cwt_2nd_mark?: string;
  non_cwt_2nd_mark_count?: number;
  cwt_count?: number;
  non_cwt_count?: number;
  total_release?: number;
  study_type?: string;
  study_integrity?: string;
  stock_origin_type?: string;
  related_group_type?: string;
  related_group_id?: string;
  avg_weight?: number;
  avg_length?: number;
  [key: string]: unknown;
}

export interface RmisLocation {
  id: string;
  location_code: string;
  location_name?: string;  // legacy field name (may not be present)
  name?: string;           // actual field name returned by API
  location_type: string;
  psc_region?: string;
  psc_basin?: string;
  state_or_province?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  epa_reach?: string | null;
  [key: string]: unknown;
}

export interface RmisCatchSample {
  id: string;
  record_code: string;
  format_version: string;
  submission_date: string;
  reporting_agency: string;
  sampling_agency?: string;
  fishery: string;
  period_type: string;
  period?: string;
  run_year: number;
  sample_year?: number;
  sample_month?: number;
  sample_day?: number;
  species: string;
  adclip_selective_fishery?: string;
  sample_type: string;
  catch_location_code: string;
  sampling_site?: string;
  pool_id?: string;
  total_catch?: number;
  total_examined?: number;
  cwt_count?: number;
  adclip_count?: number;
  unclipped_count?: number;
  [key: string]: unknown;
}

export interface RmisDescription {
  id: string;
  record_code: string;
  format_version: string;
  submission_date: string;
  reporting_agency: string;
  data_type: string;
  description_year?: number;
  description_text?: string;
  [key: string]: unknown;
}

export interface RmisFile {
  filename: string;
  size: string;
  mode: number;
  uid: number;
  gid: number;
  accessed: string;
  modified: string;
  changed: string;
  created: string;
}

// ─── Species code map ─────────────────────────────────────────────────────────

export const SPECIES_CODES: Record<string, string> = {
  '1': 'Chinook Salmon',
  '2': 'Coho Salmon',
  '3': 'Steelhead',
  '4': 'Sockeye Salmon',
  '5': 'Pink Salmon',
  '6': 'Chum Salmon',
  '7': 'Cutthroat Trout',
  '8': 'Atlantic Salmon',
  '9': 'Other',
};

export const FISHERY_CODES: Record<string, string> = {
  '10': 'Ocean Sport',
  '11': 'Ocean Troll',
  '12': 'Ocean Net',
  '20': 'Puget Sound Sport',
  '21': 'Puget Sound Net',
  '30': 'Columbia River Sport',
  '40': 'Alaska Sport',
  '41': 'Alaska Net',
  '50': 'BC Sport',
  '60': 'Escapement',
  '70': 'Hatchery Return',
  '80': 'Research',
  '90': 'Other',
};

/**
 * True for RMIS recoveries that represent ocean / fishery (non-hatchery, non-escapement) catches.
 * Uses RMPC-style fishery code bands: 10–19 troll/marine, 20–29 net/seine, 40–49 sport,
 * 80–89 high seas. Excludes 50–59 escapement (code 50 hatchery-related), hatchery return (70),
 * and other bands not listed above.
 */
export function isOceanNonHatcheryFishery(fishery: string | undefined): boolean {
  if (fishery == null || fishery === '') return false;
  const n = parseInt(String(fishery).trim(), 10);
  if (Number.isNaN(n)) return false;
  if (n >= 10 && n <= 19) return true;
  if (n >= 20 && n <= 29) return true;
  if (n >= 40 && n <= 49) return true;
  if (n >= 80 && n <= 89) return true;
  return false;
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function rmisGet<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const buildUrl = (base: string, includeKey: boolean) => {
    const url = new URL(`${base}${path}`);
    if (includeKey && RMIS_API_KEY) url.searchParams.set('xapikey', RMIS_API_KEY);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    });
    return url;
  };

  // 1) Try proxy first (keeps API key server-side). Fall through on network errors.
  if (RMIS_PROXY_BASE) {
    try {
      const proxyUrl = buildUrl(RMIS_PROXY_BASE, false);
      const res = await fetch(proxyUrl.toString());
      if (res.ok) return res.json() as Promise<T>;
      // Non-network error (4xx/5xx from proxy) — fall through to direct only if backend is down
      if (res.status < 500 || !ALLOW_DIRECT_DATA_FALLBACK) {
        throw new Error(`Data API error ${res.status}: ${res.statusText} (${path})`);
      }
      console.warn(`[Data] proxy returned ${res.status}, using fallback data route`);
    } catch (err) {
      // ECONNREFUSED / network failure — backend not running, fall through to direct
      if (err instanceof Error && err.message.includes('Data API error')) throw err;
      if (!ALLOW_DIRECT_DATA_FALLBACK) throw new Error('Data source unavailable.');
      console.warn('[Data] proxy unreachable, using fallback data route:', (err as Error).message);
    }
  }

  // 2) Direct RMIS mode (requires VITE_RMIS_API_KEY — key is visible in bundle, dev/fallback only).
  if (!ALLOW_DIRECT_DATA_FALLBACK || !RMIS_API_KEY) {
    throw new Error('Data source unavailable.');
  }
  const directUrl = buildUrl(RMIS_DIRECT_BASE, true);
  const directRes = await fetch(directUrl.toString());
  if (!directRes.ok) {
    throw new Error(`Data API error ${directRes.status}: ${directRes.statusText} (${path})`);
  }
  return directRes.json() as Promise<T>;
}

// ─── Public API functions ─────────────────────────────────────────────────────

/** Normalize params: rename 'limit' → 'perpage' to match RMIS API spec */
function normalizeParams(params: Record<string, string>): Record<string, string> {
  const out = { ...params };
  if (out.limit !== undefined) {
    out.perpage = out.perpage ?? out.limit;
    delete out.limit;
  }
  return out;
}

/**
 * Fetch CWT recovery records.
 * @param params  Query params: species, run_year, reporting_agency, page, perpage, etc.
 */
export async function fetchRecoveries(
  params: Record<string, string> = {}
): Promise<RmisPagedResponse<RmisRecovery>> {
  return rmisGet<RmisPagedResponse<RmisRecovery>>('/recovery', normalizeParams(params));
}

/**
 * Fetch CWT release records.
 */
export async function fetchReleases(
  params: Record<string, string> = {}
): Promise<RmisPagedResponse<RmisRelease>> {
  return rmisGet<RmisPagedResponse<RmisRelease>>('/release', normalizeParams(params));
}

/**
 * Fetch location reference data.
 */
export async function fetchLocations(
  params: Record<string, string> = {}
): Promise<RmisPagedResponse<RmisLocation>> {
  return rmisGet<RmisPagedResponse<RmisLocation>>('/location', normalizeParams(params));
}

/**
 * Fetch catch & sample records.
 */
export async function fetchCatchSamples(
  params: Record<string, string> = {}
): Promise<RmisPagedResponse<RmisCatchSample>> {
  return rmisGet<RmisPagedResponse<RmisCatchSample>>('/catchsample', normalizeParams(params));
}

/**
 * Fetch dataset description / metadata records.
 */
export async function fetchDescriptions(
  params: Record<string, string> = {}
): Promise<RmisPagedResponse<RmisDescription>> {
  return rmisGet<RmisPagedResponse<RmisDescription>>('/description', normalizeParams(params));
}

/**
 * Fetch the list of uploaded files.
 */
export async function fetchFiles(): Promise<RmisFile[]> {
  return rmisGet<RmisFile[]>('/files');
}

export async function fetchOfficialRecoveryDataFile(filename: string): Promise<string> {
  if (!/^(?:RC\d+_[A-Z0-9]+_\d{4}|LC\d+_[A-Z0-9]+_FULLSET)\.csv$/i.test(filename)) {
    throw new Error('Invalid official data filename.');
  }

  const buildUrl = (base: string) => `${base.replace(/\/+$/, '')}/${encodeURIComponent(filename)}`;
  const urls = [
    ...(OFFICIAL_DATA_PROXY_BASE ? [buildUrl(OFFICIAL_DATA_PROXY_BASE)] : []),
    ...(ALLOW_DIRECT_DATA_FALLBACK ? [buildUrl(OFFICIAL_DATA_DIRECT_BASE)] : []),
  ];

  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.text();
      if (res.status === 404) return '';
      lastError = new Error(`Official data file error ${res.status}: ${res.statusText}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Official data file unavailable.');
}

// ─── Convenience aggregation helpers ─────────────────────────────────────────

/** Aggregate recovery records by species code → display name + count */
export function aggregateRecoveriesBySpecies(
  records: RmisRecovery[]
): Array<{ species: string; count: number; estimated: number }> {
  const map = new Map<string, { count: number; estimated: number }>();
  records.forEach(r => {
    const name = SPECIES_CODES[r.species] ?? `Species ${r.species}`;
    const entry = map.get(name) ?? { count: 0, estimated: 0 };
    entry.count += 1;
    entry.estimated += r.estimated_number ?? 1;
    map.set(name, entry);
  });
  return Array.from(map.entries())
    .map(([species, v]) => ({ species, ...v }))
    .sort((a, b) => b.count - a.count);
}

/** Aggregate release records by brood year */
export function aggregateReleasesByYear(
  records: RmisRelease[]
): Array<{ year: number; total: number; cwt: number }> {
  const map = new Map<number, { total: number; cwt: number }>();
  records.forEach(r => {
    const yr = r.brood_year ?? r.release_year;
    if (!yr) return;
    const entry = map.get(yr) ?? { total: 0, cwt: 0 };
    entry.total += r.total_release ?? 0;
    entry.cwt += r.cwt_count ?? 0;
    map.set(yr, entry);
  });
  return Array.from(map.entries())
    .map(([year, v]) => ({ year, ...v }))
    .sort((a, b) => a.year - b.year);
}

/** Aggregate catch samples by fishery code → display name + total catch */
export function aggregateCatchByFishery(
  records: RmisCatchSample[]
): Array<{ fishery: string; totalCatch: number; examined: number }> {
  const map = new Map<string, { totalCatch: number; examined: number }>();
  records.forEach(r => {
    const name = FISHERY_CODES[r.fishery] ?? `Fishery ${r.fishery}`;
    const entry = map.get(name) ?? { totalCatch: 0, examined: 0 };
    entry.totalCatch += r.total_catch ?? 0;
    entry.examined += r.total_examined ?? 0;
    map.set(name, entry);
  });
  return Array.from(map.entries())
    .map(([fishery, v]) => ({ fishery, ...v }))
    .sort((a, b) => b.totalCatch - a.totalCatch);
}
