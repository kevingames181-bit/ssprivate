import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import type { JWTPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function requireSecrets() {
  if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET environment variables are required');
  }
}

/**
 * Generate access token
 */
export function generateAccessToken(payload: JWTPayload): string {
  requireSecrets();
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, JWT_SECRET as Secret, options);
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: JWTPayload): string {
  requireSecrets();
  const options: SignOptions = { expiresIn: JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, JWT_REFRESH_SECRET as Secret, options);
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JWTPayload {
  requireSecrets();
  return jwt.verify(token, JWT_SECRET as Secret) as unknown as JWTPayload;
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): JWTPayload {
  requireSecrets();
  return jwt.verify(token, JWT_REFRESH_SECRET as Secret) as unknown as JWTPayload;
}

/**
 * Get token expiration time in seconds
 */
export function getTokenExpiresIn(): number {
  const match = JWT_EXPIRES_IN.match(/(\d+)([smhd])/);
  if (!match) return 3600;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400
  };
  
  return value * (multipliers[unit] || 3600);
}
