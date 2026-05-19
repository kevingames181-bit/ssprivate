import * as Sentry from '@sentry/node';
import type { Express } from 'express';

export function initSentry(app?: Express) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn('SENTRY_DSN not set - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  });

  if (app) {
    Sentry.setupExpressErrorHandler(app);
  }

  console.log('Sentry initialized');
}

export { Sentry };
