# Browse items

The Items view lists every saved item, newest first. Each item shows its title, the first 180 characters of its body, and when it was last updated. An empty notebook shows an invitation instead, and an unreadable notebook file shows an error without overwriting the file.

## Sub-features

- `browse-empty` shows `A fresh page awaits` and `Items 0` with no items.
- `browse-list` lists items newest first with title, excerpt, and `Updated …` time.
- `browse-count` keeps the `Items N` heading equal to the number of items.
- `browse-no-body` shows `No body text` for an item with an empty body.
- `browse-error` shows `Unable to open items` and a `Try again` button when `items.json` is invalid, and leaves the file untouched.

## How to get to it (user POV)

- The app opens on Items.
- Choose `Items` in the main navigation or the `Pocket Notebook` brand link.
- Choose `← All items` or `Cancel` from an editor, or `Open your notebook` on About.

## Driving it with notebook.sh

Preconditions:

- Baseline: `$S doctor` passes.

- **Empty state.** Run `$S cdp text main`. The output contains `Items 0` and `A fresh page awaits`.
- **List order.** Create `First` and then `Second` with the [create recipe](./create-item.md). Run `$S cdp text 'ul.items'`. `Second` is listed before `First`, and the heading reads `Items 2`. Run `$S shot browse-list`.
- **No body.** Create an item with a title only. Its excerpt reads `No body text`.
- **Unreadable file.** Stop the app, write invalid JSON to the data file, and relaunch with the same data. `launch` recreates `PN_RUN`, so this needs a manual launch. Treat it as unverified until the helper supports reusing data. The expected heading is `Unable to open items`, with the status `The notebook file contains invalid items.` or a JSON parse error.

## Gotchas

- Times use the app's locale. Assert the presence of `Updated`, not an exact string.
- Excerpts are cut at 180 characters with no ellipsis.
- `launch` always starts from an empty data directory. Preloading a file is not supported yet.
