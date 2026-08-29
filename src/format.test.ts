import { describe, expect, it } from "vitest";
import { stripTerminalSequences } from "@earendil-works/pi-tui";
import { contextColor, formatContext, formatCost, formatGit, formatMode, formatTitle, renderContextBar, renderStatusLine } from "./format.ts";

const usage = (tokens: number | null, percent: number | null, contextWindow = 200_000) => ({
  tokens,
  percent,
  contextWindow,
});

describe("context formatting", () => {
  it.each([
    [0, "[··········]"],
    [25, "[███·······]"],
    [100, "[██████████]"],
  ])("renders %s percent as %s", (percent, expected) => {
    expect(renderContextBar(percent, 10)).toBe(expected);
  });

  it("renders unknown usage without pretending it is zero", () => {
    expect(formatContext(usage(null, null))).toBe("ctx [··········] ? · 200k");
  });

  it("includes both the bar and percentage", () => {
    expect(formatContext(usage(61_000, 30.5))).toBe("ctx [███·······] 31% · 200k");
  });
});

describe("status formatting", () => {
  it.each([
    [0, "$0.000"],
    [0.482, "$0.482"],
    [12.345, "$12.35"],
    [-1, "$?"],
    [Number.NaN, "$?"],
  ])("formats cost %s as %s", (cost, expected) => {
    expect(formatCost(cost)).toBe(expected);
  });

  it("uses dedicated colors and places cost after context", () => {
    expect(contextColor(usage(1, 61))).toBe("syntaxType");
    expect(contextColor(usage(1, 70))).toBe("warning");
    expect(contextColor(usage(1, 90))).toBe("error");

    const colors: string[] = [];
    const theme = {
      fg: (color: string, text: string) => {
        colors.push(color);
        return text;
      },
      bg: (_color: string, text: string) => text,
      bold: (text: string) => text,
    };
    const line = renderStatusLine({ mode: "Audit", model: "model", effort: "high", cwd: "~", git: null, context: usage(1, 61), cost: 0.482 }, 200, theme);
    expect(line.indexOf("ctx")).toBeLessThan(line.indexOf("$0.482"));
    expect(colors).toContain("mdCode");
    expect(colors).toContain("syntaxType");
    expect(colors).toContain("mdLink");
  });

  it("drops cost before context when the terminal is narrow", () => {
    const line = renderStatusLine({ mode: "Build", model: "model", effort: "high", cwd: "~", git: null, context: usage(1, 61), cost: 4.2 }, 20, {
      fg: (_color: string, text: string) => text,
      bg: (_color: string, text: string) => text,
      bold: (text: string) => text,
    });
    expect(line).not.toContain("$4.200");
    expect(line).toContain("61%");
  });
  it("formats git metadata with worktree and dirty state", () => {
    expect(
      formatGit({
        repoName: "pi",
        branch: "main",
        worktreeName: "pi-leon-tui",
        linkedWorktree: true,
        dirtyFiles: 3,
        ahead: 2,
        behind: 1,
        conflict: false,
      }),
    ).toBe("git main @ wt pi-leon-tui ↑2 ↓1 *3");
  });

  it("marks conflicts", () => {
    expect(formatGit({
      repoName: "pi",
      branch: "main",
      worktreeName: "pi",
      linkedWorktree: false,
      dirtyFiles: 1,
      ahead: 0,
      behind: 0,
      conflict: true,
    })).toBe("git main @ pi *1 !");
  });

  it("formats Pi mode names instead of the TUI renderer mode", () => {
    expect(formatMode("Plan", false)).toBe("PLAN");
    expect(formatMode("GLM-Build", true)).toBe("GLM-BUILD");
  });

  it("truncates titles at a word boundary", () => {
    expect(stripTerminalSequences(formatTitle("A very long session title that needs trimming", 24))).toBe("▌ A very long session t…");
  });
});
