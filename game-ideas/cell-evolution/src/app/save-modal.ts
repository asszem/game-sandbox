import { readSlot, renderSaveSlots, saveToSlot, type SaveData } from './save-load';

type SaveMode = 'save' | 'load';

type SaveModalElements = {
  modal: HTMLElement | null;
  slotList: HTMLElement | null;
  title: HTMLElement | null;
};

export function createSaveModalController<TStep extends string>(elements: SaveModalElements, actions: {
  createPayload: () => SaveData<TStep>;
  applyPayload: (payload: SaveData<TStep>, message: string) => void;
  showToast: (message: string) => void;
}): {
  open: (mode: SaveMode) => void;
  close: () => void;
  render: () => void;
} {
  let mode: SaveMode = 'save';

  const render = (): void => {
    renderSaveSlots(elements.slotList, mode, saveSlot, loadSlot);
  };

  const close = (): void => {
    if (elements.modal) {
      elements.modal.hidden = true;
    }
  };

  const open = (nextMode: SaveMode): void => {
    if (!elements.modal || !elements.slotList || !elements.title) {
      actions.showToast('Save slots unavailable');
      return;
    }
    mode = nextMode;
    elements.title.textContent = mode === 'save' ? 'Save game' : 'Load game';
    render();
    elements.modal.hidden = false;
  };

  const saveSlot = (index: number, name: string): void => {
    const slot = saveToSlot(index, name, actions.createPayload());
    render();
    actions.showToast(`Saved ${slot.name}`);
  };

  const loadSlot = (index: number): void => {
    const slot = readSlot<TStep>(index);
    if (!slot.data) {
      actions.showToast('Save slot is empty');
      return;
    }
    actions.applyPayload(slot.data, `Loaded ${slot.name}`);
    close();
  };

  return { open, close, render };
}
