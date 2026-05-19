import { createLogger, format, transports } from 'winston';
import path from 'path';
import fs from 'fs';

const LOG_DIR = path.join(process.cwd(), 'logs');
try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* ignore */ }

const isProd = process.env.NODE_ENV === 'production';

const devFmt = format.combine(
  format.colorize(),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.printf(({ timestamp, level, message, ...m }) =>
    `${timestamp} ${level}: ${message}${Object.keys(m).length ? ' ' + JSON.stringify(m) : ''}`),
);

const prodFmt = format.combine(format.timestamp(), format.errors({ stack: true }), format.json());

const fileTransports = isProd ? [
  new transports.File({ filename: path.join(LOG_DIR, 'error.log'),    level: 'error', maxsize: 10_485_760, maxFiles: 5 }),
  new transports.File({ filename: path.join(LOG_DIR, 'combined.log'),               maxsize: 20_971_520, maxFiles: 10 }),
] : [];

export const logger = createLogger({
  level: isProd ? 'info' : 'debug',
  format: isProd ? prodFmt : devFmt,
  transports: [new transports.Console(), ...fileTransports],
  exitOnError: false,
});

export function logRequest(method: string, url: string, status: number, ms: number, ip?: string) {
  logger.info('http', { method, url, status, ms, ip });
}
export function logUpstream(svc: string, path: string, status: number, ms: number, cached: boolean) {
  logger.debug('upstream', { svc, path, status, ms, cached });
}
export function logUpstreamError(svc: string, path: string, error: string) {
  logger.warn('upstream_err', { svc, path, error });
}
