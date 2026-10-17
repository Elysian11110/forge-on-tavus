import { describe, expect, it } from "vitest";
import { buildCreateBody } from "@/lib/tavus";
import type { Switches } from "@/lib/switches";

const switches = (arc: 5 | 30): Switches => ({ arc, requireAuth: true, euPolicy: false }) as Switches;
const body = (arc: 5 | 30) =>
  buildCreateBody({ palId: "p1", firstName: "Zee", crisisLine: "988", switches: switches(arc), speedObjectivesId: "o-speed" });

describe("the create body", () => {
  it("opens the open call with small talk and keeps the PAL's own objectives", () => {
    expect(body(30).custom_greeting).toBe("Hey Zee! I'm Veronica, nice to meet you. How was your day?");
    expect(body(30).objectives_id).toBeUndefined();
    expect(body(30).properties.max_call_duration).toBe(1800);
  });

  it("swaps in the speed round's objectives on the five-minute call", () => {
    expect(body(5).objectives_id).toBe("o-speed");
    expect(body(5).properties.max_call_duration).toBe(300);
  });
});
