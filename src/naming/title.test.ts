import { describe, expect, it } from "vitest";
import { extractUserText, sanitizeSessionName, shouldArmAutoNaming } from "./title.ts";

describe("session title helpers", () => {
  it("arms only for a fresh unnamed session", () => {
    expect(shouldArmAutoNaming([], undefined)).toBe(true);
    expect(shouldArmAutoNaming([], "Existing")).toBe(false);
    expect(shouldArmAutoNaming([{ type: "message", message: { role: "user", content: "hi" } } as never], undefined)).toBe(false);
  });

  it("extracts only text content", () => {
    expect(extractUserText([
      { type: "text", text: "Fix the login" },
      { type: "image", source: "ignored" },
      { type: "text", text: " flow" },
    ])).toBe("Fix the login\n flow");
  });

  it("cleans generated title decorations", () => {
    expect(sanitizeSessionName("```\nTitle: Fix Login Flow!\n```")) .toBe("Fix Login Flow");
  });

  it("limits a title without splitting a word", () => {
    expect(sanitizeSessionName("A title with a deliberately long descriptive phrase for a coding session")).toBe("A title with a deliberately long descriptive phrase for a");
  });
});
