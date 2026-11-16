# Create an item

A user opens a blank editor, enters a title and body, and saves them. The new item appears at the top of the Items list and is stored on disk.

## Sub-features

- `create-open` opens a blank `New item` editor from each entry point.
- `create-save` saves a title and body and returns to the list.
- `create-persist` stores the item in `items.json`, where it survives a relaunch.
- `create-validate` refuses an empty or whitespace-only title.
- `create-cancel` discards an unfinished draft after confirmation.

## How to get to it (user POV)

- Choose `+ New item` in the Items list header.
- Choose `Write an item →` in the empty state (only when there are no items).

## Driving it with notebook.sh

Preconditions:

- Baseline: `$S doctor` passes and the heading reads `Items 0`.

- **Open editor.** Choose `+ New item`. Run `$S cdp click a --name '+ New item'` then `$S cdp text 'main h1'`. The output is `New item`, and the editor shows empty `Title` and `Body` fields and a `Save item` button.
- **Enter content.** Run `$S cdp type '#title' 'Release checklist'` and `$S cdp type '#body' 'Tag and publish'`. Then run `$S shot create-filled`. The screenshot shows both values in the form.
- **Save.** Choose `Save item`. Run `$S cdp click button --name 'Save item'` then `$S cdp wait 'ul.items h2' --name 'Release checklist'`. The list returns, the heading reads `Items 1`, and the first item shows `Release checklist`, the excerpt `Tag and publish`, and an `Updated …` time. Run `$S shot create-listed`.
- **Persist.** Run `$S data`. The output is a JSON array with one object whose `title` is `Release checklist` and `body` is `Tag and publish`, plus an `id` and an ISO `updatedAt`. To check that the item survives a relaunch, copy `items.json` out first, because `stop` deletes the data directory.
- **Reopen.** Choose the item. Run `$S cdp click 'ul.items a'`, `$S cdp text 'main h1'`, `$S cdp value '#title'`, and `$S cdp value '#body'`. The outputs are `Edit item`, `Release checklist`, and `Tag and publish`. Run `$S shot create-reopened`.
- **Empty title.** From a new editor, type a body only and choose `Save item`. Run `$S cdp click a --name '+ New item'`, `$S cdp type '#body' 'no title'`, and `$S cdp click button --name 'Save item'`. Then run `$S cdp url`. The route stays on `#new`, because the browser's required-field check blocks submit. No dialog or status text appears. A title of only spaces passes that check. Run `$S cdp type '#title' '   '`, `$S cdp click button --name 'Save item'`, and `$S cdp text '#message'`. The status reads `Error invoking remote method 'items:save': Error: Enter a title of 1–120 characters and a shorter body.`, and the route stays on `#new`. Leave this editor with `$S cdp click a --name Cancel --dialog accept`.
- **Cancel draft.** Open a new editor, type `Discard me`, and choose `Cancel`. Run `$S cdp click a --name '+ New item'`, `$S cdp type '#title' 'Discard me'`, and `$S cdp click a --name Cancel --dialog accept`. The helper prints `dialog "Discard your unsaved changes?" accepted`, the list returns, and no `Discard me` item exists.

## Gotchas

- The `Item saved.` status text is cleared almost immediately, because navigating back to `#items` empties the status line. Do not wait for it. Use the list and `$S data` as evidence. This may be an app bug.
- The whitespace-title error carries Electron's IPC prefix `Error invoking remote method 'items:save': Error:`. That is what users see, so match the full text or its tail. This may be an app bug.
- Titles are trimmed on save. Assert the rendered title, not the typed value.
- `Write an item →` is only present while the notebook is empty.
- `Cancel` and `← All items` on a dirty form raise `confirm()`. Without `--dialog`, the helper dismisses it and exits 3.
- `$S stop` deletes the data directory. Copy `items.json` elsewhere first if a later relaunch must see it.
