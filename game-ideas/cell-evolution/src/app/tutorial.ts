import type { Cell, SimulationState } from '../core/types';
import type { MapPick } from '../render/PetriDishRenderer';
import { distance } from '../core/vector';

const TUTORIAL_PROGRESS_KEY = 'cell-evolution-tutorial-progress-v1';

export type TutorialStepId = 'atp' | 'glucose' | 'amino' | 'light' | 'poison' | 'rock' | 'directives';

export type TutorialStep = {
  id: TutorialStepId;
  title: string;
  detail: string;
  goal: string;
};

export const tutorialSteps: TutorialStep[] = [
  {
    id: 'atp',
    title: 'Milestone 1: ATP, glucose, oxygen',
    detail: 'ATP is the cell energy currency. Glucose is fuel. Oxygen makes glucose produce more ATP, but aggressive ATP production also creates ROS waste.',
    goal: 'Select the cell, raise ATP production rate to at least 75%, and reach 92 ATP.',
  },
  {
    id: 'glucose',
    title: 'Milestone 2: harvest glucose',
    detail: 'Glucose molecules are yellow board markers. Fuel uptake controls how fast the membrane imports glucose when the cell touches it.',
    goal: 'Harvest the dropped glucose until cell glucose reaches 45.',
  },
  {
    id: 'amino',
    title: 'Milestone 3: harvest amino acids',
    detail: 'Amino acids are green protein material. They repair damage, support receptors, and let cells grow or divide later.',
    goal: 'Harvest the dropped amino-acid cluster until amino acids reach 45.',
  },
  {
    id: 'light',
    title: 'Milestone 4: use light',
    detail: 'Light blooms are environmental energy fields. Sitting in light gives a light intake factor that slowly supports glucose and oxygen.',
    goal: 'Move into the light bloom and get light intake above 0.20.',
  },
  {
    id: 'poison',
    title: 'Milestone 5: avoid poison',
    detail: 'Poison damages health, drains ATP, and raises ROS. Caution DNA strengthens avoidance and makes the cell react sooner.',
    goal: 'Add Caution DNA and keep the cell outside the poison cloud.',
  },
  {
    id: 'rock',
    title: 'Milestone 6: avoid rock',
    detail: 'Rocks are mineral blocks. They cannot be harvested, and cells must route around them instead of overlapping them.',
    goal: 'Add Motility DNA and keep the cell clear of the rock.',
  },
  {
    id: 'directives',
    title: 'Milestone 7: read directives',
    detail: 'Directives summarize what a selected cell is trying to do based on internal state, nearby signals, DNA, and transport settings.',
    goal: 'Spawn neighbors, select a cell, then add any DNA directive.',
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
    return cell.oxygenMetabolism >= 0.75 && cell.atp >= 92;
  }
  if (step.id === 'glucose') {
    return cell.glucose >= 45;
  }
  if (step.id === 'amino') {
    return cell.aminoAcids >= 45;
  }
  if (step.id === 'light') {
    return cell.lightFactor > 0.2;
  }
  if (step.id === 'poison') {
    const hazard = state.hazards[0];
    return Boolean(hazard)
      && cell.genome.caution > 0.55
      && distance(cell.position, hazard.position) > cell.radius + hazard.radius + 1;
  }
  if (step.id === 'rock') {
    const block = state.blocks[0];
    return Boolean(block)
      && cell.genome.motility > 0.55
      && distance(cell.position, block.position) > cell.radius + block.radius + 1;
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
