/**
 * server.ts — SeaScope production Express server.
 *
 * Architecture:
 *  - Strict env validation on startup
 *  - Helmet security headers
 *  - CORS whitelist
 *  - Compression
 *  - Structured request logging
 *  - Rate limiting (RMIS proxy exempt — it fans out heavily)
 *  - Centralized error handling
 *  - Graceful shutdown
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { env, validateEnv } from './config/env';
import { logger } from './logging/logger';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';

import healthRoutes    from './routes/healthRoutes';
import rmisRoutes      from './routes/rmisRoutes';
import movementsRoutes from './routes/movementsRoutes';
import dataRoutes      from './routes/dataRoutes';

// ─── Validate environment ─────────────────────────────────────────────────────

try {
  validateEnv();
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

// ─── App ──────────────────────────────────────────────────────────────────────

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      scriptSrc:   ["'self'"],
      imgSrc:      ["'self'", 'data:', 'https:'],
      connectSrc:  ["'self'"],
    },
  },
  hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // Fix Firebase popup auth
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server / curl
    const isLocalDev = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
    if (allowedOrigins.includes(origin) || (env.isDev() && isLocalDev)) return cb(null, true);
    cb(new Error(`CORS: origin not allowed — ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── Trust proxy (load balancer / Nginx) ───────────────────────────────────────
app.set('trust proxy', 1);

// ── Stripe webhook — raw body BEFORE json parser ──────────────────────────────
if (env.STRIPE_SECRET_KEY) {
  app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
}

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Request logging ───────────────────────────────────────────────────────────
app.use(requestLogger);

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health — no rate limiting
app.use('/api', healthRoutes);

// RMIS + movements proxy — exempt from general rate limiter (fans out heavily)
app.use('/api/rmis',      rmisRoutes);
app.use('/api/movements', movementsRoutes);

// General API rate limiter for all other /api/* routes
app.use('/api', apiLimiter);

// Data routes
app.use('/api', dataRoutes);

// Auth routes (only if secrets are configured)
if (env.JWT_SECRET && env.JWT_REFRESH_SECRET && env.ENCRYPTION_KEY) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const authRoutes = require('./routes/authRoutes').default;
  app.use('/api/auth', authRoutes);
  logger.info('Auth routes enabled');
} else {
  logger.warn('Auth routes disabled — missing JWT_SECRET / JWT_REFRESH_SECRET / ENCRYPTION_KEY');
}

// Stripe routes (only if key is configured)
if (env.STRIPE_SECRET_KEY) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const stripeRoutes = require('./routes/stripeRoutes').default;
  app.use('/api/stripe', stripeRoutes);
  logger.info('Stripe routes enabled');
}

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

const server = app.listen(env.PORT, () => {
  logger.info(`SeaScope backend started`, {
    port:        env.PORT,
    environment: env.NODE_ENV,
    rmis:        env.RMIS_API_KEY ? 'configured' : 'MISSING',
    redis:       env.REDIS_URL    ? 'configured' : 'memory-fallback',
    firebase:    env.FIREBASE_PROJECT_ID ? 'configured' : 'disabled',
  });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', { reason: String(reason) });
});

export default app;
