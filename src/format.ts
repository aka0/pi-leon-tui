import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export interface ContextUsageLike {
  tokens: number | null;
  percent: number | null;
  contextWindow: number;
}

export interface GitSnapshot {
  repoName: string;
  branch: string;
  worktreeName: string;
  linkedWorktree: boolean;
  dirtyFiles: number;
  ahead: number;
  behind: number;
  conflict: boolean;
}

export interface StatusTheme {
  fg(color: string, text: string): string;
  bg(color: string, text: string): string;
  bold(text: string): string;
}

export function renderContextBar(percent: number | null, width: number): string {
  const size = Math.max(1, Math.min(12, width));
  if (percent === null || !Number.isFinite(percent)) return `[${"·".repeat(size)}]`;

  const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * size);
  return `[${"█".repeat(filled)}${"·".repeat(size - filled)}]`;
}

export function formatContext(usage: ContextUsageLike, barWidth = 10): string {
  const percent = usage.percent === null ? "?" : `${Math.round(Math.max(0, usage.percent))}%`;
  return `ctx ${renderContextBar(usage.percent, barWidth)} ${percent} · ${formatCount(usage.contextWindow)}`;
}

// Context uses a cyan hue in the normal state so it does not read as git cleanliness.
export function contextColor(usage: ContextUsageLike): "syntaxType" | "warning" | "error" {
  if (usage.percent === null) return "warning";
  if (usage.percent >= 90) return "error";
  if (usage.percent >= 70) return "warning";
  return "syntaxType";
}

export function formatCost(cost: number): string {
  if (!Number.isFinite(cost) || cost < 0) return "$?";
  return cost < 10 ? `$${cost.toFixed(3)}` : `$${cost.toFixed(2)}`;
}

export function formatGit(git: GitSnapshot | null): string {
  if (!git) return "git no-repo";
  const worktree = git.linkedWorktree ? `wt ${git.worktreeName}` : git.worktreeName;
  const tracking = `${git.ahead ? ` ↑${git.ahead}` : ""}${git.behind ? ` ↓${git.behind}` : ""}`;
  const dirty = git.dirtyFiles ? ` *${git.dirtyFiles}` : "";
  const conflict = git.conflict ? " !" : "";
  return `git ${git.branch} @ ${worktree}${tracking}${dirty}${conflict}`;
}

export function formatMode(mode: string, compact: boolean): string {
  const normalized = mode.trim() || "DEFAULT";
  return truncateToWidth(normalized.toUpperCase(), compact ? 10 : 16);
}

export function formatEffort(level: string, compact: boolean): string {
  if (level === "off") return compact ? "OFF" : "OFF";
  return compact ? level.slice(0, 2).toUpperCase() : level.toUpperCase();
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "?";
  if (value < 1_000) return `${Math.round(value)}`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}m`;
}

export function formatTitle(title: string, width: number): string {
  return truncateToWidth(`▌ ${title}`, Math.max(1, width), "…");
}

export interface StatusLineValues {
  mode: string;
  model: string;
  effort: string;
  cwd: string;
  git: GitSnapshot | null;
  context: ContextUsageLike;
  cost?: number;
}

export function renderStatusLine(values: StatusLineValues, width: number, theme: StatusTheme): string {
  const compact = width < 120;
  const mode = theme.fg("mdCode", formatMode(values.mode, compact));
  const model = theme.fg("syntaxFunction", truncateToWidth(values.model || "no-model", compact ? 18 : 32));
  const effort = theme.fg(values.effort === "off" ? "muted" : "thinkingHigh", formatEffort(values.effort, compact));
  const cwd = theme.fg("text", truncateToWidth(values.cwd, compact ? 24 : 40));
  const git = colorGit(values.git, theme, compact ? 26 : 42);
  const context = theme.fg(contextColor(values.context), compact ? formatCompactContext(values.context, width) : formatContext(values.context, 10));
  const cost = values.cost === undefined ? "" : theme.fg("mdLink", formatCost(values.cost));
  const connector = theme.fg("dim", " ◆ ");
  const divider = theme.fg("dim", " │ ");
  const tail = cost ? `${context}${divider}${cost}` : context;

  const wide = `${mode}${connector}${model}${connector}${effort}${divider}${cwd}${divider}${git}${divider}${tail}`;
  if (visibleWidth(wide) <= width) return wide;
  if (!compact) return truncateToWidth(wide, width, "…");

  // Keep the context segment intact at narrow widths. It is the most useful
  // warning signal, so trim optional identity fields and cost before trimming it.
  const gitBranch = theme.fg(values.git?.conflict ? "error" : values.git?.dirtyFiles ? "warning" : "success", values.git ? `git ${values.git.branch}` : "git ?");
  const prefixes = [
    `${mode}${connector}${model}${connector}${effort}${divider}${cwd}${divider}${git}`,
    `${mode}${connector}${model}${connector}${effort}${divider}${git}`,
    `${mode}${connector}${model}${connector}${effort}${divider}${gitBranch}`,
    `${mode}${connector}${model}${connector}${effort}`,
    `${mode}${connector}${effort}`,
    mode,
  ];
  for (const candidate of tail === context ? [context] : [tail, context]) {
    const budget = Math.max(0, width - visibleWidth(candidate) - 1);
    const prefix = prefixes.find((entry) => visibleWidth(entry) <= budget);
    if (prefix !== undefined) return `${prefix} ${candidate}`;
  }
  return truncateToWidth(context, width, "");
}

function formatCompactContext(usage: ContextUsageLike, width: number): string {
  const standard = formatContext(usage, 6);
  if (visibleWidth(standard) <= width) return standard;

  const percent = usage.percent === null ? "?" : `${Math.round(Math.max(0, usage.percent))}%`;
  const barWidth = Math.max(1, Math.min(6, width - percent.length - 3));
  const bar = renderContextBar(usage.percent, barWidth);
  const compact = `${bar} ${percent} · ${formatCount(usage.contextWindow)}`;
  if (visibleWidth(compact) <= width) return compact;
  const minimal = `${bar} ${percent}`;
  return visibleWidth(minimal) <= width ? minimal : truncateToWidth(minimal, width, "");
}

function colorGit(git: GitSnapshot | null, theme: StatusTheme, width: number): string {
  const color = !git ? "muted" : git.conflict ? "error" : git.dirtyFiles ? "warning" : "success";
  return theme.fg(color, truncateToWidth(formatGit(git), width));
}
