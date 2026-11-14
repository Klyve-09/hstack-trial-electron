import { contextBridge, ipcRenderer } from 'electron';
import type { NotebookAPI } from './items';

const notebook: NotebookAPI = {
  list: () => ipcRenderer.invoke('items:list'),
  save: (draft) => ipcRenderer.invoke('items:save', draft),
  remove: (id) => ipcRenderer.invoke('items:remove', id),
};

contextBridge.exposeInMainWorld('notebook', notebook);
