export interface Item {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
}

export interface ItemDraft {
  id?: string;
  title: string;
  body: string;
}

export interface NotebookAPI {
  export: () => Promise<string>;
  copyLink: (id: string) => void;
  onOpen: (callback: (id: string) => void) => void;
  list: () => Promise<Item[]>;
  save: (draft: ItemDraft) => Promise<Item>;
  remove: (id: string) => Promise<void>;
}
