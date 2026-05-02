import type { Vec2 } from './types';

export const vec = (x = 0, y = 0): Vec2 => ({ x, y });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

export const scale = (a: Vec2, factor: number): Vec2 => ({ x: a.x * factor, y: a.y * factor });

export const length = (a: Vec2): number => Math.hypot(a.x, a.y);

export const normalize = (a: Vec2): Vec2 => {
  const len = length(a);
  return len > 0.0001 ? scale(a, 1 / len) : vec();
};

export const distance = (a: Vec2, b: Vec2): number => length(sub(a, b));

export const clampLength = (a: Vec2, max: number): Vec2 => {
  const len = length(a);
  return len > max ? scale(a, max / len) : a;
};

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
