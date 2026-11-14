import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readItems, removeItem, saveItem } from '../src/storage';

let directory: string;
let file: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'pocket-notebook-'));
  file = path.join(directory, 'data', 'items.json');
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('local notebook storage', () => {
  it('opens a missing notebook as an empty collection', async () => {
    expect(await readItems(file)).toEqual([]);
  });

  it('creates, reloads, updates, and removes an item without losing other items', async () => {
    const first = await saveItem(file, {
      title: '  First note  ',
      body: 'Line one\nLine two',
    });
    const second = await saveItem(file, { title: 'Another note', body: '' });
    expect(first.title).toBe('First note');
    expect(Number.isFinite(Date.parse(first.updatedAt))).toBe(true);
    const updated = await saveItem(file, {
      id: first.id,
      title: 'Revised note',
      body: 'New body',
    });
    expect(updated.id).toBe(first.id);
    expect(await readItems(file)).toEqual(
      expect.arrayContaining([updated, second]),
    );
    expect(JSON.parse(await readFile(file, 'utf8'))).toHaveLength(2);
    await removeItem(file, first.id);
    expect(await readItems(file)).toEqual([second]);
  });

  it('orders loaded items by most recent update', async () => {
    await saveItem(file, { title: 'Seed', body: '' });
    const older = {
      id: 'old',
      title: 'Old',
      body: '',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const newer = {
      ...older,
      id: 'new',
      title: 'New',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    await writeFile(file, JSON.stringify([older, newer]));
    expect((await readItems(file)).map((item) => item.id)).toEqual([
      'new',
      'old',
    ]);
  });

  it('rejects invalid edits and unknown IDs without changing saved data', async () => {
    await saveItem(file, { title: 'Keep me', body: 'Original' });
    const original = await readFile(file, 'utf8');
    await expect(saveItem(file, { title: '  ', body: '' })).rejects.toThrow();
    await expect(
      saveItem(file, { title: 'x'.repeat(121), body: '' }),
    ).rejects.toThrow();
    await expect(
      saveItem(file, { id: 'missing', title: 'Unknown', body: '' }),
    ).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe(original);
  });

  it.each(['{broken', '[{"id":"incomplete"}]'])(
    'preserves unreadable data: %s',
    async (content) => {
      await saveItem(file, { title: 'Seed', body: '' });
      await writeFile(file, content);
      await expect(readItems(file)).rejects.toThrow();
      await expect(
        saveItem(file, { title: 'New', body: '' }),
      ).rejects.toThrow();
      expect(await readFile(file, 'utf8')).toBe(content);
    },
  );
});
