// HTTP surface. Two routes on node:http, and no more — POST /chat and
// GET /healthz. No Express, no Fastify.

import "./tracing.js"; // side effects only; before anything creates a model client
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { ModelMessage } from "ai";
import { config, missingRequired } from "./config.js";
import { callContext } from "./context.js";
import { runTurn } from "./agent.js";
import {
  ensureStore,
  initStore,
  isStoreReady,
  loadConversation,
  saveConversation,
} from "./store.js";

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  return JSON.parse(text);
}

/** Reads the AI SDK's APICallError body for a guardrail refusal; returns
 * null for anything else. This is the ONE upstream error shape relayed to
 * the caller — everything else stays a generic 500. */
function guardrailBlock(err: unknown): { name: string; reason: string } | null {
  const body = (err as { responseBody?: string })?.responseBody;
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as { message?: { action?: string; actionReason?: string; interveningGuardrail?: string } };
    const m = parsed?.message;
    if (m?.action !== "GUARDRAIL_INTERVENED") return null;
    return { name: m.interveningGuardrail ?? "guardrail", reason: m.actionReason ?? "refused by policy" };
  } catch {
    return null;
  }
}

async function handleChat(req: IncomingMessage, res: ServerResponse, userId: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readBody(req);
  } catch {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }

  const body = parsed as { conversationId?: unknown; message?: unknown };
  if (typeof body.message !== "string" || body.message.trim() === "") {
    sendJson(res, 400, { error: "expected { message: string }" });
    return;
  }
  if (body.conversationId !== undefined && typeof body.conversationId !== "string") {
    sendJson(res, 400, { error: "conversationId must be a string when present" });
    return;
  }

  try {
    await ensureStore();
  } catch (err) {
    console.error("store not ready:", err);
    sendJson(res, 500, { error: "internal error" });
    return;
  }

  let conversationId: string;
  let history: ModelMessage[];

  if (typeof body.conversationId === "string") {
    const existing = await loadConversation(body.conversationId, userId);
    if (existing === null) {
      sendJson(res, 404, { error: "conversation not found" });
      return;
    }
    conversationId = body.conversationId;
    history = existing;
  } else {
    conversationId = randomUUID();
    history = [];
  }

  const full: ModelMessage[] = [...history, { role: "user", content: body.message }];

  try {
    const result = await callContext.run(
      { authorization: req.headers.authorization },
      () => runTurn(full),
    );

    await saveConversation(conversationId, userId, [...full, ...result.responseMessages]);

    sendJson(res, 200, {
      conversationId,
      text: result.text,
      toolCalls: result.toolCalls,
    });
  } catch (err) {
    const guardrail = guardrailBlock(err);
    if (guardrail) {
      sendJson(res, 422, { error: guardrail.reason, guardrail: guardrail.name });
      return;
    }
    console.error("chat turn failed:", err);
    sendJson(res, 500, { error: "internal error" });
  }
}

function handleHealthz(res: ServerResponse): void {
  const missing = missingRequired();
  const store = isStoreReady() ? "ready" : "initialising";
  if (missing.length > 0 || store !== "ready") {
    sendJson(res, 503, { ok: false, missing, store });
    return;
  }
  sendJson(res, 200, { ok: true });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { method, url } = req;

  if (method === "GET" && url === "/healthz") {
    handleHealthz(res);
    return;
  }

  if (method === "POST" && url === "/chat") {
    // Gate: reject callers the gateway did not vouch for. A header Node saw
    // twice arrives as string[] — refused rather than coerced.
    const userId = req.headers["x-user-id"];
    if (typeof userId !== "string" || userId === "") {
      res.statusCode = 401;
      res.end();
      return;
    }
    await handleChat(req, res, userId);
    return;
  }

  res.statusCode = 404;
  res.end();
}

const server = createServer((req, res) => {
  // The last line of defence: `void handle(...)` alone would still let an
  // async throw inside node:http become an unhandled rejection and crash
  // the process.
  void handle(req, res).catch((err) => {
    console.error("request failed:", err);
    if (!res.headersSent) sendJson(res, 500, { error: "internal error" });
    else res.destroy();
  });
});

// Fire-and-forget: never await this before listen(). The DB may not be
// reachable yet at boot; /healthz reports the not-ready state instead of the
// pod crash-looping.
initStore();

server.listen(config.port, () => {
  console.log(`hotel-booking-agent listening on ${config.port}`);
});
