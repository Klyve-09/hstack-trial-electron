import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

type WindowBounds = Pick<WindowState, 'x' | 'y' | 'width' | 'height'>;

const TITLE_STRIP_HEIGHT = 32;
const MIN_VISIBLE_WIDTH = 100;
const MIN_VISIBLE_HEIGHT = 16;

export function correctWindowBounds(
  bounds: WindowBounds,
  workAreas: WindowBounds[],
  primaryWorkArea: WindowBounds,
): WindowBounds {
  const visible = workAreas.some(
    (area) =>
      Math.min(bounds.x + bounds.width, area.x + area.width) -
        Math.max(bounds.x, area.x) >=
        Math.min(MIN_VISIBLE_WIDTH, bounds.width) &&
      Math.min(
        bounds.y + Math.min(TITLE_STRIP_HEIGHT, bounds.height),
        area.y + area.height,
      ) -
        Math.max(bounds.y, area.y) >=
        Math.min(MIN_VISIBLE_HEIGHT, bounds.height),
  );
  if (visible) return bounds;

  const width = Math.min(bounds.width, primaryWorkArea.width);
  const height = Math.min(bounds.height, primaryWorkArea.height);
  return {
    x: primaryWorkArea.x + Math.floor((primaryWorkArea.width - width) / 2),
    y: primaryWorkArea.y + Math.floor((primaryWorkArea.height - height) / 2),
    width,
    height,
  };
}

export function loadWindowState(file: string): WindowState | null {
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!value || typeof value !== 'object') return null;
    const state = value as WindowState;
    // Electron Rectangle coordinates and dimensions are Integer: https://www.electronjs.org/docs/latest/api/structures/rectangle
    if (
      !Number.isInteger(state.x) ||
      !Number.isInteger(state.y) ||
      !Number.isInteger(state.width) ||
      state.width <= 0 ||
      !Number.isInteger(state.height) ||
      state.height <= 0 ||
      typeof state.maximized !== 'boolean'
    ) {
      return null;
    }
    return {
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
      maximized: state.maximized,
    };
  } catch {
    return null;
  }
}

export function saveWindowState(file: string, state: WindowState): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, JSON.stringify(state, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
  renameSync(temporary, file);
}
