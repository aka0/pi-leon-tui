# pi-leon-tui

A restrained Pi visual setup with an opaque dark theme, native terminal selection, integrated Phantom session naming, and a two-line status footer.

## Install

```sh
pi install /path/to/pi-leon-tui
```

Remove `@agnishc/edb-auto-name-session-phantom` if it is installed separately. This package contains that behavior and otherwise two extensions can race to name a new session.

The naming flow uses the `phantom` provider and the cheapest configured text model. If that provider is unavailable, the footer still works and falls back to a local title from the first prompt.

## Footer

The first line shows the Pi mode, model ID (without the redundant provider name), thinking effort, cwd, git/worktree state, both a context bar and numeric usage, and current session cost. The second line shows the session title.

Git metadata refreshes after completed turns and branch changes. Refreshes use a five-second cache and a two-second command timeout. A linked worktree is shown as `wt <name>`; dirty files, ahead/behind counts, and conflicts are shown when available.

Pi's regular TUI mode keeps text selectable by the terminal. Fullscreen mode uses Pi's application selection support and may require OSC 52 clipboard permissions in the terminal.

Theme backgrounds make message panels opaque. Pi cannot paint the terminal's default background from an extension, so set the terminal profile background when full-screen opacity is required.
