import { ulid } from 'ulid';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/** Wrapped so tests can stub a deterministic id via Deps if needed. */
export function newId(): string {
  return ulid();
}

/** 32-byte url-safe claim token (returned to the requester once). */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex of a claim token — only the hash is persisted. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time compare of a presented token against a stored hash. */
export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}
