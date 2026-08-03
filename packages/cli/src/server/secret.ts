/**
 * Secret comparison that works on Node and on workerd.
 *
 * Both values are hashed before comparison so the loop runs over fixed-length
 * digests and cannot leak the position of the first differing byte. Web Crypto
 * is used rather than `node:crypto` so the Cloudflare Worker can share this
 * code.
 */

/** Compare two secrets without revealing where they diverge. */
export async function secretsMatch(actual: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);

  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', actualBytes),
    crypto.subtle.digest('SHA-256', expectedBytes),
  ]);

  const a = new Uint8Array(actualDigest);
  const b = new Uint8Array(expectedDigest);

  let difference = a.length ^ b.length;
  for (let index = 0; index < a.length; index++) {
    difference |= a[index]! ^ b[index]!;
  }

  // The length check guards the degenerate case where two different secrets
  // share a digest, which cannot happen in practice but costs nothing to rule
  // out.
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
