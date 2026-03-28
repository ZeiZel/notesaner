/**
 * Pure utility functions for SHA-256 content hashing.
 *
 * All functions in this module are side-effect-free — they depend only on their
 * inputs and Node.js's built-in `crypto` module. This makes them straightforward
 * to unit-test and safe to call from any context.
 */

import * as crypto from 'crypto';

/**
 * Compute a SHA-256 hex digest of the given string or Buffer.
 *
 * Matches the algorithm used by `FilesService.computeContentHash` so that hashes
 * computed in different parts of the application are always comparable.
 *
 * @param input - UTF-8 string or raw Buffer to hash.
 * @returns 64-character lowercase hex string.
 */
export function sha256(input: string | Buffer): string {
  const hash = crypto.createHash('sha256');

  if (typeof input === 'string') {
    hash.update(input, 'utf-8');
  } else {
    hash.update(input);
  }

  return hash.digest('hex');
}

/**
 * Compare two content-hash strings in constant time to prevent timing-attack
 * side-channels that could leak partial hash values.
 *
 * Both inputs are expected to be 64-character hex strings (SHA-256 output).
 * If the lengths differ the comparison short-circuits and returns `false` — the
 * length mismatch alone is not secret so early return is acceptable.
 *
 * @param a - First hash string.
 * @param b - Second hash string.
 * @returns `true` when the two hashes are identical.
 */
export function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  // timingSafeEqual requires Buffer inputs of equal length.
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Determine whether `content` produces a hash that differs from `storedHash`.
 *
 * Convenience wrapper that combines `sha256` and `hashesMatch` into a single
 * call. Returns `true` when the content has been modified (hashes differ).
 *
 * @param content     - Current file content (string or Buffer).
 * @param storedHash  - Previously stored SHA-256 hex digest.
 * @returns `true` when the computed hash does NOT match `storedHash`.
 */
export function contentDiffersFromHash(content: string | Buffer, storedHash: string): boolean {
  const current = sha256(content);
  return !hashesMatch(current, storedHash);
}
