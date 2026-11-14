# Pocket Notebook

A small Electron app for notes, ideas, and everyday reminders. Browse your items, create or edit a title and body, and delete notes you no longer need. An About view explains how the notebook works.

Items are stored only on your device. There are no accounts, servers, analytics, or cloud sync. Click **Save item** to keep an edit; unsaved changes prompt before navigation or closing.

## Development

Use Node.js 22.12 or newer and npm. Linux needs the usual Electron desktop libraries and a graphical session.

```sh
npm ci
npm start
```

## Checks and builds

```sh
npm test
npm run lint
npm run typecheck
npm run package
```

`npm test` runs the Vitest storage tests. `npm run lint` runs Oxlint and checks formatting with Oxfmt; `npm run lint:fix` applies fixes. `npm run package` creates a desktop application in `out/` for your current platform. On Linux x64, launch it with:

```sh
"out/Pocket Notebook-linux-x64/Pocket Notebook"
```

For a headless Linux desktop smoke run, use Xvfb:

```sh
xvfb-run -a "out/Pocket Notebook-linux-x64/Pocket Notebook" --disable-gpu
```

## Local data

The main process reads and writes `items.json` in Electron's `app.getPath('userData')` directory. On Linux the default is `~/.config/Pocket Notebook/items.json`; on macOS it is `~/Library/Application Support/Pocket Notebook/items.json`, and on Windows it is `%APPDATA%/Pocket Notebook/items.json`. The file is created on the first save. Back it up by copying it while the app is closed.

Each item has an ID, title, body, and last-updated timestamp. Saves use a temporary file and rename; unreadable existing data is reported without being overwritten. This is plain JSON, not encrypted storage.

The renderer accesses items through a narrow preload bridge and IPC. Context isolation and sandboxing are enabled, and Node integration is disabled.

Built from the official Electron Forge Vite + TypeScript template.

## License

MIT © Klyve
