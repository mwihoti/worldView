"use client";

import React, { useEffect, useState } from "react";
import { progressText, type Progress } from "./ai-stream";

/*
 * Live view of a running AI request: each stage it has been through, the
 * current one marked as in progress, and the seconds elapsed (a draft plus
 * self-review can take close to a minute, so a bare spinner looks stuck).
 */
export function AIProgress({ steps, startedAt }: { steps: Progress[]; startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));

  return (
    <div role="status" aria-live="polite" style={styles.box}>
      <ol style={styles.list}>
        {steps.length === 0 && <li style={styles.current}>Starting…</li>}
        {steps.map((step, i) => {
          const current = i === steps.length - 1;
          return (
            <li key={i} style={current ? styles.current : styles.done}>
              <span aria-hidden="true" style={styles.mark}>
                {current ? "…" : "✓"}
              </span>
              {progressText(step)}
            </li>
          );
        })}
      </ol>
      <div style={styles.elapsed}>{seconds}s elapsed · usually under a minute</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  box: {
    border: "1px dashed var(--theme-elevation-200)",
    borderRadius: "var(--style-radius-s)",
    padding: "0.6rem 0.8rem",
    fontSize: "0.85rem",
    background: "var(--theme-elevation-0)",
  },
  list: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.3rem" },
  done: { color: "var(--theme-elevation-500)" },
  current: { color: "var(--theme-text)", fontWeight: 600 },
  mark: { display: "inline-block", width: "1.2em" },
  elapsed: { marginTop: "0.4rem", color: "var(--theme-elevation-500)", fontSize: "0.75rem" },
};
