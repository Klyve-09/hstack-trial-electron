import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Item, ItemDraft } from './items';

function isItem(value: unknown): value is Item {
  if (!value || typeof value !== 'object') return false;
  const item = value as Item;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.body === 'string' &&
    typeof item.updatedAt === 'string' &&
    Number.isFinite(Date.parse(item.updatedAt))
  );
}

export async function readItems(file: string): Promise<Item[]> {
  let content: string;
  try {
    content = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const items: unknown = JSON.parse(content);
  if (!Array.isArray(items) || !items.every(isItem)) {
    throw new Error('The notebook file contains invalid items.');
  }
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function writeItems(file: string, items: Item[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(items, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporary, file);
}

export async function saveItem(file: string, draft: ItemDraft): Promise<Item> {
  if (
    !draft ||
    typeof draft.title !== 'string' ||
    typeof draft.body !== 'string' ||
    (draft.id !== undefined && typeof draft.id !== 'string') ||
    !draft.title.trim() ||
    draft.title.trim().length > 120 ||
    draft.body.length > 100000
  ) {
    throw new Error('Enter a title of 1–120 characters and a shorter body.');
  }
  const items = await readItems(file);
  const index = draft.id ? items.findIndex((item) => item.id === draft.id) : -1;
  if (draft.id && index === -1) throw new Error('This item no longer exists.');
  const item: Item = {
    id: draft.id ?? randomUUID(),
    title: draft.title.trim(),
    body: draft.body,
    updatedAt: new Date().toISOString(),
  };
  if (index === -1) items.push(item);
  else items[index] = item;
  await writeItems(file, items);
  return item;
}

export async function removeItem(file: string, id: string): Promise<void> {
  if (typeof id !== 'string') throw new Error('Invalid item ID.');
  const items = await readItems(file);
  await writeItems(
    file,
    items.filter((item) => item.id !== id),
  );
}
