// Adapted from thunder-authentication's screens.example.ts pattern for THIS
// app's one screen. Everything about screen gating funnels through here.
//
// This app has exactly one screen — Chat — and it backs onto no catalog
// operation at all: it talks to the hotel-booking-agent sibling, an ai-agent
// dependency with the platform's fixed webchat shape rather than an
// openapi.yaml, so there is no scope to gate it on. `loads: null` is exactly
// the case that fits: any signed-in caller may open it, and nobody may open it
// signed out (the flow it belongs to names a role, so it is not `public`).

import { OPERATIONS, isOperationKey, type OperationKey } from "./operations.gen";
import { canCall } from "./core";

export interface ScreenRoute {
  readonly key: string;
  readonly label: string;
  readonly path: string;
  readonly loads: OperationKey | null;
  readonly public?: boolean;
}

export const SCREEN_ROUTES: readonly ScreenRoute[] = [
  { key: "chat", label: "Chat", path: "/chat", loads: null },
];

// FAIL LOUDLY, at module load, exactly as the pattern does — see
// thunder-authentication's screens.example.ts for why this cannot be softened.
for (const screen of SCREEN_ROUTES) {
  if (screen.loads !== null && !isOperationKey(screen.loads)) {
    throw new Error(
      `src/authz/screens.ts: screen "${screen.label}" loads "${screen.loads}", which ` +
        `no contract declares. Re-run \`npm run gen\`, or name the operation the ` +
        `way openapi.yaml spells it.`,
    );
  }
}

/**
 * The screens a caller can actually open, in rail order. The first one is the
 * landing screen; an EMPTY list is the NoAccess case.
 */
export function reachableScreens(
  scopes: ReadonlySet<string>,
  signedIn: boolean,
): readonly ScreenRoute[] {
  return SCREEN_ROUTES.filter((screen) => {
    if (screen.public) return true;
    if (screen.loads === null) return signedIn;
    return canCall(OPERATIONS[screen.loads], scopes, signedIn);
  });
}
