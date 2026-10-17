// The session tokens: every secret is compared in constant time.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Constant-time comparison: both sides are hashed first, so neither the content nor the length leaks through timing. */
export function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a, "utf8").digest();
  const digestB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(digestA, digestB);
}

/** 32 random bytes as hex; the browser sends it back on every route after the create. */
export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}
