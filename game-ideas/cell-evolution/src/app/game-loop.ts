import type { DishInstance } from './dish-types';

export function createGameLoop(context: {
  dishes: () => DishInstance[];
  tickMs: number;
  updateTutorialProgress: () => void;
  updateHud: () => void;
}): (time: number) => void {
  let lastTime = performance.now();
  return function animate(time: number): void {
    const delta = Math.min(80, time - lastTime);
    lastTime = time;

    for (const dish of context.dishes()) {
      if (dish.simulation.state.running) {
        dish.worldTime += delta;
        dish.accumulator += delta;
        while (dish.accumulator >= context.tickMs) {
          dish.simulation.step();
          dish.accumulator -= context.tickMs;
        }
      }
      dish.renderer.render(dish.simulation.state, dish.worldTime, dish.simulation.drainEvents(), dish.inspectedTarget);
    }

    context.updateTutorialProgress();
    context.updateHud();
    requestAnimationFrame(animate);
  };
}
