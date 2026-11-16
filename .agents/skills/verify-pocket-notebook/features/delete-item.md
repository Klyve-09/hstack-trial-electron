# Delete an item

A user opens a saved item and deletes it after confirming. Declining the confirmation keeps the item.

## Sub-features

- `delete-confirm` removes the item from the list and from `items.json`.
- `delete-decline` keeps the item and stays in the editor.

## How to get to it (user POV)

- Open an item from the Items list and choose `Delete item`.

## Driving it with notebook.sh

Preconditions:

- One item titled `Release checklist` exists, created with the [create recipe](./create-item.md).

- **Decline.** Run `$S cdp click 'ul.items a'` then `$S cdp click '#delete' --dialog dismiss`. The helper prints `dialog "Delete this item? This cannot be undone." dismissed`. The editor stays open, and `$S data` still holds the item.
- **Confirm.** Run `$S cdp click '#delete' --dialog accept`. The list returns with `Items 0` and `A fresh page awaits`, and `$S data` prints `[]`. Run `$S shot delete-done`.

## Gotchas

- `Delete item` exists only in the editor of a saved item, not in `New item`.
- After deleting the last item, `items.json` remains as an empty array. It is not removed.
- The `Item deleted.` status is cleared on navigation, like `Item saved.`.
