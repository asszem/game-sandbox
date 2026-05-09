import { MAX_DISH_COUNT, type DishManager } from './dish-manager';
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

type HelperStep = {
  target: string;
  title: string;
  detail: string;
};

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
  canRunSimulation: () => boolean;
  start: () => void;
  restart: () => void;
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
  let helperIndex = 0;
  let helperComplete = false;
  let helperBound = false;
  const helperSteps: HelperStep[] = [
    { target: 'metabolism-title', title: 'Metabolism', detail: 'This section shows the cell engine. At the start there is no glucose, so glycolysis cannot run and ATP only leaks through upkeep.' },
    { target: 'glucose-input', title: 'Glucose Input', detail: 'Outside input shows glucose entering from the environment. Step 1 starts with no external glucose, so this remains zero.' },
    { target: 'glucose-pool', title: 'Glucose Pool', detail: 'The pool is the fuel available for glycolysis. Empty pool means the ATP engine cannot refill itself.' },
    { target: 'glycolysis', title: 'Glycolysis Process', detail: 'Glycolysis spends activation ATP to break glucose and then returns more ATP. With an empty pool, the process is stopped.' },
    { target: 'atp-pool', title: 'ATP Pool', detail: 'ATP is the spendable energy reserve. If it reaches 0 in this beginner state, the cell dies.' },
    { target: 'cell-health-title', title: 'Cell Health', detail: 'Cell Health summarizes whether the cell can keep its membrane alive while paying ongoing upkeep.' },
    { target: 'health-factors', title: 'Influencing Factors', detail: 'For now, the visible factor is cell upkeep: the constant ATP cost of simply existing.' },
    { target: 'health-current', title: 'Current Health', detail: 'Current health and its delta show whether the cell is stable. Once this guide is done, press Space to start time.' },
  ];

  const createWorld = (): void => {
    context.dropController.cancel();
    preparedSteps = new Set<TutorialStepId>();
    const { dish } = createTutorialDish(context.dishManager, window.innerWidth, window.innerHeight);
    context.setActiveDish(dish, { kind: 'dish', id: null });
    dish.renderer.resetZoom();
    context.updateHud();
  };

  const restartTutorial = (): void => {
    const previousDish = context.getActiveDish();
    if (previousDish) {
      context.dishManager.deleteDish(previousDish);
    }
    mode = true;
    if (context.elements.window) {
      context.elements.window.hidden = false;
    }
    stepIndex = 0;
    goalMet = false;
    enteredStep = null;
    helperIndex = 0;
    helperComplete = false;
    clearHighlight();
    helperWindow()?.setAttribute('hidden', '');
    pointer()?.setAttribute('hidden', '');
    document.querySelector('.metabolic-dashboard')?.removeAttribute('data-tutorial-focus');
    goToStep(0, true);
    context.showToast('Tutorial restarted');
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
    activeDish.simulation.state.running = step.id === 'atp' ? false : true;
    activeDish.accumulator = 0;
    if (step.id !== 'atp') {
      context.setActiveDish(activeDish, { kind: 'cell', id: cell.id });
    }
    if (!shouldPrepareStep) {
      return;
    }
    preparedSteps.add(step.id);

    prepareTutorialScenario(step, {
      cell,
      spawnResource: (kind, position, message) => spawnTutorialResource(activeDish.simulation, kind, position, message, context.showToast),
      offsetPoint: (origin, dx, dy) => offsetTutorialPoint(activeDish.simulation.state.boardRadius, origin, dx, dy),
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

  const helperWindow = (): HTMLElement | null => document.querySelector('#metabolism-helper-window');
  const helperTitle = (): HTMLElement | null => document.querySelector('#metabolism-helper-title');
  const helperDetail = (): HTMLElement | null => document.querySelector('#metabolism-helper-detail');
  const helperPrev = (): HTMLButtonElement | null => document.querySelector('#metabolism-helper-prev');
  const helperNext = (): HTMLButtonElement | null => document.querySelector('#metabolism-helper-next');
  const helperSkip = (): HTMLButtonElement | null => document.querySelector('#metabolism-helper-skip');
  const pointer = (): HTMLElement | null => document.querySelector('#tutorial-cell-pointer');

  const clearHighlight = (): void => {
    document.querySelectorAll('.is-help-highlight').forEach((element) => {
      element.classList.remove('is-help-highlight');
    });
  };

  const completeHelper = (): void => {
    helperComplete = true;
    helperWindow()?.setAttribute('hidden', '');
    clearHighlight();
    document.querySelector('.metabolic-dashboard')?.removeAttribute('data-tutorial-focus');
    context.showToast('Press Space to start the simulation');
    context.updateHud();
  };

  const bindHelper = (): void => {
    if (helperBound) {
      return;
    }
    helperBound = true;
    helperPrev()?.addEventListener('click', () => {
      helperIndex = Math.max(0, helperIndex - 1);
      syncHelper();
    });
    helperNext()?.addEventListener('click', () => {
      if (helperIndex >= helperSteps.length - 1) {
        completeHelper();
        return;
      }
      helperIndex += 1;
      syncHelper();
    });
    helperSkip()?.addEventListener('click', completeHelper);
  };

  const positionHelper = (helper: HTMLElement): void => {
    const entityWindow = document.querySelector<HTMLElement>('[data-window-id="entity"]');
    if (!entityWindow) {
      return;
    }
    const entityRect = entityWindow.getBoundingClientRect();
    const gap = 12;
    helper.style.width = '';
    let helperRect = helper.getBoundingClientRect();
    const rightWidth = window.innerWidth - entityRect.right - gap - 8;
    if (rightWidth >= 280 && rightWidth < helperRect.width) {
      helper.style.width = `${rightWidth}px`;
      helperRect = helper.getBoundingClientRect();
    }
    const spaceRight = window.innerWidth - entityRect.right - gap;
    const placeRight = spaceRight >= helperRect.width || entityRect.left < helperRect.width + gap + 8;
    const left = placeRight
      ? entityRect.right + gap
      : entityRect.left - helperRect.width - gap;
    helper.style.left = `${clamp(left, 8, Math.max(8, window.innerWidth - helperRect.width - 8))}px`;
    helper.style.right = 'auto';
    helper.style.top = `${clamp(entityRect.top + 236, 8, Math.max(8, window.innerHeight - helperRect.height - 8))}px`;
  };

  const syncHelper = (): void => {
    bindHelper();
    const selected = context.getInspectedTarget().kind === 'cell';
    const helper = helperWindow();
    const dashboard = document.querySelector<HTMLElement>('.metabolic-dashboard');
    if (!mode || stepIndex !== 0 || helperComplete || !selected) {
      helper?.setAttribute('hidden', '');
      if (!selected) {
        dashboard?.removeAttribute('data-tutorial-focus');
        clearHighlight();
      }
      return;
    }
    const step = helperSteps[helperIndex];
    helper?.removeAttribute('hidden');
    if (helper) {
      positionHelper(helper);
    }
    dashboard?.setAttribute('data-tutorial-focus', 'metabolism');
    const title = helperTitle();
    const detail = helperDetail();
    const prev = helperPrev();
    const next = helperNext();
    if (title) title.textContent = step.title;
    if (detail) detail.textContent = step.detail;
    if (prev) prev.disabled = helperIndex === 0;
    if (next) next.textContent = helperIndex >= helperSteps.length - 1 ? 'Done' : 'Next';
    clearHighlight();
    document.querySelector(`[data-help-target="${step.target}"]`)?.classList.add('is-help-highlight');
  };

  const syncPointer = (): void => {
    const marker = pointer();
    const dish = context.getActiveDish();
    const cell = activeCell();
    const selected = context.getInspectedTarget().kind === 'cell';
    if (!marker || !mode || stepIndex !== 0 || !dish || !cell || selected) {
      marker?.setAttribute('hidden', '');
      return;
    }
    const tutorialRect = context.elements.window?.getBoundingClientRect();
    if (!tutorialRect) {
      marker.setAttribute('hidden', '');
      return;
    }
    const { x: targetX, y: targetY } = dish.renderer.worldToScreen(cell.position);
    const startX = targetX > tutorialRect.left + tutorialRect.width / 2 ? tutorialRect.right : tutorialRect.left;
    const startY = tutorialRect.top + tutorialRect.height / 2;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const angle = Math.atan2(dy, dx);
    const label = marker.querySelector<HTMLElement>('span');
    marker.style.left = `${startX}px`;
    marker.style.top = `${startY}px`;
    marker.style.width = `${Math.hypot(dx, dy)}px`;
    marker.style.transform = `rotate(${angle}rad)`;
    if (label) {
      label.style.transform = `rotate(${-angle}rad)`;
    }
    marker.dataset.targetX = `${targetX}`;
    marker.dataset.targetY = `${targetY}`;
    marker.removeAttribute('hidden');
  };

  const syncGuidance = (): void => {
    syncPointer();
    syncHelper();
  };

  const goToStep = (nextStepIndex: number, rebuildWorld: boolean): void => {
    stepIndex = clamp(nextStepIndex, 0, tutorialSteps.length - 1);
    goalMet = false;
    enteredStep = null;
    helperIndex = 0;
    helperComplete = stepIndex !== 0;
    context.dnaButtons.forEach((button) => {
      delete button.dataset.tutorialUsed;
    });
    if (rebuildWorld || !context.getActiveDish()) {
      createWorld();
    }
    enterStep();
    updatePanel();
    syncGuidance();
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
    syncGuidance();
  };

  return {
    isMode: () => mode,
    canAdvance: () => goalMet,
    canRunSimulation: () => !mode || stepIndex !== 0 || helperComplete,
    start: () => {
      if (context.dishManager.dishes.length >= MAX_DISH_COUNT) {
        context.showToast(`Maximum ${MAX_DISH_COUNT} dishes reached`);
        return;
      }
      mode = true;
      if (context.elements.window) {
        context.elements.window.hidden = false;
      }
      preparedSteps = new Set<TutorialStepId>();
      helperIndex = 0;
      helperComplete = false;
      goToStep(0, true);
      context.showToast('Tutorial started');
    },
    restart: restartTutorial,
    exit: () => {
      mode = false;
      enteredStep = null;
      goalMet = false;
      if (context.elements.window) {
        context.elements.window.hidden = true;
      }
      helperComplete = true;
      helperWindow()?.setAttribute('hidden', '');
      pointer()?.setAttribute('hidden', '');
      clearHighlight();
      document.querySelector('.metabolic-dashboard')?.removeAttribute('data-tutorial-focus');
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
