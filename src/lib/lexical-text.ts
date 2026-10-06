type LexicalNode = { text?: unknown; children?: LexicalNode[]; type?: string };

/* Plain text of a Lexical document, paragraphs separated by spaces. */
export function lexicalPlainText(content: unknown, limit = 400): string {
  const parts: string[] = [];
  let length = 0;
  const walk = (node: LexicalNode | undefined) => {
    if (!node || length >= limit) return;
    if (typeof node.text === "string") {
      parts.push(node.text);
      length += node.text.length;
    }
    node.children?.forEach(walk);
    if (node.type === "paragraph" || node.type === "heading") parts.push(" ");
  };
  walk((content as { root?: LexicalNode } | null)?.root);
  return parts.join("").replace(/\s+/g, " ").trim();
}
