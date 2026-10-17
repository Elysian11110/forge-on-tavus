// The device check before anything is paid for: no mic means no call, no camera means voice only.
// Mic and camera are asked for one at a time, because Chrome's combined prompt blocks both on a
// single "Block", which made "no camera, still voice only" unreachable. Each stream is let go at
// once so the call can take the devices.

/** Why there is no mic: none plugged in, the browser said no, or the page cannot ask at all. */
export type MicProblem = "missing" | "blocked" | "unsupported";

export type DeviceCheck = { mic: true; camera: boolean } | { mic: false; problem: MicProblem };

function release(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

/** Opens and releases one device; null when it worked, else what went wrong. */
async function tryToOpen(constraints: MediaStreamConstraints): Promise<MicProblem | null> {
  try {
    release(await navigator.mediaDevices.getUserMedia(constraints));
    return null;
  } catch (error) {
    return error instanceof DOMException && error.name === "NotFoundError" ? "missing" : "blocked";
  }
}

export async function checkDevices(): Promise<DeviceCheck> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { mic: false, problem: "unsupported" };
  }
  const micProblem = await tryToOpen({ audio: true });
  if (micProblem) return { mic: false, problem: micProblem };
  return { mic: true, camera: (await tryToOpen({ video: true })) === null };
}
