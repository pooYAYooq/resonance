const SALT = "resonance-avatar-seed-v1";

/**
 * Deterministically hashes a user identifier into a non-reversible seed
 * string suitable for external avatar services. The same input always
 * produces the same output, but the original identifier cannot be recovered
 * from the seed.
 *
 * @param userId - The raw internal user identifier (e.g., Convex document ID).
 * @returns A stable hexadecimal seed string for use in avatar URLs.
 */
export function hashUserId(userId: string): string {
  const input = SALT + userId;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
