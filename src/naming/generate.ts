import { completeSimple } from "@earendil-works/pi-ai/compat";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { sanitizeSessionName } from "./title.ts";

export const NAMING_PROVIDER = "phantom";
export const FALLBACK_MODEL_ID = "workers-ai/@cf/zai-org/glm-5.2";
export const MAX_OUTPUT_TOKENS = 96;

const CHARS_PER_TOKEN = 4;
export const NAMING_SYSTEM_PROMPT = `You create searchable session titles for coding and technical work.
Return exactly one title based only on the user's first message.
Prefer 2 to 6 words in Title Case. Include the task, feature, bug, file, package, command, model, or error when clear.
Avoid generic titles. If vague, return a memorable compact coding-themed title.
No quotes, markdown, labels, or trailing punctuation. Maximum 60 characters.`;

type NamingModel = Model<Api>;

export function selectCheapestModel(prompt: string, ctx: Pick<ExtensionContext, "modelRegistry">): NamingModel | undefined {
  const candidates = ctx.modelRegistry
    .getAvailable()
    .filter((model) => model.provider === NAMING_PROVIDER && model.input.includes("text"));
  if (candidates.length > 0) {
    return [...candidates].sort((left, right) => estimateRequestCost(left, prompt) - estimateRequestCost(right, prompt))[0];
  }
  const fallback = ctx.modelRegistry.find(NAMING_PROVIDER, FALLBACK_MODEL_ID);
  return fallback?.input.includes("text") ? fallback : undefined;
}

export function estimateRequestCost(model: NamingModel, prompt: string): number {
  const inputTokens = Math.ceil((NAMING_SYSTEM_PROMPT.length + prompt.length) / CHARS_PER_TOKEN);
  return model.cost.input * inputTokens + model.cost.output * MAX_OUTPUT_TOKENS;
}

export async function generateSessionName(prompt: string, ctx: ExtensionContext, signal?: AbortSignal): Promise<string | undefined> {
  const model = selectCheapestModel(prompt, ctx);
  if (!model) return undefined;

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) return undefined;

  const response = await completeSimple(model, {
    systemPrompt: NAMING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }], timestamp: Date.now() }],
  }, {
    apiKey: auth.apiKey,
    headers: auth.headers,
    signal,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  const text = response.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  return sanitizeSessionName(text);
}
