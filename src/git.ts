import { basename, resolve } from "node:path";
import type { ExecOptions, ExecResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { GitSnapshot } from "./format.ts";

export interface GitExecutor {
  (command: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
}

const CACHE_TTL_MS = 5_000;
const COMMAND_TIMEOUT_MS = 2_000;

export async function readGitSnapshot(exec: GitExecutor, cwd: string): Promise<GitSnapshot | null> {
  try {
    const metadata = await exec("git", ["rev-parse", "--show-toplevel", "--git-dir", "--git-common-dir", "--abbrev-ref", "HEAD", "--short", "HEAD"], { cwd, timeout: COMMAND_TIMEOUT_MS });
    if (metadata.code !== 0) return null;

    const lines = metadata.stdout.trim().split(/\r?\n/);
    if (lines.length < 5) return null;
    const status = await exec("git", ["status", "--porcelain=v1", "--branch", "--untracked-files=normal"], { cwd, timeout: COMMAND_TIMEOUT_MS });
    if (status.code !== 0) return null;
    return parseGitSnapshot(lines, status.stdout, cwd);
  } catch {
    return null;
  }
}

export function parseGitSnapshot(metadataLines: string[], statusOutput: string, cwd = process.cwd()): GitSnapshot | null {
  if (metadataLines.length < 5) return null;
  const [root, gitDir, commonGitDir, head, shortHead] = metadataLines;
  if (!root || !gitDir || !commonGitDir || !head || !shortHead) return null;

  const statusLines = statusOutput.trimEnd() ? statusOutput.trimEnd().split(/\r?\n/) : [];
  const branchLine = statusLines.find((line) => line.startsWith("## ")) ?? "";
  const branch = head === "HEAD" ? `detached@${shortHead}` : head;
  const ahead = Number(branchLine.match(/ahead (\d+)/)?.[1] ?? 0);
  const behind = Number(branchLine.match(/behind (\d+)/)?.[1] ?? 0);
  const changes = statusLines.filter((line) => line.length >= 2 && !line.startsWith("## "));
  const absoluteRoot = resolve(cwd, root);
  const absoluteGitDir = resolve(cwd, gitDir);
  const absoluteCommonGitDir = resolve(cwd, commonGitDir);

  return {
    repoName: basename(absoluteRoot),
    branch,
    worktreeName: basename(absoluteRoot),
    linkedWorktree: absoluteGitDir !== absoluteCommonGitDir,
    dirtyFiles: changes.length,
    ahead,
    behind,
    conflict: changes.some((line) => /^(UU|AA|DD|AU|UA|DU|UD)/.test(line)),
  };
}

export class GitStatusCache {
  private snapshot: GitSnapshot | null = null;
  private refreshedAt = 0;
  private inFlight: Promise<GitSnapshot | null> | undefined;
  private readonly abortController = new AbortController();

  constructor(private readonly exec: GitExecutor, private readonly cwd: string) {}

  get value(): GitSnapshot | null {
    return this.snapshot;
  }

  refresh(force = false): Promise<GitSnapshot | null> {
    if (this.inFlight) return this.inFlight;
    if (!force && Date.now() - this.refreshedAt < CACHE_TTL_MS) return Promise.resolve(this.snapshot);

    this.inFlight = readGitSnapshotWithSignal(this.exec, this.cwd, this.abortController.signal)
      .then((snapshot) => {
        this.snapshot = snapshot;
        this.refreshedAt = Date.now();
        return snapshot;
      })
      .finally(() => {
        this.inFlight = undefined;
      });
    return this.inFlight;
  }

  dispose(): void {
    this.abortController.abort();
  }
}

export function createGitExecutor(pi: ExtensionAPI): GitExecutor {
  return (command, args, options) => pi.exec(command, args, options);
}

function readGitSnapshotWithSignal(exec: GitExecutor, cwd: string, signal: AbortSignal): Promise<GitSnapshot | null> {
  return readGitSnapshot((command, args, options) => exec(command, args, { ...options, signal }), cwd);
}
