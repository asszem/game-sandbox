import type { DishManager } from './dish-manager';
import type { DishInstance } from './dish-types';
import { offsetTutorialPoint, prepareTutorialScenario } from './tutorial-scenarios';
import {
  isTutorialStepComplete,
  readCompletedTutorialMilestones,
  tutorialSteps,
  updateTutorialPanel,
  writeCompletedTutorialMilestones,
  type TutorialStepId,
} from './tutorial';
import { createTutorialDish, spawnTutorialResource, tutorialCell } from './tutorial-world';
import type { TutorialSaveData, RestoredTutorialState } from './save-load';
import type { MapPick } from '../render/types';
import { clamp } from '../core/vector';

type TutorialElements = {
  window: HTMLElement | null;
  title: HTMLElement | null;
  progress: HTMLElement | null;
  stepTitle: HTMLElement | null;
  stepDetail: HTMLElement | null;
  goal: HTMLElement | null;
  next: HTMLButtonElement | null;
};

export function createTutorialController(context: {
  elements: TutorialElements;
  dishManager: DishManager;
  dropController: { cancel: () => void };
  dnaButtons: NodeListOf<HTMLButtonElement>;
  getActiveDish: () => DishInstance | null;
  getInspectedTarget: () => MapPick;
  setActiveDish: (dish: DishInstance, target: MapPick) => void;
  updateHud: () => void;
  showToast: (message: string) => void;
}): {
  isMode: () => boolean;
  canAdvance: () => boolean;
  start: () => void;
  exit: () => void;
  advance: () => void;
  goToStep: (stepIndex: number, rebuildWorld: boolean) => void;
  enterStep: () => void;
  updateProgress: () => void;
  updatePanel: () => void;
  exportState: () => TutorialSaveData<TutorialStepId>;
  restore: (state: RestoredTutorialState<TutorialStepId>) => void;
  stepCount: () => number;
  completed: () => Set<TutorialStepId>;
} {
  let mode = false;
  let stepIndex = 0;
  let enteredStep: TutorialStepId | null = null;
  let goalMet = false;
  let completed = readCompletedTutorialMilestones();
  let preparedSteps = new Set<TutorialStepId>();

  const createWorld = (): void => {
    context.dropController.cancel();
    preparedSteps = new Set<TutorialStepId>();
    const { dish, target } = createTutorialDish(context.dishManager, window.innerWidth, window.innerHeight);
    context.setActiveDish(dish, target);
    dish.renderer.resetZoom();
    context.updateHud();
  };

  const activeCell = () => tutorialCell(context.getActiveDish());

  const enterStep = (): void => {
    const step = tutorialSteps[stepIndex];
    if (!mode || enteredStep === step.id) {
      return;
    }
    enteredStep = step.id;
    const cell = activeCell();
    const activeDish = context.getActiveDish();
    if (!activeDish || !cell) {
      return;
    }

    const shouldPrepareStep = !preparedSteps.has(step.id);
    activeDish.simulation.state.running = true;
    activeDish.accumulator = 0;
    context.setActiveDish(activeDish, { kind: 'cell', id: cell.id });
    if (!shouldPrepareStep) {
      return;
    }
    preparedSteps.add(step.id);

    prepareTutorialScenario(step, {
      cell,
      spawnResource: (kind, position, message) => spawnTutorialResource(activeDish.simulation, kind, position, message, context.showToast),
      spawnHazard: (position, potency) => activeDish.simulation.spawnHazard(position, potency),
      spawnBlock: (position, width, height) => activeDish.simulation.spawnBlock(position, width, height),
      spawnCell: (position, generation) => activeDish.simulation.spawnCell(position, generation),
      offsetPoint: (origin, dx, dy) => offsetTutorialPoint(activeDish.simulation.state.boardRadius, origin, dx, dy),
      showToast: context.showToast,
    });
  };

  const updatePanel = (): void => {
    if (!context.elements.window || !mode) {
      return;
    }
    updateTutorialPanel({
      elements: context.elements,
      stepIndex,
      goalMet,
      completed,
      onJump: (index) => goToStep(index, false),
    });
  };

  const goToStep = (nextStepIndex: number, rebuildWorld: boolean): void => {
    stepIndex = clamp(nextStepIndex, 0, tutorialSteps.length - 1);
    goalMet = false;
    enteredStep = null;
    context.dnaButtons.forEach((button) => {
      delete button.dataset.tutorialUsed;
    });
    if (rebuildWorld || !context.getActiveDish()) {
      createWorld();
    }
    enterStep();
    updatePanel();
  };

  const updateProgress = (): void => {
    if (!mode) {
      return;
    }
    enterStep();
    const step = tutorialSteps[stepIndex];
    const complete = isTutorialStepComplete({
      step,
      cell: activeCell(),
      state: context.getActiveDish()?.simulation.state ?? null,
      inspectedTarget: context.getInspectedTarget(),
      dnaButtons: context.dnaButtons,
    });
    if (complete && !goalMet) {
      goalMet = true;
      completed.add(step.id);
      writeCompletedTutorialMilestones(completed);
      context.showToast(`${step.title} complete`);
    }
    updatePanel();
  };

  return {
    isMode: () => mode,
    canAdvance: () => goalMet,
    start: () => {
      mode = true;
      if (context.elements.window) {
        context.elements.window.hidden = false;
      }
      preparedSteps = new Set<TutorialStepId>();
      goToStep(0, true);
      context.showToast('Tutorial started');
    },
    exit: () => {
      mode = false;
      enteredStep = null;
      goalMet = false;
      if (context.elements.window) {
        context.elements.window.hidden = true;
      }
      updatePanel();
      context.showToast('Tutorial closed');
    },
    advance: () => goToStep(Math.min(stepIndex + 1, tutorialSteps.length - 1), false),
    goToStep,
    enterStep,
    updateProgress,
    updatePanel,
    exportState: () => ({
      mode,
      stepIndex,
      goalMet,
      completed: [...completed],
      prepared: [...preparedSteps],
    }),
    restore: (state) => {
      mode = state.mode;
      stepIndex = state.stepIndex;
      goalMet = state.goalMet;
      completed = state.completed;
      preparedSteps = state.prepared;
      enteredStep = null;
      if (context.elements.window) {
        context.elements.window.hidden = !mode;
      }
    },
    stepCount: () => tutorialSteps.length,
    completed: () => completed,
  };
}
