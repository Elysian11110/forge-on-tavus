// The signature Tavus puts on the synthesize_profile request: the hex HMAC-SHA256 of the exact
// body bytes, in X-Tavus-Signature. Tavus signs the bytes it sends (canonical JSON, keys sorted),
// so the check runs on the bytes as received, never on a re-serialised body. Server only.

import { createHmac, timingSafeEqual } from "node:crypto";

const HEX_DIGEST = /^[0-9a-f]{64}$/;

/** True when the header is the hex HMAC-SHA256 of the raw body under the secret, compared in constant time; false when either is missing. */
export function tavusSignatureMatches(rawBody: Uint8Array, header: string | null, secret: string | undefined): boolean {
  const key = secret?.trim();
  const provided = header?.trim().toLowerCase() ?? "";
  if (!key || !HEX_DIGEST.test(provided)) return false;
  const expected = createHmac("sha256", key).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(provided, "hex"));
}

/** The shape of a rejected header for the log line, never its value: absent, or its length and any prefix before an equals sign. */
export function describeSignature(header: string | null): string {
  if (header === null) return "header absent";
  const prefix = header.includes("=") ? `, prefix ${header.split("=")[0]}` : "";
  return `${header.length} characters${prefix}`;
}
