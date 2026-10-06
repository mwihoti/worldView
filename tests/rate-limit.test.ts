import { beforeEach, describe, expect, it, vi } from "vitest";
import { acquireAISlot, resetAILimits } from "@/lib/rate-limit";

beforeEach(() => {
  resetAILimits();
  vi.unstubAllEnvs();
});

describe("acquireAISlot", () => {
  it("allows one running request per user", () => {
    const first = acquireAISlot(1);
    expect(first.ok).toBe(true);
    expect(acquireAISlot(1)).toMatchObject({ ok: false, message: expect.stringMatching(/still running/) });
    expect(acquireAISlot(2).ok).toBe(true);
    if (first.ok) first.release();
    expect(acquireAISlot(1).ok).toBe(true);
  });

  it("caps requests per 10 minutes, then lets them through again", () => {
    vi.stubEnv("AI_RATE_LIMIT", "3");
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) {
      const slot = acquireAISlot(1, t0 + i);
      expect(slot.ok).toBe(true);
      if (slot.ok) slot.release();
    }
    const blocked = acquireAISlot(1, t0 + 10);
    expect(blocked).toMatchObject({ ok: false, message: expect.stringMatching(/Too many/) });
    expect(acquireAISlot(1, t0 + 10 * 60_000 + 1).ok).toBe(true);
  });
});
