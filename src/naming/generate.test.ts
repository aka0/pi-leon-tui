import { describe, expect, it } from "vitest";
import type { Api, Model } from "@earendil-works/pi-ai";
import { estimateRequestCost, selectCheapestModel } from "./generate.ts";

const model = (id: string, input: number, output: number): Model<Api> => ({
  id,
  name: id,
  api: "test-api",
  provider: "phantom",
  baseUrl: "",
  reasoning: false,
  input: ["text"],
  cost: { input, output, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 100_000,
  maxTokens: 100,
});

describe("naming model selection", () => {
  it("selects the lowest estimated request cost", () => {
    const cheap = model("cheap", 1, 1);
    const expensive = model("expensive", 2, 2);
    const ctx = { modelRegistry: { getAvailable: () => [expensive, cheap], find: () => undefined } } as never;
    expect(selectCheapestModel("Fix the footer", ctx)?.id).toBe("cheap");
  });

  it("accounts for output pricing", () => {
    expect(estimateRequestCost(model("m", 2, 3), "hello")).toBeGreaterThan(0);
  });
});
