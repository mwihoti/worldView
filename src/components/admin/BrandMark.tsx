import React from "react";

/*
 * The WorldView brand for the admin: the doodled globe with its orbit, as on
 * the public site, but drawn against Payload's theme variables so it follows
 * the admin's light/dark setting. AdminLogo fronts the sign-in and
 * create-first-user screens; AdminIcon sits in the nav.
 */

function Globe({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--theme-elevation-800)" }}
    >
      <circle
        cx="22"
        cy="26"
        r="15"
        fill="var(--theme-elevation-0)"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <path
        d="M22 11c-6.5 5.5-6.5 24.5 0 30M22 11c6.5 5.5 6.5 24.5 0 30M7.5 26h29M10 18.5c8 3 16 3 24 0M10 33.5c8-3 16-3 24 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M29 7.5c7 .8 12.5 6 12.5 13.5"
        stroke="var(--theme-success-500)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle
        cx="41.5"
        cy="23"
        r="3.2"
        fill="var(--theme-success-500)"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

export function AdminLogo() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.4rem",
        marginBottom: "0.5rem",
      }}
    >
      <Globe size={72} />
      <div
        style={{
          fontFamily: "var(--font-admin-display), Georgia, serif",
          fontSize: "2rem",
          lineHeight: 1,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: "var(--theme-elevation-800)",
        }}
      >
        World{" "}
        <em style={{ fontWeight: 500, color: "var(--theme-success-500)" }}>View</em>
      </div>
      <div
        style={{
          fontFamily: "var(--font-admin-note), cursive",
          fontSize: "1.25rem",
          color: "var(--theme-elevation-500)",
        }}
      >
        the writing desk
      </div>
    </div>
  );
}

export function AdminIcon() {
  return <Globe size={26} />;
}
