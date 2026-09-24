// The AI SDK loop. Implements agent.afm.md's model + tool contract exactly —
// no framework, no prompt of our own invention.

import { generateText, stepCountIs, type ModelMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { config } from "./config.js";
import { SYSTEM_PROMPT, MAX_ITERATIONS } from "./prompt.js";
import { tools } from "./tools.js";
import { tracer } from "./tracing.js";

function buildModel() {
  const keyHeader = config.modelApiKeyHeader;
  const anthropic = createAnthropic(
    keyHeader
      ? {
          baseURL: config.modelEndpoint,
          apiKey: "unused",
          headers: { [keyHeader]: config.modelApiKey ?? "" },
        }
      : {
          baseURL: config.modelEndpoint,
          apiKey: config.modelApiKey,
        },
  );
  return anthropic(config.modelName ?? "claude-sonnet-5");
}

export interface TurnResult {
  text: string;
  toolCalls: unknown[];
  responseMessages: ModelMessage[];
}

export async function runTurn(messages: ModelMessage[]): Promise<TurnResult> {
  const model = buildModel();
  const modelLabel = config.modelName ?? "claude-sonnet-5";

  return tracer.startActiveSpan(`chat ${modelLabel}`, async (span) => {
    try {
      const result = await generateText({
        model,
        system: SYSTEM_PROMPT,
        messages,
        tools,
        stopWhen: stepCountIs(MAX_ITERATIONS),
      });

      span.setAttributes({
        "gen_ai.system": "anthropic",
        "gen_ai.request.model": modelLabel,
        "gen_ai.usage.input_tokens": result.usage?.inputTokens ?? 0,
        "gen_ai.usage.output_tokens": result.usage?.outputTokens ?? 0,
      });

      return {
        text: result.text,
        toolCalls: result.toolCalls,
        // The FULL trail — tool calls and results included. NOT
        // result.response.messages, which is the last step only.
        responseMessages: result.steps.flatMap((s) => s.response.messages),
      };
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: 2 });
      throw err;
    } finally {
      span.end();
    }
  });
}
