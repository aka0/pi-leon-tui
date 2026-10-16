import { afterEach, describe, expect, it, vi } from "vitest";
import { generateSessionName } from "./generate.ts";
import { registerSessionNaming } from "./index.ts";

vi.mock("./generate.ts", () => ({ generateSessionName: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

describe("session naming", () => {
  it("does not write a provider failure to the terminal", async () => {
    const handlers = new Map<string, (event: never, context: never) => unknown>();
    const pi = {
      on: (event: string, handler: (event: never, context: never) => unknown) => handlers.set(event, handler),
      getSessionName: () => undefined,
      setSessionName: vi.fn(),
    };
    const context = { sessionManager: { getBranch: () => [] } };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.mocked(generateSessionName).mockRejectedValueOnce(new Error("provider unavailable"));
    registerSessionNaming(pi as never);
    await handlers.get("session_start")?.({} as never, context as never);
    await handlers.get("message_end")?.({ message: { role: "user", content: "Fix extension rendering" } } as never, context as never);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(warn).not.toHaveBeenCalled();
  });
});
