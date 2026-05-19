/**
 * requestLogger.ts — HTTP request logging middleware.
 */

import { Request, Response, NextFunction } from 'express';
import { logRequest } from '../logging/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const t0 = Date.now();

  res.on('finish', () => {
    logRequest(
      req.method,
      req.originalUrl,
      res.statusCode,
      Date.now() - t0,
      req.ip ?? req.socket.remoteAddress,
    );
  });

  next();
}
