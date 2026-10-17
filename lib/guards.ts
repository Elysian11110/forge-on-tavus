// Type guards shared by the routes and the pure modules; nothing here touches I/O, so the client
// and the tests can import it too.

/** A plain object, as opposed to an array, null or a primitive. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
