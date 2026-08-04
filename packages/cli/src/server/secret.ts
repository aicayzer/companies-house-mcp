/**
 * Secret comparison that works on Node and on workerd.
 *
 * Both values are hashed before comparison so the loop runs over fixed-length
 * digests and cannot leak the position of the first differing byte. Web Crypto
 * is used rather than `node:crypto` so the Cloudflare Worker can share this
 * code.
 */

/**
 * A per-process random key, so the digests compared below are unpredictable to
 * anyone outside this process. With a plain unkeyed hash an attacker could
 * compute candidate digests offline; keying removes that even though nothing
 * here ever emits one.
 */
let comparisonKey: Promise<CryptoKey> | undefined;

function getComparisonKey(): Promise<CryptoKey> {
  comparisonKey ??= crypto.subtle.importKey(
    'raw',
    crypto.getRandomValues(new Uint8Array(32)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return comparisonKey;
}

/** Compare two secrets without revealing where they diverge. */
export async function secretsMatch(actual: string, expected: string): Promise<boolean> {
  // An empty secret is never a match, even against another empty one. Both
  // callers already refuse blanks; this makes the function safe on its own,
  // since it is part of the package's public surface.
  if (!actual || !expected) return false;

  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);

  const key = await getComparisonKey();
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.sign('HMAC', key, actualBytes),
    crypto.subtle.sign('HMAC', key, expectedBytes),
  ]);

  // Both digests are 32 bytes, so the loop runs over a fixed length and cannot
  // reveal the position of the first differing byte.
  const a = new Uint8Array(actualDigest);
  const b = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < a.length; index++) {
    difference |= a[index]! ^ b[index]!;
  }

  return difference === 0 && actualBytes.length === expectedBytes.length;
}

/** The bearer token on a request, or undefined when there is not one. */
export function readBearerToken(authorization: string | null | undefined): string | undefined {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

/**
 * Decide whether a request carries the expected bearer token.
 *
 * Returns false for a missing header as well as a wrong one; callers answer
 * both with 401 so a client cannot distinguish the two.
 */
export async function isAuthorised(
  authorization: string | null | undefined,
  expectedToken: string
): Promise<boolean> {
  const presented = readBearerToken(authorization);
  if (!presented) return false;
  return secretsMatch(presented, expectedToken);
}
