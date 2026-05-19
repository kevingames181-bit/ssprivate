/**
 * rmisRoutes.ts — RMIS proxy routes. Never returns 500.
 */

import { Router, Request, Response } from 'express';
import { proxyRmisEndpoint, proxyOfficialDataFile } from '../services/rmisService';
import { logger } from '../logging/logger';

const router = Router();

function qp(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(req.query).forEach(([k, v]) => { if (typeof v === 'string') out[k] = v; });
  return out;
}

async function handleProxy(path: string, ttlMs: number, req: Request, res: Response) {
  const result = await proxyRmisEndpoint(path, qp(req), ttlMs);
  if (!result) {
    // Upstream unavailable — return empty paged response so frontend doesn't break
    res.set('X-Cache', 'UNAVAILABLE');
    res.json({ records: [], totalCount: 0, count: 0, page: 1 });
    return;
  }
  res.set('X-Cache', result.stale ? 'STALE' : 'MISS');
  res.set('Content-Type', result.contentType);
  res.status(200).send(result.body);
}

router.get('/recovery',    (req, res) => handleProxy('/recovery',    5  * 60_000, req, res));
router.get('/release',     (req, res) => handleProxy('/release',     10 * 60_000, req, res));
router.get('/location',    (req, res) => handleProxy('/location',    60 * 60_000, req, res));
router.get('/catchsample', (req, res) => handleProxy('/catchsample', 5  * 60_000, req, res));
router.get('/description', (req, res) => handleProxy('/description', 60 * 60_000, req, res));
router.get('/files',       (req, res) => handleProxy('/files',       60 * 60_000, req, res));

router.get('/official-data/:filename', async (req: Request, res: Response) => {
  const filename = String(req.params.filename ?? '');
  try {
    const result = await proxyOfficialDataFile(filename);
    if (!result) { res.status(404).send(''); return; }
    res.set('Content-Type', result.contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.status(200).send(result.body);
  } catch (err) {
    if ((err as Error).message === 'Invalid official data filename') {
      res.status(400).json({ error: 'invalid_filename' });
    } else {
      logger.warn('official-data error', { filename, error: (err as Error).message });
      res.status(404).send('');
    }
  }
});

export default router;
