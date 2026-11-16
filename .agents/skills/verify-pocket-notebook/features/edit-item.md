# Edit an item

A user opens a saved item from the list, changes its title or body, and saves it. The item moves to the top with a new update time. Leaving a changed form without saving asks for confirmation.

## Sub-features

- `edit-open` opens `Edit item` with the saved values and an `Updated …` line.
- `edit-save` saves changes, keeps the same `id`, and refreshes `updatedAt`.
- `edit-guard-keep` keeps the form when the user declines `Discard your unsaved changes?`.
- `edit-guard-discard` returns to the list without saving when the user accepts.

## How to get to it (user POV)

- Choose an item in the Items list.

## Driving it with notebook.sh

Preconditions:

- One item titled `Release checklist` exists, created with the [create recipe](./create-item.md).

- **Open.** Run `$S cdp click 'ul.items a'` then `$S cdp text 'main h1'`. The output is `Edit item`.
- **Change and save.** Run `$S cdp type '#title' 'Release checklist v2'` and `$S cdp click button --name 'Save item'`. Then run `$S cdp wait 'ul.items h2' --name 'Release checklist v2'`. Run `$S data`. It shows the same `id` with the new title and a later `updatedAt`.
- **Decline discard.** Reopen the item, type a new title, and choose `Items`. Run `$S cdp click 'nav a' --name Items --dialog dismiss`. The helper prints `dialog "Discard your unsaved changes?" dismissed`, and `$S cdp url` still ends in `#edit/<id>`.
- **Accept discard.** Run `$S cdp click 'nav a' --name Items --dialog accept`. The list returns, and `$S data` still holds the previously saved title.

## Gotchas

- Typing marks the form dirty. Any later navigation raises a `confirm()`, so pass `--dialog`.
- Closing the window while the form is dirty raises `Close without saving your changes?`. Stop the app with `$S stop`, not by closing the window.
- The `Item saved.` status is cleared on navigation. Assert the list and `$S data` instead.
