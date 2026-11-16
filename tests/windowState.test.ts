import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadWindowState, saveWindowState } from '../src/windowState';

let directory: string;
let file: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'pocket-window-state-'));
  file = path.join(directory, 'data', 'window-state.json');
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('local window state', () => {
  it('uses defaults when the state file is missing', () => {
    expect(loadWindowState(file)).toBeNull();
  });

  it.each([
    '{broken',
    'null',
    '[]',
    '{}',
    '{"x":0,"y":0,"width":0,"height":720,"maximized":false}',
    '{"x":0,"y":0,"width":960,"height":-1,"maximized":false}',
    '{"x":0.5,"y":0,"width":960,"height":720,"maximized":false}',
    '{"x":0,"y":1e400,"width":960,"height":720,"maximized":false}',
    '{"x":"0","y":0,"width":960,"height":720,"maximized":false}',
    '{"x":0,"y":0,"width":960.5,"height":720,"maximized":false}',
    '{"x":0,"y":0,"width":960,"height":720.5,"maximized":false}',
    '{"x":0,"y":0,"width":960,"height":720,"maximized":"true"}',
  ])('uses defaults for corrupt or invalid state: %s', async (content) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
    expect(loadWindowState(file)).toBeNull();
  });

  it('saves and reloads normal bounds and maximized state', () => {
    const state = { x: -960, y: -40, width: 960, height: 720, maximized: true };
    saveWindowState(file, state);
    expect(loadWindowState(file)).toEqual(state);
    const resized = {
      x: 120,
      y: 80,
      width: 800,
      height: 600,
      maximized: false,
    };
    saveWindowState(file, resized);
    expect(loadWindowState(file)).toEqual(resized);
  });
});
