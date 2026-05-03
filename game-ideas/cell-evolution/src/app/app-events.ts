import type { Cell, DNAKey } from '../core/types';
import { isRangeControlTarget, isTypingTarget, pulseButton } from '../hud/dom';
import { syncRangeOutput } from './new-dish';

type GlobalShortcutHandlers = {
  hasActiveDish: () => boolean;
  toggleActiveDishRunning: () => void;
  toggleAllDishesRunning: () => void;
  restartScenario: () => void;
  saveGame: () => void;
  loadGame: () => void;
  resetActiveDishZoom: () => void;
  toggleTooltips: () => void;
  closeSaveModal: () => void;
  closeNewDishModal: () => void;
  showToast: (message: string) => void;
};

type DishListHandlers<Dish> = {
  findDish: (id: number) => Dish | null;
  selectDish: (dish: Dish) => void;
  renameDishDraft: (dish: Dish, name: string) => void;
  renameDishCommit: (dish: Dish, input: HTMLInputElement) => void;
};

type DnaHandlers = {
  selectedCell: () => Cell | null;
  infuseDNA: (key: DNAKey) => void;
  isTutorialMode: () => boolean;
  updateHud: () => void;
};

type TransportHandlers = {
  selectedCell: () => Cell | null;
  updateHud: () => void;
};

export function bindGlobalShortcuts(
  elements: {
    saveModal: HTMLElement | null;
    newDishModal: HTMLElement | null;
  },
  handlers: GlobalShortcutHandlers,
): void {
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      if (isTypingTarget(event.target) && !isRangeControlTarget(event.target)) {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) {
        handlers.toggleAllDishesRunning();
        return;
      }
      if (!handlers.hasActiveDish()) {
        handlers.showToast('Select a petri dish first');
        return;
      }
      handlers.toggleActiveDishRunning();
      return;
    }
    if (isTypingTarget(event.target)) {
      return;
    }
    if (event.code === 'KeyR') {
      event.preventDefault();
      handlers.restartScenario();
    }
    if (event.code === 'F5') {
      event.preventDefault();
      handlers.saveGame();
    }
    if (event.code === 'F9') {
      event.preventDefault();
      handlers.loadGame();
    }
    if (event.code === 'Numpad0') {
      event.preventDefault();
      if (!handlers.hasActiveDish()) {
        handlers.showToast('Select a petri dish first');
        return;
      }
      handlers.resetActiveDishZoom();
    }
    if (event.code === 'KeyH') {
      event.preventDefault();
      handlers.toggleTooltips();
    }
    if (event.code === 'Escape' && elements.saveModal && !elements.saveModal.hidden) {
      event.preventDefault();
      handlers.closeSaveModal();
    }
    if (event.code === 'Escape' && elements.newDishModal && !elements.newDishModal.hidden) {
      event.preventDefault();
      handlers.closeNewDishModal();
    }
  });
}

export function bindDishActionButtons(
  buttons: NodeListOf<HTMLButtonElement>,
  handlers: {
    add: () => void;
    delete: () => void;
    tutorial: () => void;
    restart: () => void;
    random: () => void;
    save: () => void;
    load: () => void;
  },
): void {
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.dishAction;
      if (action === 'add') handlers.add();
      if (action === 'delete') handlers.delete();
      if (action === 'tutorial') handlers.tutorial();
      if (action === 'restart') handlers.restart();
      if (action === 'random') handlers.random();
      if (action === 'save') handlers.save();
      if (action === 'load') handlers.load();
    });
  });
}

export function bindNewDishModal(
  elements: {
    modal: HTMLElement | null;
    close: HTMLButtonElement | null;
    cancel: HTMLButtonElement | null;
    create: HTMLButtonElement | null;
    cellCountRange: HTMLInputElement | null;
    cellCountInput: HTMLInputElement | null;
    resourceSliders: NodeListOf<HTMLInputElement>;
    environmentSliders: NodeListOf<HTMLInputElement>;
  },
  handlers: {
    close: () => void;
    create: () => void;
    setCellCount: (value: number) => void;
  },
): void {
  elements.close?.addEventListener('click', handlers.close);
  elements.cancel?.addEventListener('click', handlers.close);
  elements.create?.addEventListener('click', () => {
    handlers.create();
    handlers.close();
  });
  elements.modal?.addEventListener('click', (event) => {
    if (event.target === elements.modal) {
      handlers.close();
    }
  });
  elements.cellCountRange?.addEventListener('input', () => {
    handlers.setCellCount(Number(elements.cellCountRange?.value ?? 0));
  });
  elements.cellCountInput?.addEventListener('input', () => {
    handlers.setCellCount(Number(elements.cellCountInput?.value ?? 0));
  });
  elements.resourceSliders.forEach((slider) => {
    slider.addEventListener('input', () => syncRangeOutput(slider));
  });
  elements.environmentSliders.forEach((slider) => {
    slider.addEventListener('input', () => syncRangeOutput(slider));
  });
}

export function bindDishList<Dish>(dishList: HTMLElement | null, handlers: DishListHandlers<Dish>): void {
  dishList?.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const selectButton = target.closest<HTMLButtonElement>('[data-select-dish]');
    if (!selectButton) {
      return;
    }
    event.preventDefault();
    const dish = handlers.findDish(Number(selectButton.dataset.selectDish));
    if (dish) {
      handlers.selectDish(dish);
    }
  });
  dishList?.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.renameDish) {
      return;
    }
    const dish = handlers.findDish(Number(target.dataset.renameDish));
    if (dish) {
      handlers.renameDishDraft(dish, target.value);
    }
  });
  dishList?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.renameDish) {
      return;
    }
    const dish = handlers.findDish(Number(target.dataset.renameDish));
    if (dish) {
      handlers.renameDishCommit(dish, target);
    }
  });
  dishList?.addEventListener('keydown', (event) => {
    const target = event.target;
    if (event.code === 'Enter' && target instanceof HTMLInputElement && target.dataset.renameDish) {
      event.preventDefault();
      target.blur();
    }
  });
}

export function bindDnaButtons(buttons: NodeListOf<HTMLButtonElement>, handlers: DnaHandlers): void {
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      if (!handlers.selectedCell()) {
        return;
      }
      handlers.infuseDNA(button.dataset.dna as DNAKey);
      if (handlers.isTutorialMode()) {
        button.dataset.tutorialUsed = 'true';
      }
      pulseButton(button);
      handlers.updateHud();
    });
  });
}

export function bindTransportControls(controls: NodeListOf<HTMLInputElement>, handlers: TransportHandlers): void {
  controls.forEach((control) => {
    control.addEventListener('input', () => {
      const cell = handlers.selectedCell();
      const key = control.dataset.control as 'glucoseTransport' | 'aminoTransport' | 'oxygenMetabolism' | 'ribosomeActivity';
      if (!cell || !key) {
        return;
      }
      cell[key] = Number(control.value) / 100;
      handlers.updateHud();
    });
  });
}

export function bindTutorialControls(
  elements: {
    next: HTMLButtonElement | null;
    exit: HTMLButtonElement | null;
  },
  handlers: {
    canAdvance: () => boolean;
    advance: () => void;
    exit: () => void;
  },
): void {
  elements.next?.addEventListener('click', () => {
    if (handlers.canAdvance()) {
      handlers.advance();
    }
  });
  elements.exit?.addEventListener('click', handlers.exit);
}

export function bindSaveModal(
  elements: {
    modal: HTMLElement | null;
    close: HTMLButtonElement | null;
  },
  close: () => void,
): void {
  elements.close?.addEventListener('click', close);
  elements.modal?.addEventListener('click', (event) => {
    if (event.target === elements.modal) {
      close();
    }
  });
}

export function bindTooltipToggle(toggle: HTMLInputElement | null, onChange: (enabled: boolean) => void): void {
  toggle?.addEventListener('change', () => {
    onChange(toggle.checked);
  });
}

export function bindDishLayerClear(layer: HTMLElement, clearActiveDish: () => void): void {
  layer.addEventListener('pointerdown', (event) => {
    if (event.target === layer) {
      clearActiveDish();
    }
  });
}
