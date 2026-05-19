/**
 * errorHandler.ts — Centralized production-safe error handler.
 * Never exposes stack traces in production.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../logging/logger';

export interface AppError extends Error {
  status?: number;
  code?: string;
  isOperational?: boolean;
}

export function createError(message: string, status = 500, code?: string): AppError {
  const err: AppError = new Error(message);
  err.status = status;
  err.code = code;
  err.isOperational = true;
  return err;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isProd = process.env.NODE_ENV === 'production';
  const status = err.status ?? 500;

  // Log all 5xx errors
  if (status >= 500) {
    logger.error('server_error', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  }

  // Never expose internals in production
  const message = isProd && status >= 500
    ? 'Internal server error'
    : err.message;

  res.status(status).json({
    error: {
      message,
      code: err.code ?? 'INTERNAL_ERROR',
      status,
      ...(isProd ? {} : { stack: err.stack }),
    },
  });
}

/** Catch-all for unmatched routes */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      code: 'NOT_FOUND',
      status: 404,
    },
  });
}
