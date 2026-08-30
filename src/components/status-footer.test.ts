import { describe, expect, it } from "vitest";
import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { calculateSessionCost, createStatusFooter } from "./status-footer.ts";

const theme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as unknown as Theme;

const context = {
  mode: "tui",
  cwd: "/Users/akao/Projects/pi/pi-leon-tui",
  model: { id: "claude-opus-4-6", contextWindow: 200_000 },
  thinkingLevel: "high",
  getContextUsage: () => ({ tokens: 122_000, percent: 61, contextWindow: 200_000 }),
  sessionManager: { getBranch: () => [], getLeafId: () => "leaf-0" },
} as never;

const git = { value: null, refresh: async () => null, dispose: () => {} } as never;
const tui = { mode: "regular", requestRender: () => {} } as never;
const footerData = {
  onBranchChange: () => () => {},
  getExtensionStatuses: () => new Map([["mode", "\\u001b[36mmode:Plan (read-only)\\u001b[0m"]]),
} as never;

describe("status footer", () => {
  it("sums usage costs on the current branch", () => {
    const entries = [
      { type: "message", message: { role: "assistant", usage: { cost: { total: 0.482 } } } },
      { type: "message", message: { role: "user" } },
      { type: "compaction", usage: { cost: { total: 0.125 } } },
      { type: "branch_summary", usage: { cost: { total: 0.25 } } },
    ];
    expect(calculateSessionCost(entries as never)).toBeCloseTo(0.857);
  });
  it.each([10, 16, 20, 40, 80, 120, 200])("keeps both lines within %s columns", (width) => {
    const footer = createStatusFooter(tui, theme, { context, footerData, git, getTitle: () => "A useful session title" });
    for (const line of footer.render(width)) expect(visibleWidth(line)).toBeLessThanOrEqual(width);
    footer.dispose();
  });

  it("keeps the bar and percentage visible at the narrowest supported width", () => {
    const footer = createStatusFooter(tui, theme, { context, footerData, git, getTitle: () => "A useful session title" });
    const line = stripTerminalSequences(footer.render(10)[0]);
    expect(line).toContain("[");
    expect(line).toContain("61%");
    footer.dispose();
  });

  it("renders the title, context bar, and mcp line", () => {
    const mcpFooterData = {
      onBranchChange: () => () => {},
      getExtensionStatuses: () => new Map([
        ["mode", "\u001b[36mmode:Plan (read-only)\u001b[0m"],
        ["mcp.filesystem", "connected"],
        ["mcp.github", "error"],
      ]),
    } as never;
    const footer = createStatusFooter(tui, theme, { context, footerData: mcpFooterData, git, getTitle: () => "A useful session title" });
    const lines = footer.render(120).map(stripTerminalSequences);
    expect(lines[1]).toContain("A useful session title");
    expect(lines[0]).toContain("PLAN");
    expect(lines[0]).toContain("[██████····]");
    expect(lines[0]).toContain("61%");
    expect(lines[0]).toContain("$0.000");
    expect(lines[2]).toContain("mcp filesystem: connected");
    expect(lines[2]).toContain("mcp github: error");
    footer.dispose();
  });
});
