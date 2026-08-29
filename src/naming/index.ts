import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { extractUserText, shouldArmAutoNaming } from "./title.ts";
import { generateSessionName } from "./generate.ts";

export function registerSessionNaming(pi: ExtensionAPI): void {
  let sessionToken = 0;
  let armed = false;
  let pending = false;
  let requestAbort: AbortController | undefined;

  pi.on("session_start", async (_event, ctx) => {
    requestAbort?.abort();
    sessionToken += 1;
    armed = shouldArmAutoNaming(ctx.sessionManager.getBranch(), pi.getSessionName());
    pending = false;
    requestAbort = undefined;
  });

  pi.on("session_shutdown", async () => {
    requestAbort?.abort();
    requestAbort = undefined;
    sessionToken += 1;
    armed = false;
    pending = false;
  });

  pi.on("message_end", async (event, ctx) => {
    if (!armed || pending || pi.getSessionName() || event.message.role !== "user") return;
    const prompt = extractUserText(event.message.content);
    armed = false;
    if (!prompt) return;

    pending = true;
    const token = sessionToken;
    const abort = new AbortController();
    requestAbort = abort;
    void generateSessionName(prompt, ctx, abort.signal)
      .then((name) => {
        if (name && token === sessionToken && !pi.getSessionName()) pi.setSessionName(name);
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) console.warn("[pi-leon-tui] Session naming unavailable:", error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (token === sessionToken) {
          pending = false;
          requestAbort = undefined;
        }
      });
  });
}
