---
name: verify-pocket-notebook
description: Launch the packaged Pocket Notebook Electron app on a private Xvfb display, drive its window like a user over the Chrome DevTools Protocol, and capture screen evidence. Use to show a Pocket Notebook change working in the real desktop app on Linux, not just in unit tests.
---

# Verify Pocket Notebook

Pocket Notebook is a single-window Electron desktop app. Users browse items, create, edit, and delete them, and read an About view. The repo has no UI test harness, so this skill drives the packaged Linux build over the Chrome DevTools Protocol (CDP) inside its own Xvfb display. The [feature map](features/README.md) holds one recipe per feature.

Run every command from the repository root. `scripts/notebook.sh` is the single entry point:

```sh
S=.agents/skills/verify-pocket-notebook/scripts/notebook.sh
```

## Requirements

- Linux with `Xvfb` and ImageMagick `import` installed. Both are VM-wide installs, not per repo. `docs/agents/proof.md` does not list Xvfb yet.
- Node.js 22.13 or newer (the helper uses the built-in `fetch` and `WebSocket`).
- `npm ci` has been run in this checkout.

## Launch

```sh
$S launch   # teardown: $S stop (see Cleanup)
```

Launch requires `Xvfb` and ImageMagick `import` on the machine, and refuses to start without them.

Launch does the following:

1. Runs `npm run package`, which rebuilds `out/Pocket Notebook-linux-x64/` from the current checkout.
2. Starts `Xvfb` at 1280x800 on a free display.
3. Starts the packaged app with `XDG_CONFIG_HOME` pointed at an empty scratch directory, so the app starts with no items and never touches `~/.config/Pocket Notebook`.
4. Waits until the Items list has rendered (`main h1 .count` visible), which happens only after the app has read its notebook file.

It prints `ready: display …, CDP port …, commit …`, plus the data and evidence directories. The app passes `--no-sandbox`, because the Factory VM cannot run Chromium's SUID sandbox helper and restricts unprivileged user namespaces. Without the flag the app aborts at startup, including with the README's `xvfb-run` smoke command. Every other flag matches what a user runs.

Environment overrides:

- `PN_RUN` sets the scratch directory for instance state and app data. The default is `/tmp/pocket-notebook-verify/run`.
- `PN_EVIDENCE` sets the evidence directory. The default is `/tmp/pocket-notebook-verify/evidence/<UTC timestamp>`. It must be outside `PN_RUN`, because `stop` deletes `PN_RUN` wholesale. Launch refuses an evidence directory inside it.

## Isolation

Each instance has its own display, data directory, and CDP port (chosen by the OS). Two instances can run side by side with different `PN_RUN` values. On the shared 2-vCPU Factory VM, run only one instance at a time and stop it when done. Launch refuses to start over a live instance in the same `PN_RUN`. Never drive an instance that this run did not launch.

## Doctor

```sh
$S doctor
```

Doctor is read-only. It requires all of the following, and exits non-zero otherwise:

- The Xvfb and app processes are alive.
- The CDP port is the one recorded in this run's data directory.
- The page is loaded from this checkout's `out/` build.
- The build commit equals `HEAD`.

Run it first whenever anything looks off. If the commit check fails, stop and launch again.

## Drive

```sh
$S cdp <command> <selector> [text] [--name "<accessible name>"] [--dialog accept|dismiss] [--timeout ms]
```

| Command         | What it does                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wait SEL`      | Waits until a visible element matches.                                                                                                                  |
| `click SEL`     | Moves, presses, and releases the mouse at the element's centre through `Input.dispatchMouseEvent`. Fails if the element is disabled or covered.         |
| `type SEL TEXT` | Clicks the field, selects all with Ctrl+A, and inserts the text through `Input.insertText`. This fires the same `input` events as typing.               |
| `key KEY`       | Presses a named key (`End`, `Home`, `PageDown`, `PageUp`, `Escape`, `Enter`, `Tab`) in the focused page. Use `End` to scroll the status line into view. |
| `text [SEL]`    | Prints the element's visible text. The default element is `body`.                                                                                       |
| `axtree`        | Prints the accessibility tree as `role "name"` lines.                                                                                                   |
| `value SEL`     | Prints a form field's current value. `text` does not include field values.                                                                              |
| `url`           | Prints the page URL. The route is in the hash.                                                                                                          |

- `--name` picks the element whose `aria-label`, or else whose whitespace-collapsed text, equals the name. Prefer it over position: `$S cdp click a --name '+ New item'`.
- `confirm()` dialogs are reported through CDP. Pass `--dialog accept` or `--dialog dismiss` on the action that opens one. Without the flag, the helper dismisses the dialog and exits 3, so a surprise prompt never blocks later commands.
- Never call `window.notebook.*`, set `location.hash`, or assign `.value` directly. Those calls skip the user path.

Stable handles in this app: the `Main navigation` links `Items` and `About`, the `+ New item` link, the `#title` and `#body` fields, and the `Save item` button. In the editor there are also the `Cancel` link, the `#delete` button (`Delete item`), and the `← All items` link. In the list, each item is a link under `ul.items` whose `h2` is the title. The heading `Items N` shows the count.

## Evidence

```sh
$S shot <label>   # full-screen PNG of the Xvfb display, plus an accessibility-tree dump
$S data           # the stored items.json, as a second read-only view
```

`shot` writes `NN-<label>.png` and `NN-<label>.ax.txt` to the evidence directory. It also appends a line with the UTC time and build commit to `captures.txt`. Follow these standards:

- Exercise the real user path: pointer and keyboard input on visible controls.
- Capture the action and its result. Take one shot with the filled form before saving and one of the resulting list, not only the final screen.
- Verify the side effect as well as the screen. `$S data` must show the saved title and body in `items.json`.
- Mocks are never needed. The app has no network or external services.
- A commit marked `-dirty` means uncommitted changes under `src` or `index.html` were built. Say so when reporting.

## Cleanup

```sh
$S stop
```

Stop terminates only the process groups it started (app, then Xvfb) by recorded PID, never by name. It then deletes the scratch `PN_RUN` directory, including the app data. Evidence stays in the evidence directory that launch printed. Run `stop` after every run, including failed runs.

## Helpers

- `scripts/notebook.sh` provides `launch`, `doctor`, `cdp …`, `shot <label>`, `data`, and `stop`, as shown above.
- `scripts/cdp.mjs` is the CDP driver that `notebook.sh cdp` runs. Call it directly only with a port: `node scripts/cdp.mjs <port> <command> …`.
