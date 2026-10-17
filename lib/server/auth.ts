// The passcode and the session tokens: every secret is compared in constant time, and wrong
// passcodes from one address are counted so the demo URL cannot be guessed at request speed.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { ForgeStore } from "@/lib/store";

// Wrong passcodes one address gets inside the store's window before it is locked out.
export const PASSCODE_MISS_LIMIT = 20;

export type PasscodeCheck = "right" | "wrong" | "locked" | "unset";

/** Constant-time comparison: both sides are hashed first, so neither the content nor the length leaks through timing. */
export function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a, "utf8").digest();
  const digestB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(digestA, digestB);
}

/** Checks the typed passcode against DEMO_PASSCODE, counting misses per address; unset means setup is not finished. */
export async function checkPasscode(store: ForgeStore, address: string, typed: unknown): Promise<PasscodeCheck> {
  const expected = (process.env.DEMO_PASSCODE ?? "").trim();
  if (!expected) return "unset";
  if ((await store.passcodeMisses(address)) >= PASSCODE_MISS_LIMIT) return "locked";
  if (typeof typed !== "string" || !safeEqual(typed.trim(), expected)) {
    await store.addPasscodeMiss(address);
    return "wrong";
  }
  await store.clearPasscodeMisses(address);
  return "right";
}

/** 32 random bytes as hex; the browser sends it back on every route after the create. */
export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}
