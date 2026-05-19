/**
 * env.ts — Strict environment validation.
 * Backend refuses to start if required vars are missing.
 */

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`[env] Missing required environment variable: ${name}`);
  return val;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function optionalInt(name: string, fallback: number): number {
  const val = process.env[name];
  if (!val) return fallback;
  const n = parseInt(val, 10);
  if (isNaN(n)) throw new Error(`[env] ${name} must be an integer, got: ${val}`);
  return n;
}

export function validateEnv(): void {
  // RMIS key is the only hard requirement for the proxy to work
  required('RMIS_API_KEY');
}

export const env = {
  NODE_ENV:            optional('NODE_ENV', 'development'),
  PORT:                optionalInt('PORT', 3001),
  RMIS_API_KEY:        optional('RMIS_API_KEY'),

  // CORS
  CORS_ORIGIN:         optional('CORS_ORIGIN', 'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174'),

  // Auth (optional — routes disabled if missing)
  JWT_SECRET:          optional('JWT_SECRET'),
  JWT_REFRESH_SECRET:  optional('JWT_REFRESH_SECRET'),
  ENCRYPTION_KEY:      optional('ENCRYPTION_KEY'),

  // Database (optional)
  DATABASE_URL:        optional('DATABASE_URL'),

  // Redis (optional — falls back to in-memory cache)
  REDIS_URL:           optional('REDIS_URL'),

  // Firebase Admin (optional — Firebase auth verification disabled if missing)
  FIREBASE_PROJECT_ID:    optional('FIREBASE_PROJECT_ID'),
  FIREBASE_CLIENT_EMAIL:  optional('FIREBASE_CLIENT_EMAIL'),
  FIREBASE_PRIVATE_KEY:   optional('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),

  // External services (optional)
  STRIPE_SECRET_KEY:   optional('STRIPE_SECRET_KEY'),
  SENDGRID_API_KEY:    optional('SENDGRID_API_KEY'),
  SENTRY_DSN:          optional('SENTRY_DSN'),

  // Computed
  isProd:  () => process.env.NODE_ENV === 'production',
  isDev:   () => process.env.NODE_ENV !== 'production',
} as const;
