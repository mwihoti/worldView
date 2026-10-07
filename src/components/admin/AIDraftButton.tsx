"use client";

import React, { useCallback, useState } from "react";
import {
  Button,
  toast,
  useConfig,
  useDocumentInfo,
  useForm,
  useFormFields,
} from "@payloadcms/ui";
import { AIProgress } from "./AIProgress";
import {
  applyArticleToForm,
  postAIStream,
  reviewText,
  sourcesText,
  type AIArticle,
  type Progress,
} from "./ai-stream";

/*
 * "Generate draft" under the AI prompt: asks the server to write a first
 * draft from the prompt, shows each stage as it happens (reading linked
 * pages, writing, the reviewer's verdicts and revisions), then puts the
 * result in the editor. Nothing is saved until the editor clicks Save.
 */

function hasContent(value: unknown): boolean {
  const children = (value as { root?: { children?: { children?: unknown[] }[] } } | null)
    ?.root?.children;
  return Boolean(children?.some((node) => (node.children?.length ?? 0) > 0));
}

/* "Also filled in: summary, search description" */
function filledText(article: AIArticle): string | null {
  const meta = article.meta;
  if (!meta) return null;
  const parts = [
    meta.summary ? "summary" : null,
    meta.metaDescription ? "search description" : null,
    meta.section ? "section (if it was empty)" : null,
  ].filter(Boolean);
  return parts.length ? `Also filled in: ${parts.join(", ")}. Check them before publishing.` : null;
}

export function AIDraftButton() {
  const { config } = useConfig();
  const { id } = useDocumentInfo();
  const { dispatchFields, setModified } = useForm();
  const prompt = useFormFields(([fields]) => fields.aiPrompt?.value as string | undefined);
  const title = useFormFields(([fields]) => fields.title?.value as string | undefined);
  const content = useFormFields(([fields]) => fields.content?.value);
  const section = useFormFields(([fields]) => fields.section?.value as string | null | undefined);

  const [steps, setSteps] = useState<Progress[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [last, setLast] = useState<AIArticle | null>(null);

  const generate = useCallback(async () => {
    if (!prompt?.trim() || startedAt) return;
    if (
      hasContent(content) &&
      !window.confirm("Replace the current content with a new AI draft?")
    ) {
      return;
    }
    setSteps([]);
    setLast(null);
    setStartedAt(Date.now());
    try {
      const { article } = await postAIStream<{ article: AIArticle }>(
        `${config.routes.api}/posts/ai-draft`,
        { prompt, title, postId: id ?? null },
        (step) => setSteps((prev) => [...prev, step])
      );
      applyArticleToForm(dispatchFields, article, title, section);
      setModified(true);
      setLast(article);
      toast.success("Draft placed in the editor. Review it, then Save or Publish.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setStartedAt(null);
    }
  }, [prompt, title, content, section, id, startedAt, config.routes.api, dispatchFields, setModified]);

  const busy = startedAt !== null;
  return (
    <div style={styles.wrapper}>
      <div style={styles.row}>
        <Button
          buttonStyle="primary"
          size="small"
          type="button"
          disabled={busy || !prompt?.trim()}
          onClick={() => void generate()}
        >
          {busy ? "Generating…" : "Generate draft"}
        </Button>
        <span style={styles.hint}>
          {prompt?.trim()
            ? "Writes the article from the AI prompt, has a second model review it, and revises until it passes."
            : "Fill in the AI prompt above first."}
        </span>
      </div>
      {busy && <AIProgress steps={steps} startedAt={startedAt} />}
      {!busy && last && (
        <div style={styles.review}>
          <div>{reviewText(last.review)}</div>
          {last.sources && last.sources.length > 0 && <div>{sourcesText(last.sources)}</div>}
          {filledText(last) && <div>{filledText(last)}</div>}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: "grid", gap: "0.6rem", marginBottom: "1.5rem" },
  row: { display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" },
  hint: { color: "var(--theme-elevation-500)", fontSize: "0.8rem" },
  review: {
    display: "grid",
    gap: "0.25rem",
    fontSize: "0.85rem",
    color: "var(--theme-elevation-700)",
    background: "var(--theme-elevation-50)",
    borderRadius: "var(--style-radius-s)",
    padding: "0.5rem 0.7rem",
  },
};
