/**
 * dataRoutes.ts — /api/releases /api/recoveries /api/live-counts /api/tides /api/sun
 *
 * Resilience: every route catches ALL errors and returns 200 with empty/fallback data.
 * The backend NEVER returns 500 to the frontend for upstream failures.
 */

import { Router, Request, Response } from 'express';
import { proxyRmisEndpoint } from '../services/rmisService';
import { withCache } from '../cache/cacheService';
import { logger } from '../logging/logger';

const router = Router();

function qp(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(req.query).forEach(([k, v]) => {
    if (typeof v === 'string') out[k] = v;
  });
  return out;
}

function unwrapRecords(body: string): unknown[] {
  try {
    const p = JSON.parse(body);
    if (Array.isArray(p)) return p;
    if (p && typeof p === 'object') {
      if (Array.isArray((p as Record<string, unknown>).records)) return (p as Record<string, unknown>).records as unknown[];
      if (Array.isArray((p as Record<string, unknown>).data))    return (p as Record<string, unknown>).data as unknown[];
    }
  } catch { /* ignore */ }
  return [];
}

// ─── GET /api/releases ────────────────────────────────────────────────────────
router.get('/releases', async (req: Request, res: Response) => {
  try {
    const result = await proxyRmisEndpoint('/release', qp(req), 10 * 60_000);
    res.json(result ? unwrapRecords(result.body) : []);
  } catch (err) {
    logger.warn('releases error', { error: (err as Error).message });
    res.json([]);
  }
});

// ─── GET /api/recoveries ──────────────────────────────────────────────────────
router.get('/recoveries', async (req: Request, res: Response) => {
  try {
    const result = await proxyRmisEndpoint('/recovery', qp(req), 5 * 60_000);
    res.json(result ? unwrapRecords(result.body) : []);
  } catch (err) {
    logger.warn('recoveries error', { error: (err as Error).message });
    res.json([]);
  }
});

// ─── GET /api/live-counts ─────────────────────────────────────────────────────
router.get('/live-counts', async (req: Request, res: Response) => {
  try {
    const region = String(req.query.region ?? 'Southcentral');
    const data = await withCache(`live-counts::${region}`, async () => ({
      counters: [],
      region,
      fetchedAt: new Date().toISOString(),
    }), 60_000);
    res.json(data);
  } catch (err) {
    logger.warn('live-counts error', { error: (err as Error).message });
    res.json({ counters: [], region: String(req.query.region ?? 'Southcentral') });
  }
});

// ─── GET /api/tides ───────────────────────────────────────────────────────────
router.get('/tides', async (req: Request, res: Response) => {
  const region = String(req.query.region ?? 'Southcentral');
  const date   = String(req.query.date   ?? new Date().toISOString().slice(0, 10));
  const FALLBACK = { highTide: '--:--', lowTide: '--:--', sunrise: '--:--', sunset: '--:--', region, date };

  const STATIONS: Record<string, string> = {
    'Southeast':              '9452210',
    'Southcentral':           '9455920',
    'Prince William Sound':   '9454050',
    'Cook Inlet':             '9455920',
    'Kodiak':                 '9457292',
    'Bristol Bay':            '9461380',
    'Arctic-Yukon-Kuskokwim': '9468756',
    'Interior':               '9455920',
  };

  const LAT_LNG: Record<string, [number, number]> = {
    'Southeast':              [58.3,  -134.4],
    'Southcentral':           [61.2,  -149.9],
    'Prince William Sound':   [61.1,  -146.4],
    'Cook Inlet':             [61.2,  -149.9],
    'Kodiak':                 [57.8,  -152.4],
    'Bristol Bay':            [58.7,  -156.9],
    'Arctic-Yukon-Kuskokwim': [64.5,  -165.4],
    'Interior':               [64.8,  -147.7],
  };

  const stationId = STATIONS[region] ?? '9455920';

  try {
    const data = await withCache(`tides::${stationId}::${date}`, async () => {
      let highTide = '--:--', lowTide = '--:--';
      let allHighs: string[] = [], allLows: string[] = [];

      try {
        const noaaUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter`
          + `?begin_date=${date.replace(/-/g, '')}`
          + `&range=24&station=${stationId}&product=predictions`
          + `&datum=MLLW&time_zone=lst_ldt&interval=hilo&units=english&application=seascope&format=json`;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8_000);
        const r = await fetch(noaaUrl, { signal: ctrl.signal });
        clearTimeout(t);
        if (r.ok) {
          const json = await r.json() as { predictions?: Array<{ t: string; type: string }> };
          const preds = json.predictions ?? [];
          allHighs = preds.filter(p => p.type === 'H').map(p => p.t);
          allLows  = preds.filter(p => p.type === 'L').map(p => p.t);
          highTide = allHighs[0] ?? '--:--';
          lowTide  = allLows[0]  ?? '--:--';
        }
      } catch (e) {
        logger.warn('NOAA tides unavailable', { error: (e as Error).message });
      }

      let sunrise = '--:--', sunset = '--:--';
      try {
        const [lat, lng] = LAT_LNG[region] ?? [61.2, -149.9];
        const ssCtrl = new AbortController();
        const st = setTimeout(() => ssCtrl.abort(), 5_000);
        const ssRes = await fetch(
          `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${date}&formatted=0`,
          { signal: ssCtrl.signal },
        );
        clearTimeout(st);
        if (ssRes.ok) {
          const ssJson = await ssRes.json() as { results?: { sunrise: string; sunset: string } };
          if (ssJson.results) {
            const tz = 'America/Anchorage';
            sunrise = new Date(ssJson.results.sunrise).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: tz });
            sunset  = new Date(ssJson.results.sunset).toLocaleTimeString('en-US',  { hour: '2-digit', minute: '2-digit', timeZone: tz });
          }
        }
      } catch (e) {
        logger.warn('Sunrise-sunset unavailable', { error: (e as Error).message });
      }

      return { highTide, lowTide, sunrise, sunset, allHighs, allLows, station: stationId, region, date };
    }, 30 * 60_000);

    res.json(data);
  } catch (err) {
    logger.warn('tides route error', { error: (err as Error).message });
    res.json(FALLBACK);
  }
});

// ─── GET /api/sun ─────────────────────────────────────────────────────────────
router.get('/sun', async (req: Request, res: Response) => {
  const lat  = parseFloat(String(req.query.lat  ?? '61.2'));
  const lng  = parseFloat(String(req.query.lng  ?? '-149.9'));
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
  try {
    const data = await withCache(`sun::${lat}::${lng}::${date}`, async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5_000);
      const r = await fetch(
        `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${date}&formatted=0`,
        { signal: ctrl.signal },
      );
      clearTimeout(t);
      if (!r.ok) throw new Error(`Sunrise-sunset ${r.status}`);
      return r.json();
    }, 60 * 60_000);
    res.json(data);
  } catch (err) {
    logger.warn('sun route error', { error: (err as Error).message });
    res.json({ status: 'unavailable' });
  }
});

// ─── GET /api/analytics ───────────────────────────────────────────────────────
router.get('/analytics', async (req: Request, res: Response) => {
  const year = String(req.query.year ?? new Date().getFullYear());
  try {
    const data = await withCache(`analytics::${year}`, async () => {
      const result = await proxyRmisEndpoint('/release', { run_year: year, perpage: '500' }, 15 * 60_000);
      return { year, records: result ? unwrapRecords(result.body) : [], fetchedAt: new Date().toISOString() };
    }, 15 * 60_000);
    res.json(data);
  } catch (err) {
    logger.warn('analytics error', { error: (err as Error).message });
    res.json({ year, records: [], fetchedAt: new Date().toISOString() });
  }
});

export default router;
