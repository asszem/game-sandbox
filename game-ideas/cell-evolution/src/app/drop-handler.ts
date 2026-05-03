import { distance } from '../core/vector';
import type { DropItemKind } from './drop-tools';
import type { DishInstance } from './dish-types';

export function handleDishItemDrop(
  dishes: DishInstance[],
  kind: DropItemKind,
  clientX: number,
  clientY: number,
  showToast: (message: string) => void,
): boolean {
  const targetDish = dishAtPoint(dishes, clientX, clientY);
  if (!targetDish) {
    showToast('Drop inside a petri dish');
    return false;
  }
  const position = targetDish.renderer.screenToWorld(clientX, clientY);
  const insideDish = distance(position, { x: 0, y: 0 }) <= targetDish.simulation.state.boardRadius - 2;
  if (!insideDish) {
    showToast('Drop inside the petri dish');
    return false;
  }

  if (kind === 'cotton-candy') {
    targetDish.simulation.dropCottonCandy(position);
    showToast('Cotton candy dissolved into glucose');
  } else {
    targetDish.simulation.dropCatPawn(position);
    showToast('Cat-pawn dissolved into poison');
  }
  return true;
}

export function dishAtPoint(dishes: DishInstance[], clientX: number, clientY: number): DishInstance | null {
  return [...dishes]
    .sort((left, right) => right.zIndex - left.zIndex)
    .find((dish) => {
      const rect = dish.canvas.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    }) ?? null;
}
