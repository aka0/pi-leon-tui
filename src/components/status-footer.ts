import type { ReadonlyFooterDataProvider, ExtensionContext, SessionEntry, Theme } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { visibleWidth } from "@earendil-works/pi-tui";
import { GitStatusCache } from "../git.ts";
import { deriveLocalTitle } from "../naming/title.ts";
import { formatTitle, renderStatusLine, type StatusTheme } from "../format.ts";

export interface StatusFooterOptions {
  context: ExtensionContext;
  footerData: ReadonlyFooterDataProvider;
  git: GitStatusCache;
  getTitle: () => string | undefined;
}

export class StatusFooter implements Component {
  private readonly unsubscribeBranch: () => void;
  private costLeafId: string | null = null;
  private cost = 0;

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly options: StatusFooterOptions,
  ) {
    this.unsubscribeBranch = options.footerData.onBranchChange(() => {
      void this.refreshGit();
    });
    void this.refreshGit();
  }

  invalidate(): void {}

  render(width: number): string[] {
    const title = this.options.getTitle() ?? optionsTitle(this.options.context);
    const summary = this.paint("customMessageBg", this.paintText("accent", formatTitle(title ?? "New session", width)), width);
    const context = this.options.context.getContextUsage();
    const usage = context ?? {
      tokens: null,
      percent: null,
      contextWindow: this.options.context.model?.contextWindow ?? 0,
    };
    const line = renderStatusLine({
      mode: getPiMode(this.options.footerData),
      model: this.options.context.model?.id ?? "no-model",
      effort: this.options.context.thinkingLevel ?? "off",
      cwd: abbreviatePath(this.options.context.cwd),
      git: this.options.git.value,
      context: usage,
      cost: this.sessionCost(),
    }, width, this.theme as unknown as StatusTheme);
    return [this.paint("toolPendingBg", line, width), summary];
  }

  dispose(): void {
    this.unsubscribeBranch();
    this.options.git.dispose();
  }

  private sessionCost(): number {
    const leafId = this.options.context.sessionManager.getLeafId();
    if (leafId === null || leafId !== this.costLeafId) {
      this.costLeafId = leafId;
      this.cost = calculateSessionCost(this.options.context.sessionManager.getBranch());
    }
    return this.cost;
  }

  private async refreshGit(): Promise<void> {
    await this.options.git.refresh(true);
    this.tui.requestRender();
  }

  private paint(color: "customMessageBg" | "toolPendingBg", text: string, width: number): string {
    const padded = text + " ".repeat(Math.max(0, width - visibleWidth(text)));
    return this.theme.bg(color, padded);
  }

  private paintText(color: Parameters<Theme["fg"]>[0], text: string): string {
    return this.theme.fg(color, text);
  }
}

export function createStatusFooter(tui: TUI, theme: Theme, options: StatusFooterOptions): StatusFooter {
  return new StatusFooter(tui, theme, options);
}

export function calculateSessionCost(entries: readonly SessionEntry[]): number {
  return entries.reduce((total, entry) => {
    if (entry.type === "message" && entry.message.role === "assistant") {
      return total + usageCost(entry.message.usage);
    }
    if (entry.type === "compaction" || entry.type === "branch_summary") {
      return total + usageCost(entry.usage);
    }
    return total;
  }, 0);
}

function usageCost(usage: { cost?: { total?: number } } | undefined): number {
  const total = usage?.cost?.total;
  return total !== undefined && Number.isFinite(total) && total >= 0 ? total : 0;
}

function getPiMode(footerData: ReadonlyFooterDataProvider): string {
  const status = footerData.getExtensionStatuses().get("mode");
  const match = status?.match(/mode:([^ (·\u001b]+)/i);
  return match?.[1] ?? "DEFAULT";
}

function optionsTitle(context: ExtensionContext): string | undefined {
  const firstUserMessage = context.sessionManager.getBranch().find((entry) => entry.type === "message" && entry.message.role === "user");
  return firstUserMessage && firstUserMessage.type === "message" && firstUserMessage.message.role === "user"
    ? deriveLocalTitle(firstUserMessage.message.content)
    : undefined;
}

function abbreviatePath(path: string): string {
  const home = process.env.HOME;
  if (home && (path === home || path.startsWith(`${home}/`))) return `~${path.slice(home.length)}`;
  return path;
}
