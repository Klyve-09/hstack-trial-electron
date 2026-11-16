import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

export function loadWindowState(file: string): WindowState | null {
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!value || typeof value !== 'object') return null;
    const state = value as WindowState;
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
