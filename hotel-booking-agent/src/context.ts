// Per-request credential, reachable from a tool without the model ever
// seeing it. The handler runs the turn inside callContext.run(...); tools.ts
// reads it back out when it builds each outbound request.

import { AsyncLocalStorage } from "node:async_hooks";

export interface CallCredential {
  authorization?: string;
}

export const callContext = new AsyncLocalStorage<CallCredential>();
