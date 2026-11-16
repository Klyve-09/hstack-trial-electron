# About view

The About view explains that items stay on the device in a local JSON file with no accounts or cloud sync. It links back to the notebook.

## Sub-features

- `about-open` shows the heading `About Pocket Notebook` and its explanation.
- `about-back` returns to Items through `Open your notebook`.

## How to get to it (user POV)

- Choose `About` in the main navigation.

## Driving it with notebook.sh

Preconditions:

- Baseline: `$S doctor` passes.

- **Open.** Run `$S cdp click 'nav a' --name About` then `$S cdp text main`. The output contains `About Pocket Notebook` and `There are no accounts or cloud sync.`. Run `$S shot about`.
- **Back.** Run `$S cdp click a --name 'Open your notebook'`. The heading reads `Items N`.

## Gotchas

- Choosing About from a dirty editor raises `Discard your unsaved changes?`. Pass `--dialog`.
