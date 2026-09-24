// hotel-booking-agent is an ai-agent dependency: it has no OpenAPI contract,
// only the platform's one fixed chat shape, so there is nothing to generate a
// client from (react-webapp's "An ai-agent dependency has no OpenAPI contract"
// section). It is the PRIMARY sibling, so it is reached same-origin at `/api`
// (nginx's drop-in proxies that to it), with the same bearer and 401 handling
// as any other sibling call — through apiJson, never a bearer attached by hand.

import { apiJson } from "./authz/client";

export interface ChatResponse {
  conversationId: string;
  text: string;
  toolCalls: unknown[];
}

/**
 * Sends one message to the agent. Omit `conversationId` to start a new
 * conversation; pass the id the previous response returned to continue one.
 */
export async function sendMessage(
  message: string,
  conversationId?: string,
): Promise<ChatResponse> {
  return apiJson<ChatResponse>("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(conversationId ? { conversationId, message } : { message }),
  });
}
