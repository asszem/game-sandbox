import type { DishManager } from './dish-manager';
import type { DishInstance } from './dish-types';
import { restoreTutorialState, savedDishesFromPayload, type RestoredTutorialState, type SaveData } from './save-load';

export function applySavedWorld<TStep extends string>(payload: SaveData<TStep>, context: {
  dishManager: DishManager;
  dishes: DishInstance[];
  viewportWidth: number;
  viewportHeight: number;
  tutorialStepCount: number;
  tutorialCompleted: Set<TStep>;
}): {
  activeDish: DishInstance | null;
  tutorial: RestoredTutorialState<TStep>;
} | null {
  if (payload.version !== 1 && payload.version !== 2) {
    return null;
  }

  context.dishManager.clearDishes();
  for (const savedDish of savedDishesFromPayload(payload, context.viewportWidth, context.viewportHeight)) {
    context.dishManager.createDish({
      id: savedDish.id,
      name: savedDish.name,
      state: savedDish.state,
      inspectedTarget: savedDish.inspectedTarget,
      view: savedDish.view,
      left: savedDish.left,
      top: savedDish.top,
      size: savedDish.size,
      zIndex: savedDish.zIndex,
      select: false,
    });
  }

  return {
    activeDish: context.dishes.find((dish) => dish.id === payload.activeDishId) ?? null,
    tutorial: restoreTutorialState(payload, context.tutorialStepCount, context.tutorialCompleted),
  };
}
