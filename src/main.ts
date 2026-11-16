import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { readItems, removeItem, saveItem } from './storage';
import type { ItemDraft } from './items';

if (started) app.quit();

let mainWindow: BrowserWindow | undefined;
let pendingLink = process.argv.find((arg) =>
  arg.startsWith('pocketnotebook://'),
);

async function openNoteLink(url: string) {
  if (!app.isReady()) {
    pendingLink = url;
    return;
  }
  const id = new URL(url).searchParams.get('note');
  if (!id) {
    await shell.openExternal(url);
    return;
  }
  const window = mainWindow ?? createWindow();
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  const select = () => window.webContents.send('items:open', id);
  if (window.webContents.isLoading()) {
    window.webContents.once('did-finish-load', select);
  } else {
    select();
  }
}

function receiveLink(url: string) {
  void openNoteLink(url).catch((error: Error) => {
    dialog.showErrorBox('Unable to open link', error.message);
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
app.on('open-url', (event, url) => {
  event.preventDefault();
  receiveLink(url);
});
app.on('second-instance', (_event, argv) => {
  const url = argv.find((arg) => arg.includes('://'));
  if (url) receiveLink(url);
  else mainWindow?.focus();
});

function createWindow() {
  const window = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 640,
    minHeight: 500,
    title: 'Pocket Notebook',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
    },
  });
  mainWindow = window;
  window.on('closed', () => {
    mainWindow = undefined;
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
  return window;
}

app.whenReady().then(() => {
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient('pocketnotebook', process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  } else {
    app.setAsDefaultProtocolClient('pocketnotebook');
  }
  const file = path.join(app.getPath('userData'), 'items.json');
  // Serialize file operations so overlapping requests cannot lose edits.
  let pending: Promise<unknown> = Promise.resolve();
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.catch(() => undefined);
    return result;
  }
  ipcMain.handle('items:list', () => enqueue(() => readItems(file)));
  ipcMain.handle('items:save', (_event, draft: ItemDraft) =>
    enqueue(() => saveItem(file, draft)),
  );
  ipcMain.handle('items:remove', (_event, id: string) =>
    enqueue(() => removeItem(file, id)),
  );
  ipcMain.handle('items:export', () =>
    enqueue(async () => {
      const items = await readItems(file);
      const directory = path.join(path.dirname(app.getPath('exe')), 'exports');
      await mkdir(directory, { recursive: true });
      const destination = path.join(directory, `notebook-${Date.now()}.json`);
      await writeFile(destination, JSON.stringify(items, null, 2), {
        encoding: 'utf8',
        mode: 0o600,
      });
      return destination;
    }),
  );
  createWindow();
  if (pendingLink) {
    receiveLink(pendingLink);
    pendingLink = undefined;
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
