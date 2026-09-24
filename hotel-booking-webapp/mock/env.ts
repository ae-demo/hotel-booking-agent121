// mockEnv carries exactly the keys the platform emits for this component:
// this app's own USER_AUTH_* OIDC keys. No USER_AUTH_JWKS_URL (src/env.ts
// does not declare it — the browser never validates a token) and no sibling
// API URL (hotel-booking-agent is reached same-origin at /api, never through
// window._env_).
export const mockEnv = {
  USER_AUTH_CLIENT_ID: "mock-client",
  USER_AUTH_ISSUER: "https://mock-idp.test",
  USER_AUTH_SCOPES:
    "openid profile email group ou hotels:search bookings:create bookings:read bookings:cancel",
  USER_AUTH_RESOURCE: "https://mock-idp.test/resources/hotel-booking-agent121",
};
