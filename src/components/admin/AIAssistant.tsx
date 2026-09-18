"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  Button,
  toast,
  useConfig,
  useForm,
  useFormFields,
} from "@payloadcms/ui";

/*
 * "AI assistant" panel on the post edit screen. The editor chats with the
 * model about the draft; whenever the model returns a revised article the
 * panel offers to drop it into the content editor (and title). Nothing is
 * saved until the editor clicks Save/Publish, so the usual review step stays.
 */

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  article?: { title: string | null; markdown: string; lexical: unknown };
  applied?: boolean;
};

const SUGGESTIONS = [
  "Fix grammar and typos",
  "Make it shorter and punchier",
  "Add a short intro paragraph",
  "Rewrite the headline",
];

export function AIAssistant() {
  const { config } = useConfig();
  const { dispatchFields, setModified } = useForm();
  const title = useFormFields(([fields]) => fields.title?.value as string | undefined);
  const brief = useFormFields(([fields]) => fields.aiPrompt?.value as string | undefined);
  const content = useFormFields(([fields]) => fields.content?.value);

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const [preview, setPreview] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const send = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text || busy) return;
      const history = [...turns, { role: "user" as const, content: text }];
      setTurns(history);
      setInput("");
      setBusy(true);
      try {
        const res = await fetch(`${config.routes.api}/posts/ai-chat`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map(({ role, content }) => ({ role, content })),
            title,
            brief,
            content,
          }),
        });
        const data = (await res.json()) as {
          reply?: string;
          article?: ChatTurn["article"] | null;
          errors?: { message: string }[];
        };
        if (!res.ok) {
          throw new Error(data.errors?.[0]?.message ?? `Request failed (${res.status})`);
        }
        setTurns((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply ?? "",
            article: data.article ?? undefined,
          },
        ]);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        toast.error(msg);
        setTurns((prev) => [
          ...prev,
          { role: "assistant", content: `Sorry, that failed: ${msg}` },
        ]);
      } finally {
        setBusy(false);
        setTimeout(() => {
          logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
        }, 0);
      }
    },
    [busy, turns, config.routes.api, title, brief, content]
  );

  const apply = useCallback(
    (index: number) => {
      const turn = turns[index];
      if (!turn?.article) return;
      // Setting initialValue alongside value makes the Lexical field re-mount
      // with the new document; value alone would be ignored by the editor.
      dispatchFields({
        type: "UPDATE",
        path: "content",
        value: turn.article.lexical,
        initialValue: turn.article.lexical,
      });
      if (turn.article.title && !title?.trim()) {
        dispatchFields({ type: "UPDATE", path: "title", value: turn.article.title });
      }
      setModified(true);
      setTurns((prev) => prev.map((t, i) => (i === index ? { ...t, applied: true } : t)));
      setPreview(null);
      toast.success("Revised article placed in the editor. Review it, then Save or Publish.");
    },
    [turns, dispatchFields, setModified, title]
  );

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>AI assistant</div>
          <div style={styles.subtitle}>
            Ask for corrections to the draft. Apply a revision when you are happy with it, then Save or Publish.
          </div>
        </div>
        <Button buttonStyle="secondary" size="small" type="button" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Show"}
        </Button>
      </div>

      {open && (
        <>
          <div ref={logRef} style={styles.log}>
            {turns.length === 0 && (
              <div style={styles.empty}>
                No messages yet. Try one of the suggestions below or type your own instruction, e.g. “Make the second section about payouts more concrete”.
              </div>
            )}
            {turns.map((turn, i) => (
              <div
                key={i}
                style={{
                  ...styles.bubble,
                  ...(turn.role === "user" ? styles.userBubble : styles.assistantBubble),
                }}
              >
                <div style={styles.role}>{turn.role === "user" ? "You" : "Assistant"}</div>
                <div style={styles.text}>{turn.content}</div>
                {turn.article && (
                  <div style={styles.actions}>
                    <Button
                      buttonStyle="primary"
                      size="small"
                      type="button"
                      disabled={turn.applied}
                      onClick={() => apply(i)}
                    >
                      {turn.applied ? "Applied to editor" : "Apply to editor"}
                    </Button>
                    <Button
                      buttonStyle="secondary"
                      size="small"
                      type="button"
                      onClick={() => setPreview(preview === i ? null : i)}
                    >
                      {preview === i ? "Hide preview" : "Preview"}
                    </Button>
                  </div>
                )}
                {turn.article && preview === i && (
                  <pre style={styles.preview}>
                    {turn.article.title ? `# ${turn.article.title}\n\n` : ""}
                    {turn.article.markdown}
                  </pre>
                )}
              </div>
            ))}
            {busy && <div style={styles.empty}>Thinking…</div>}
          </div>

          <div style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <Button
                key={s}
                buttonStyle="pill"
                size="small"
                type="button"
                disabled={busy}
                onClick={() => void send(s)}
              >
                {s}
              </Button>
            ))}
          </div>

          {/* Not a <form>: the whole edit view already is one, and nested
              forms are dropped by the browser. */}
          <div style={styles.composer}>
            <textarea
              style={styles.textarea}
              rows={3}
              value={input}
              disabled={busy}
              placeholder="Tell the assistant what to change…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            <Button
              buttonStyle="primary"
              size="medium"
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void send(input)}
            >
              {busy ? "Sending…" : "Send"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    border: "1px solid var(--theme-elevation-150)",
    borderRadius: "var(--style-radius-m)",
    background: "var(--theme-elevation-50)",
    padding: "1rem",
    marginBottom: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" },
  title: { fontWeight: 600, fontSize: "1rem" },
  subtitle: { color: "var(--theme-elevation-600)", fontSize: "0.85rem", marginTop: "0.15rem" },
  log: {
    maxHeight: "24rem",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    padding: "0.25rem",
  },
  empty: { color: "var(--theme-elevation-500)", fontSize: "0.9rem", padding: "0.5rem" },
  bubble: { borderRadius: "var(--style-radius-s)", padding: "0.6rem 0.8rem", maxWidth: "100%" },
  userBubble: { background: "var(--theme-elevation-100)", alignSelf: "flex-end" },
  assistantBubble: { background: "var(--theme-elevation-0)", border: "1px solid var(--theme-elevation-150)" },
  role: { fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--theme-elevation-500)", marginBottom: "0.25rem" },
  text: { whiteSpace: "pre-wrap", fontSize: "0.9rem", lineHeight: 1.5 },
  actions: { display: "flex", gap: "0.5rem", marginTop: "0.6rem" },
  preview: {
    marginTop: "0.6rem",
    maxHeight: "18rem",
    overflow: "auto",
    whiteSpace: "pre-wrap",
    fontSize: "0.8rem",
    background: "var(--theme-elevation-50)",
    padding: "0.6rem",
    borderRadius: "var(--style-radius-s)",
  },
  suggestions: { display: "flex", flexWrap: "wrap", gap: "0.4rem" },
  composer: { display: "flex", gap: "0.5rem", alignItems: "flex-end" },
  textarea: {
    flex: 1,
    resize: "vertical",
    padding: "0.6rem",
    borderRadius: "var(--style-radius-s)",
    border: "1px solid var(--theme-elevation-150)",
    background: "var(--theme-input-bg)",
    color: "var(--theme-text)",
    font: "inherit",
  },
};
