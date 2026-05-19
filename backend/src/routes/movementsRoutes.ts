import { Router, Request, Response } from 'express';
import { proxyRmisEndpoint } from '../services/rmisService';

const router = Router();

function qp(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(req.query).forEach(([k, v]) => { if (typeof v === 'string') out[k] = v; });
  return out;
}

async function proxy(path: string, ttl: number, req: Request, res: Response) {
  const result = await proxyRmisEndpoint(path, qp(req), ttl);
  if (!result) { res.json({ records: [], totalCount: 0, count: 0, page: 1 }); return; }
  res.set('X-Cache', result.stale ? 'STALE' : 'MISS');
  res.set('Content-Type', result.contentType);
  res.status(200).send(result.body);
}

router.get('/',         (req, res) => proxy('/recovery', 5  * 60_000, req, res));
router.get('/live',     (req, res) => proxy('/recovery', 60 * 1_000,  req, res));
router.get('/history',  (req, res) => proxy('/recovery', 30 * 60_000, req, res));
router.get('/recovery', (req, res) => proxy('/recovery', 5  * 60_000, req, res));
router.get('/releases', (req, res) => proxy('/release',  10 * 60_000, req, res));

export default router;
