import { createHash, randomBytes } from 'crypto';

/** Opaque bearer token for links that can be opened without a user session. */
export function createShareLinkToken() {
  return randomBytes(32).toString('base64url');
}

/** Store only this hash; return the raw token to the creator once. */
export function hashShareLinkToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function isPlausibleShareLinkToken(token: string) {
  return /^[A-Za-z0-9_-]{20,128}$/.test(token);
}

export function shareLinkExpiresAt(ttlMs: number, now = new Date()) {
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new RangeError('Share link TTL must be a positive integer');
  }
  return new Date(now.getTime() + ttlMs);
}

export function isShareLinkExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}
