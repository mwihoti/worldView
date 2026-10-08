"use client";

import React from "react";
import { useTheme } from "@payloadcms/ui";

/*
 * Light/dark switch in the admin's app header (admin.components.actions).
 * Payload's useTheme persists the choice to the payload-theme cookie and
 * flips data-theme on <html>, so every screen follows immediately and the
 * choice survives reloads. (The account page's Automatic/Light/Dark setting
 * still works; this is just the one-click version of it.)
 */

function Doodle({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden="true">
      {dark ? (
        // Moon: shown while dark, click for light.
        <path
          d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z"
          fill="var(--theme-elevation-100)"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ) : (
        // Sun: shown while light, click for dark.
        <>
          <circle
            cx="12"
            cy="12"
            r="4.5"
            fill="var(--theme-success-500)"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.3rem 0.75rem",
        border: "2px solid var(--theme-elevation-800)",
        borderRadius: "999px",
        background: "var(--theme-elevation-0)",
        color: "var(--theme-elevation-800)",
        boxShadow: "2px 2px 0 var(--theme-elevation-800)",
        cursor: "pointer",
        fontFamily: "var(--font-admin-ui), system-ui, sans-serif",
        fontSize: "0.8rem",
        fontWeight: 600,
      }}
    >
      <Doodle dark={dark} />
      {dark ? "Light" : "Dark"}
    </button>
  );
}
