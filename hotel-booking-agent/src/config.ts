// Config read from environment variables, once, here — every other module
// reads through this, never process.env directly.

export const config = {
  port: Number(process.env.PORT ?? 9090),

  // Model access — injected by the platform for every ai-agent component.
  modelName: process.env.MODEL_NAME,
  modelEndpoint: process.env.MODEL_ENDPOINT,
  modelApiKey: process.env.MODEL_API_KEY,
  modelApiKeyHeader: process.env.MODEL_API_KEY_HEADER,

  // hotel-booking-api — component dependency (dependencies.endpoints[]).
  hotelBookingApiUrl: process.env.HOTEL_BOOKING_API_URL,

  // agent-memory-db — postgres-cnpg platform-resource. Absence is not a
  // fault: the store falls back to an in-memory backing (see store.ts).
  memoryDbHost: process.env.AGENT_MEMORY_DB_HOST,
  memoryDbPort: process.env.AGENT_MEMORY_DB_PORT,
  memoryDbName: process.env.AGENT_MEMORY_DB_DBNAME,
  memoryDbUser: process.env.AGENT_MEMORY_DB_USER,
  memoryDbPassword: process.env.AGENT_MEMORY_DB_PASSWORD,

  // Tracing — inert unless both are set.
  ampOtelEndpoint: process.env.AMP_OTEL_ENDPOINT,
  ampAgentApiKey: process.env.AMP_AGENT_API_KEY,
  otelServiceName: process.env.OTEL_SERVICE_NAME,
};

/** Env vars whose absence makes the agent unable to serve a turn. */
export function missingRequired(): string[] {
  const missing: string[] = [];
  if (!config.modelApiKey) missing.push("MODEL_API_KEY");
  if (!config.modelEndpoint) missing.push("MODEL_ENDPOINT");
  if (!config.modelName) missing.push("MODEL_NAME");
  if (!config.hotelBookingApiUrl) missing.push("HOTEL_BOOKING_API_URL");
  return missing;
}
