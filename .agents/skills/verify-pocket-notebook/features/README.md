# Pocket Notebook verification map

This directory is the maintained source for verifying the user-facing behavior of Pocket Notebook. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Set `S=.agents/skills/verify-pocket-notebook/scripts/notebook.sh` and run commands from the repository root.
- Launch with `$S launch`. It packages the current checkout and starts the app on its own Xvfb display with an empty, disposable data directory.
- Run `$S doctor` and require every line to be `ok`.
- The baseline is an empty notebook. Its heading reads `Items 0` and the page shows `A fresh page awaits`.
- Never drive an instance that was not started by this verification run.

## Driving conventions

- Start every recipe from the baseline unless its preconditions say otherwise. To return to the baseline, run `$S stop` and then `$S launch`.
- Prefer `--name` with a visible label over CSS position.
- Run every UI action through `$S cdp click` or `$S cdp type`. These send real pointer and keyboard input.
- Any action that can raise a `confirm()` prompt takes `--dialog accept` or `--dialog dismiss`.
- Treat every command as literal. Keep quoted names and flags unchanged.

## Evidence and skip reporting

- Capture the user action and the resulting state with `$S shot <label>`. Each shot is a full-screen PNG plus an accessibility-tree dump.
- Mutation evidence includes a read-only second view of the stored value from `$S data`.
- Record the feature file and entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with notebook.sh` starts with `Preconditions:` and uses labeled bullets. Each bullet pairs a user action with an exact command and an observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

## Features

- [Browse items](./browse-items.md) covers the list, empty state, ordering, and the unreadable-file state.
- [Create an item](./create-item.md) covers both entry points, saving, persistence, validation, and cancelling.
- [Edit an item](./edit-item.md) covers opening, changing, saving, and the unsaved-changes prompt.
- [Delete an item](./delete-item.md) covers confirming and declining deletion.
- [About view](./about.md) covers the About page and its link back to the notebook.
