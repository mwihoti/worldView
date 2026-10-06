/*
 * Per-user limits on the AI endpoints: at most one AI request running at a
 * time per user, and at most AI_RATE_LIMIT (default 20) started per rolling
 * 10 minutes. Each request can make up to ~8 model calls, all against the
 * site's free-tier API quota, so a stuck "retry" button or a script should
 * not be able to burn through it.
 *
 * Kept in memory: on Vercel each warm instance has its own counts, so this
 * bounds bursts rather than being an exact global quota. That's the right
 * trade-off for a handful of admins; it needs no extra service or table.
 */

const WINDOW_MS = 10 * 60 * 1000;

function maxPerWindow(): number {
  const configured = Number(process.env.AI_RATE_LIMIT);
  return Number.isFinite(configured) && configured > 0 ? configured : 20;
}

const started = new Map<string, number[]>();
const running = new Set<string>();

export type SlotResult =
  | { ok: true; release: () => void }
  | { ok: false; message: string; retryAfterSeconds: number };

export function acquireAISlot(userId: string | number, now = Date.now()): SlotResult {
  const key = String(userId);
  if (running.has(key)) {
    return {
      ok: false,
      message: "An AI request of yours is still running. Wait for it to finish.",
      retryAfterSeconds: 5,
    };
  }
  const recent = (started.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= maxPerWindow()) {
    const retryAfterSeconds = Math.ceil((recent[0] + WINDOW_MS - now) / 1000);
    started.set(key, recent);
    return {
      ok: false,
      message: `Too many AI requests. Try again in about ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
      retryAfterSeconds,
    };
  }
  recent.push(now);
  started.set(key, recent);
  running.add(key);
  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      running.delete(key);
    },
  };
}

/* Test helper. */
export function resetAILimits(): void {
  started.clear();
  running.clear();
}
