import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { readItems, removeItem, saveItem } from './storage';
import { loadWindowState, saveWindowState } from './windowState';
import type { ItemDraft } from './items';

if (started) app.quit();

function createWindow() {
  const stateFile = path.join(app.getPath('userData'), 'window-state.json');
  const savedState = loadWindowState(stateFile);
  const bounds = savedState
    ? {
        x: savedState.x,
        y: savedState.y,
        width: savedState.width,
        height: savedState.height,
      }
    : { width: 960, height: 720 };
  const window = new BrowserWindow({
    ...bounds,
    minWidth: 640,
    minHeight: 500,
    title: 'Pocket Notebook',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (savedState?.maximized) window.maximize();
  window.on('close', () => {
    try {
      saveWindowState(stateFile, {
        ...window.getNormalBounds(),
        maximized: window.isMaximized(),
      });
    } catch (error) {
      console.error('Could not save window state:', error);
    }
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
}

app.whenReady().then(() => {
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
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
