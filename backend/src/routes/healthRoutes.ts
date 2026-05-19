import { Router, Request, Response } from 'express';
import { cacheStatus } from '../cache/cacheService';

const router = Router();
const START = Date.now();

router.get('/health', async (_req: Request, res: Response) => {
  const cache = await cacheStatus();
  const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - START) / 1000),
    environment: process.env.NODE_ENV ?? 'development',
    services: {
      cache: { redis: cache.redis ? 'ok' : 'memory-fallback', entries: cache.memoryEntries },
      rmis: process.env.RMIS_API_KEY ? 'configured' : 'missing-key',
    },
    system: { memoryMb: mem, node: process.version, pid: process.pid },
  });
});

router.get('/status', (_req: Request, res: Response) => {
  res.json({ ok: true, uptime: Math.floor((Date.now() - START) / 1000) });
});

export default router;
