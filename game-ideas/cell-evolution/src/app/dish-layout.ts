import { clamp } from '../core/vector';

export const MIN_DISH_SIZE = 320;
export const MAX_DISH_SIZE = 1000;

export type DishPlacement = {
  left: number;
  top: number;
};

export function defaultDishSize(viewportWidth: number, minSize = 400): number {
  return Math.min(560, Math.max(minSize, Math.round(viewportWidth * 0.32)));
}

export function defaultDishPlacements(size: number, viewportWidth: number, viewportHeight: number): DishPlacement[] {
  return [
    { left: viewportWidth - size - 46, top: Math.max(120, viewportHeight - size - 24) },
    { left: Math.max(430, viewportWidth - size * 1.7), top: Math.max(130, viewportHeight - size - 84) },
  ];
}

export function addedDishPlacement(count: number, size: number, viewportWidth: number, viewportHeight: number): DishPlacement {
  const offset = (count % 5) * 34;
  return {
    left: clamp(viewportWidth - size - 64 - offset, 24, Math.max(24, viewportWidth - size - 24)),
    top: clamp(viewportHeight - size - 40 - offset, 88, Math.max(88, viewportHeight - size - 24)),
  };
}

export function tutorialDishPlacement(count: number, size: number, viewportWidth: number, viewportHeight: number): DishPlacement {
  const offset = (count % 5) * 34;
  const leftPanelEdge = Math.min(540, viewportWidth * 0.28);
  const rightPanelEdge = viewportWidth >= 1500 ? viewportWidth - 410 : viewportWidth - 24;
  const availableLeft = Math.min(Math.max(24, leftPanelEdge + 300), Math.max(24, viewportWidth - size - 24));
  const availableRight = Math.max(availableLeft, rightPanelEdge - size);
  return {
    left: clamp((availableLeft + availableRight) / 2 + offset, 24, Math.max(24, viewportWidth - size - 24)),
    top: clamp(viewportHeight - size - 26 + offset, 88, Math.max(88, viewportHeight - size - 24)),
  };
}

export function updateFloatingDishLabel(label: HTMLElement, canvas: HTMLCanvasElement, name: string, zIndex: number, dishNumber: number): void {
  const rect = canvas.getBoundingClientRect();
  label.textContent = `#${dishNumber} ${name}`;
  label.style.left = `${rect.left + rect.width / 2}px`;
  label.style.top = `${Math.max(10, rect.top - 15)}px`;
  label.style.zIndex = String(zIndex + 1);
}

export function resizeDishCanvas(canvas: HTMLCanvasElement, factor: number): boolean {
  const rect = canvas.getBoundingClientRect();
  const nextSize = clamp(rect.width * factor, MIN_DISH_SIZE, MAX_DISH_SIZE);
  if (Math.abs(nextSize - rect.width) < 0.5) {
    return false;
  }
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  canvas.style.width = `${nextSize}px`;
  canvas.style.height = `${nextSize}px`;
  canvas.style.left = `${centerX - nextSize / 2}px`;
  canvas.style.top = `${centerY - nextSize / 2}px`;
  return true;
}
