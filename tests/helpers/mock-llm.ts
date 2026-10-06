import http from "http";
import type { AddressInfo } from "net";

/*
 * A local OpenAI-compatible chat endpoint. `respond` decides each reply from
 * the model name and messages; return a string for a normal answer, or
 * { status, body } for an error. `delayMs` simulates a slow backend.
 */
export type MockCall = { model: string; isJudge: boolean; messages: { role: string; content: string }[] };
export type MockReply = string | { status: number; body?: unknown } | { delayMs: number; reply: MockReply };

export async function startMockLLM(respond: (call: MockCall) => MockReply) {
  const calls: MockCall[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      const { model, messages } = JSON.parse(raw);
      const call = {
        model,
        messages,
        isJudge: String(messages[0]?.content ?? "").includes("strict but fair editor"),
      };
      calls.push(call);
      let reply = respond(call);
      while (typeof reply === "object" && "delayMs" in reply) {
        await new Promise((r) => setTimeout(r, (reply as { delayMs: number }).delayMs));
        reply = (reply as { reply: MockReply }).reply;
      }
      if (res.destroyed) return;
      if (typeof reply === "string") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ choices: [{ message: { content: reply } }] }));
      } else {
        const r = reply as { status: number; body?: unknown };
        res.statusCode = r.status;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(r.body ?? { error: { message: `status ${r.status}` } }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/v1/chat/completions`,
    calls,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export const ARTICLE = "# A Headline\n\n## Section\n\nBody text.";
