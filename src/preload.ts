import { clipboard, contextBridge, ipcRenderer } from 'electron';
import type { NotebookAPI } from './items';

const notebook: NotebookAPI = {
  list: () => ipcRenderer.invoke('items:list'),
  save: (draft) => ipcRenderer.invoke('items:save', draft),
  remove: (id) => ipcRenderer.invoke('items:remove', id),
  export: () => ipcRenderer.invoke('items:export'),
  copyLink: (id) =>
    clipboard.writeText(`pocketnotebook://open?note=${encodeURIComponent(id)}`),
  onOpen: (callback) => {
    ipcRenderer.on('items:open', (_event, id: string) => callback(id));
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('notebook', notebook);
} else {
  window.notebook = notebook;
}
