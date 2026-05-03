import type { SimulationState } from '../core/types';
import type { MapPick, RendererView } from '../render/types';
import type { WindowLayout } from '../hud/windows';
import { clamp } from '../core/vector';

const SAVE_SLOT_COUNT = 5;
const SAVE_SLOTS_KEY = 'cell-evolution-save-slots-v1';

export const SAVE_KEY = 'cell-evolution-save-v1';

export type SaveData<TStep extends string = string> = {
  version: 1 | 2;
  savedAt: number;
  simulation?: SimulationState;
  inspectedTarget?: MapPick;
  dishes?: DishSaveData[];
  activeDishId?: number | null;
  tutorial?: TutorialSaveData<TStep>;
  windowLayout: WindowLayout;
  tooltipsEnabled?: boolean;
};

export type TutorialSaveData<TStep extends string = string> = {
  mode: boolean;
  stepIndex: number;
  goalMet: boolean;
  completed: TStep[];
  prepared: TStep[];
};

export type DishSaveData = {
  id: number;
  name?: string;
  state: SimulationState;
  inspectedTarget: MapPick;
  view: RendererView;
  left: number;
  top: number;
  size: number;
  zIndex: number;
};

export type SaveSlot<TStep extends string = string> = {
  name: string;
  savedAt: number | null;
  data: SaveData<TStep> | null;
};

type SaveMode = 'save' | 'load';

type SavePayloadDish = {
  id: number;
  name: string;
  canvas: HTMLCanvasElement;
  simulation: { exportState: () => SimulationState };
  renderer: { exportView: () => RendererView };
  inspectedTarget: MapPick;
  zIndex: number;
};

export type RestoredTutorialState<TStep extends string> = {
  mode: boolean;
  stepIndex: number;
  goalMet: boolean;
  completed: Set<TStep>;
  prepared: Set<TStep>;
};

export function createSavePayload<TStep extends string>(context: {
  dishes: SavePayloadDish[];
  activeDishId: number | null;
  tutorial: TutorialSaveData<TStep>;
  windowLayout: WindowLayout;
  tooltipsEnabled: boolean;
}): SaveData<TStep> {
  return {
    version: 2,
    savedAt: Date.now(),
    dishes: context.dishes.map(exportDish),
    activeDishId: context.activeDishId,
    tutorial: context.tutorial,
    windowLayout: context.windowLayout,
    tooltipsEnabled: context.tooltipsEnabled,
  };
}

export function restoreTutorialState<TStep extends string>(
  payload: SaveData<TStep>,
  stepCount: number,
  fallbackCompleted: Set<TStep>,
): RestoredTutorialState<TStep> {
  return {
    mode: payload.tutorial?.mode ?? false,
    stepIndex: clamp(payload.tutorial?.stepIndex ?? 0, 0, stepCount - 1),
    goalMet: payload.tutorial?.goalMet ?? false,
    completed: new Set(payload.tutorial?.completed ?? [...fallbackCompleted]),
    prepared: new Set(payload.tutorial?.prepared ?? []),
  };
}

export function savedDishesFromPayload<TStep extends string>(
  payload: SaveData<TStep>,
  viewportWidth: number,
  viewportHeight: number,
): DishSaveData[] {
  if (payload.version === 2 && payload.dishes?.length) {
    return payload.dishes;
  }
  if (!payload.simulation) {
    return [];
  }
  return [{
    id: 1,
    state: payload.simulation,
    inspectedTarget: payload.inspectedTarget ?? { kind: 'dish', id: null },
    view: { zoom: 1, cameraX: -48, cameraY: 0 },
    left: viewportWidth - 560 - 48,
    top: viewportHeight - 560 - 32,
    size: 560,
    zIndex: 1,
  }];
}

export function renderSaveSlots(
  container: HTMLElement | null,
  mode: SaveMode,
  onSave: (index: number, name: string) => void,
  onLoad: (index: number) => void,
): void {
  if (!container) {
    return;
  }
  const slots = readSaveSlots();
  container.textContent = '';
  slots.forEach((slot, index) => {
    const row = document.createElement('div');
    row.className = 'save-slot-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = slot.name;
    nameInput.maxLength = 32;
    nameInput.ariaLabel = `Save slot ${index + 1} name`;
    nameInput.addEventListener('change', () => {
      const next = readSaveSlots();
      next[index].name = nameInput.value.trim() || `Slot ${index + 1}`;
      writeSaveSlots(next);
    });

    const meta = document.createElement('span');
    meta.className = 'save-slot-meta';
    meta.textContent = slot.savedAt ? new Date(slot.savedAt).toLocaleString() : 'Empty';

    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = mode === 'save' ? 'Save' : 'Load';
    action.disabled = mode === 'load' && !slot.data;
    action.addEventListener('click', () => {
      if (mode === 'save') {
        onSave(index, nameInput.value);
      } else {
        onLoad(index);
      }
    });

    row.append(nameInput, meta, action);
    container.appendChild(row);
  });
}

function exportDish(dish: SavePayloadDish): DishSaveData {
  const rect = dish.canvas.getBoundingClientRect();
  return {
    id: dish.id,
    name: dish.name,
    state: dish.simulation.exportState(),
    inspectedTarget: dish.inspectedTarget,
    view: dish.renderer.exportView(),
    left: rect.left,
    top: rect.top,
    size: rect.width,
    zIndex: dish.zIndex,
  };
}

export function saveToSlot<TStep extends string = string>(index: number, name: string, data: SaveData<TStep>): SaveSlot<TStep> {
  const slots = readSaveSlots();
  slots[index] = {
    name: name.trim() || `Slot ${index + 1}`,
    savedAt: Date.now(),
    data,
  };
  writeSaveSlots(slots);
  return slots[index] as SaveSlot<TStep>;
}

export function readSlot<TStep extends string = string>(index: number): SaveSlot<TStep> {
  return readSaveSlots()[index] as SaveSlot<TStep>;
}

function readSaveSlots(): SaveSlot[] {
  const fallback: SaveSlot[] = Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => ({
    name: `Slot ${index + 1}`,
    savedAt: null,
    data: null,
  }));
  const raw = localStorage.getItem(SAVE_SLOTS_KEY);
  if (!raw) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SaveSlot>[];
    return fallback.map((slot, index) => ({
      name: parsed[index]?.name || slot.name,
      savedAt: parsed[index]?.savedAt ?? null,
      data: parsed[index]?.data ?? null,
    }));
  } catch {
    return fallback;
  }
}

function writeSaveSlots(slots: SaveSlot[]): void {
  localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots.slice(0, SAVE_SLOT_COUNT)));
}
