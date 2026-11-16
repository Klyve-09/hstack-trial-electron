import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  correctWindowBounds,
  loadWindowState,
  saveWindowState,
} from '../src/windowState';

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

describe('window bounds correction', () => {
  const primary = { x: 100, y: 40, width: 1200, height: 900 };
  const secondary = { x: -1600, y: -200, width: 1600, height: 1000 };
  const workAreas = [primary, secondary];

  it.each([
    { x: 200, y: 100, width: 800, height: 600 },
    { x: -1400, y: -100, width: 800, height: 600 },
    { x: 1200, y: 924, width: 800, height: 600 },
  ])('keeps visible bounds unchanged: %j', (bounds) => {
    expect(correctWindowBounds(bounds, workAreas, primary)).toEqual(bounds);
  });

  it('moves a window whose title strip is above every work area', () => {
    const bounds = { x: 200, y: 0, width: 800, height: 600 };
    expect(correctWindowBounds(bounds, workAreas, primary)).toEqual({
      x: 300,
      y: 190,
      width: 800,
      height: 600,
    });
  });

  it('moves a window with only a one-pixel corner visible', () => {
    const bounds = { x: 1299, y: 939, width: 800, height: 600 };
    expect(correctWindowBounds(bounds, workAreas, primary)).toEqual({
      x: 300,
      y: 190,
      width: 800,
      height: 600,
    });
  });

  it('centers bounds outside every display on the primary work area', () => {
    const bounds = { x: 3000, y: -2000, width: 801, height: 601 };
    expect(correctWindowBounds(bounds, workAreas, primary)).toEqual({
      x: 299,
      y: 189,
      width: 801,
      height: 601,
    });
  });

  it('clamps oversized off-screen bounds to the primary work area', () => {
    const bounds = { x: 3000, y: 2000, width: 2000, height: 1200 };
    expect(correctWindowBounds(bounds, workAreas, primary)).toEqual(primary);
  });

  it.each([
    { x: 1300, y: 100, width: 800, height: 600 },
    { x: 200, y: 940, width: 800, height: 600 },
    { x: -700, y: 40, width: 800, height: 600 },
    { x: 100, y: -560, width: 800, height: 600 },
  ])(
    'treats bounds touching only a display edge as off-screen: %j',
    (bounds) => {
      expect(correctWindowBounds(bounds, [primary], primary)).toEqual({
        x: 300,
        y: 190,
        width: 800,
        height: 600,
      });
    },
  );
});
