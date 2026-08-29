import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createGitExecutor, GitStatusCache } from "./git.ts";
import { createStatusFooter } from "./components/status-footer.ts";
import { registerSessionNaming } from "./naming/index.ts";

export default function piLeonTui(pi: ExtensionAPI): void {
  registerSessionNaming(pi);

  let requestRender: (() => void) | undefined;
  let refreshGit: ((force?: boolean) => Promise<void>) | undefined;
  let activeGit: GitStatusCache | undefined;

  pi.on("session_start", async (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    const themeResult = ctx.ui.setTheme("leon");
    if (!themeResult.success) console.warn(`[pi-leon-tui] Could not apply Leon theme: ${themeResult.error ?? "unknown error"}`);

    activeGit?.dispose();
    const git = new GitStatusCache(createGitExecutor(pi), ctx.cwd);
    activeGit = git;
    refreshGit = async (force = false) => {
      await git.refresh(force);
      requestRender?.();
    };
    ctx.ui.setFooter((tui, theme, footerData) => {
      requestRender = () => tui.requestRender();
      return createStatusFooter(tui, theme, {
        context: ctx,
        footerData,
        git,
        getTitle: () => pi.getSessionName(),
      });
    });
    requestRender?.();
  });

  const render = () => requestRender?.();
  const refresh = async () => {
    render();
    await refreshGit?.();
  };
  pi.on("session_info_changed", render);
  pi.on("model_select", render);
  pi.on("thinking_level_select", render);
  pi.on("session_compact", render);
  pi.on("turn_end", refresh);
  pi.on("agent_settled", refresh);
  pi.on("tool_execution_end", refresh);

  pi.on("session_shutdown", async () => {
    activeGit?.dispose();
    activeGit = undefined;
    requestRender = undefined;
    refreshGit = undefined;
  });
}
