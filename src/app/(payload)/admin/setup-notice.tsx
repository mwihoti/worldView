import type { CSSProperties } from "react";

/*
 * Shown at /admin in production while the CMS database is not configured,
 * instead of a raw server error. The public site is unaffected either way.
 */
export function adminConfigured(): boolean {
  // Local dev falls back to SQLite, so the admin always works there.
  if (!process.env.VERCEL) return true;
  return Boolean(process.env.DATABASE_URI && process.env.PAYLOAD_SECRET);
}

const styles: Record<string, CSSProperties> = {
  body: {
    margin: 0,
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0a0a",
    color: "#ededed",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "2rem",
  },
  card: {
    maxWidth: "40rem",
    lineHeight: 1.6,
  },
  code: {
    background: "#1f1f1f",
    borderRadius: "4px",
    padding: "0.1rem 0.4rem",
    fontFamily: "monospace",
    fontSize: "0.9em",
  },
  step: { marginBottom: "0.75rem" },
};

export function SetupNotice() {
  return (
    <div style={styles.body}>
      <div style={styles.card}>
        <h1>WorldView admin isn&apos;t set up yet</h1>
        <p>
          The admin panel needs a database. The public site is unaffected — this
          only blocks <code style={styles.code}>/admin</code>. To finish setup:
        </p>
        <ol>
          <li style={styles.step}>
            Create a free Postgres database at{" "}
            <a href="https://neon.tech" style={{ color: "#7dd3fc" }}>
              neon.tech
            </a>{" "}
            and copy its connection string.
          </li>
          <li style={styles.step}>
            In Vercel → Project → Settings → Environment Variables, add{" "}
            <code style={styles.code}>DATABASE_URI</code> (the connection
            string) and <code style={styles.code}>PAYLOAD_SECRET</code> (any
            long random string). Optional:{" "}
            <code style={styles.code}>ANTHROPIC_API_KEY</code> to enable
            AI-drafted articles.
          </li>
          <li style={styles.step}>
            One-time schema setup — run locally:{" "}
            <code style={styles.code}>
              DATABASE_URI=postgres://... npm run dev
            </code>{" "}
            (Payload creates the tables automatically in dev mode).
          </li>
          <li style={styles.step}>Redeploy, then reload this page.</li>
        </ol>
        <p>
          On first load you&apos;ll be asked to create the admin account. Full
          details are in the project README.
        </p>
      </div>
    </div>
  );
}
