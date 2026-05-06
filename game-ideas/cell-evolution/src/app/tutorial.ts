import type { Cell, SimulationState } from '../core/types';
import type { MapPick } from '../render/types';

const TUTORIAL_PROGRESS_KEY = 'cell-evolution-tutorial-progress-v1';

export type TutorialStepId = 'atp' | 'glucose';

export type TutorialStep = {
  id: TutorialStepId;
  title: string;
  detail: string;
  goal: string;
};

export const tutorialSteps: TutorialStep[] = [
  {
    id: 'atp',
    title: 'Milestone 1: glucose makes ATP',
    detail: 'Complexity 1 uses one metabolism loop: environmental glucose enters the glucose hub, glycolysis converts it, and ATP becomes the cell energy reserve.',
    goal: 'Select the cell and watch glucose feed glycolysis until ATP reaches 88.',
  },
  {
    id: 'glucose',
    title: 'Milestone 2: harvest glucose',
    detail: 'Glucose molecules are the only environmental resource in complexity 1. Touch glucose to refill the input that feeds the hub.',
    goal: 'Harvest the dropped glucose until the glucose hub reaches 45.',
  },
];

export type TutorialPanelElements = {
  title: HTMLElement | null;
  progress: HTMLElement | null;
  stepTitle: HTMLElement | null;
  stepDetail: HTMLElement | null;
  goal: HTMLElement | null;
  next: HTMLButtonElement | null;
};

export function isTutorialStepComplete(context: {
  step: TutorialStep;
  cell: Cell | null;
  state: SimulationState | null;
  inspectedTarget: MapPick;
  dnaButtons: NodeListOf<HTMLButtonElement>;
}): boolean {
  const { step, cell, state, inspectedTarget, dnaButtons } = context;
  if (!cell || !state) {
    return false;
  }
  if (step.id === 'atp') {
    return cell.atp >= 88;
  }
  if (step.id === 'glucose') {
    return cell.glucose + cell.glucose6Phosphate >= 45;
  }
  return inspectedTarget.kind === 'cell' && Array.from(dnaButtons).some((button) => button.dataset.tutorialUsed === 'true');
}

export function updateTutorialPanel(context: {
  elements: TutorialPanelElements;
  stepIndex: number;
  goalMet: boolean;
  completed: Set<TutorialStepId>;
  onJump: (index: number) => void;
}): void {
  const { elements, stepIndex, goalMet, completed, onJump } = context;
  const step = tutorialSteps[stepIndex];
  if (elements.title) {
    elements.title.textContent = `Tutorial | ${stepIndex + 1}/${tutorialSteps.length}`;
  }
  if (elements.stepTitle) {
    elements.stepTitle.textContent = step.title;
  }
  if (elements.stepDetail) {
    elements.stepDetail.textContent = step.detail;
  }
  if (elements.goal) {
    elements.goal.textContent = `${goalMet ? 'Complete' : 'Goal'}: ${step.goal}`;
    elements.goal.dataset.state = goalMet ? 'complete' : 'active';
  }
  if (elements.next) {
    elements.next.disabled = !goalMet || stepIndex >= tutorialSteps.length - 1;
    elements.next.textContent = stepIndex >= tutorialSteps.length - 1 ? 'Done' : 'Next';
  }
  renderTutorialMilestones(elements.progress, stepIndex, completed, onJump);
}

export function readCompletedTutorialMilestones(): Set<TutorialStepId> {
  try {
    const parsed = JSON.parse(localStorage.getItem(TUTORIAL_PROGRESS_KEY) ?? '[]') as TutorialStepId[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

export function writeCompletedTutorialMilestones(completed: Set<TutorialStepId>): void {
  localStorage.setItem(TUTORIAL_PROGRESS_KEY, JSON.stringify([...completed]));
}

function renderTutorialMilestones(
  progress: HTMLElement | null,
  stepIndex: number,
  completed: Set<TutorialStepId>,
  onJump: (index: number) => void,
): void {
  if (!progress) {
    return;
  }
  progress.textContent = '';
  tutorialSteps.forEach((step, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(index + 1);
    button.title = step.title;
    button.className = index === stepIndex
      ? 'is-current'
      : index < stepIndex && completed.has(step.id)
        ? 'is-complete'
        : '';
    button.disabled = index !== stepIndex && !completed.has(step.id);
    button.addEventListener('click', () => {
      if (!button.disabled) {
        onJump(index);
      }
    });
    progress.appendChild(button);
  });
}
