import { describe, expect, it } from "vitest";
import { parseGitSnapshot } from "./git.ts";

describe("git snapshot parsing", () => {
  const metadata = ["/repo/worktree", ".git/worktrees/leon", "/repo/.git", "main", "abc123"];

  it("parses linked worktree, tracking, and dirty files", () => {
    expect(parseGitSnapshot(metadata, "## main...origin/main [ahead 2, behind 1]\n M src/index.ts\n?? notes.md", "/repo")).toEqual({
      repoName: "worktree",
      branch: "main",
      worktreeName: "worktree",
      linkedWorktree: true,
      dirtyFiles: 2,
      ahead: 2,
      behind: 1,
      conflict: false,
    });
  });

  it("handles detached heads and conflicts", () => {
    expect(parseGitSnapshot(["/repo", ".git", ".git", "HEAD", "abc123"], "## HEAD (no branch)\nUU file.ts", "/repo")).toMatchObject({
      branch: "detached@abc123",
      linkedWorktree: false,
      dirtyFiles: 1,
      conflict: true,
    });
  });

  it("treats executor failures as no repository", async () => {
    const { readGitSnapshot } = await import("./git.ts");
    await expect(readGitSnapshot(async () => { throw new Error("spawn failed"); }, "/repo")).resolves.toBeNull();
  });

  it("rejects incomplete metadata", () => {
    expect(parseGitSnapshot(["/repo"], "## main")).toBeNull();
  });
});
