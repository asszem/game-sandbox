export type DropItemKind = 'cotton-candy' | 'cat-pawn';

type ActiveDrop = {
  pointerId: number | null;
  kind: DropItemKind;
  ghost: HTMLElement;
};

type DropControllerOptions = {
  buttons: NodeListOf<HTMLButtonElement>;
  onBegin?: () => void;
  onDrop: (kind: DropItemKind, clientX: number, clientY: number) => boolean;
};

export type DropController = {
  cancel: () => void;
  isActive: () => boolean;
};

export function createDropController(options: DropControllerOptions): DropController {
  let activeDrop: ActiveDrop | null = null;
  let suppressClick = false;

  function beginDropItem(kind: DropItemKind, clientX: number, clientY: number, pointerId: number | null): void {
    cancelActiveDrop();
    options.onBegin?.();
    const ghost = document.createElement('div');
    ghost.className = `drop-ghost ${kind}`;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.appendChild(createDropIcon(kind));
    document.body.appendChild(ghost);
    activeDrop = { pointerId, kind, ghost };
    positionDropGhost(clientX, clientY);
    window.addEventListener('pointermove', handleDropPointerMove);
    window.addEventListener('pointerup', handleDropPointerUp);
    window.addEventListener('keydown', handleDropKeyDown);
  }

  function handleDropPointerMove(event: PointerEvent): void {
    if (!activeDrop || (activeDrop.pointerId !== null && activeDrop.pointerId !== event.pointerId)) {
      return;
    }
    positionDropGhost(event.clientX, event.clientY);
  }

  function handleDropPointerUp(event: PointerEvent): void {
    if (!activeDrop || (activeDrop.pointerId !== null && activeDrop.pointerId !== event.pointerId)) {
      return;
    }
    finishDropItem(event.clientX, event.clientY);
  }

  function handleDropKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Escape') {
      cancelActiveDrop();
    }
  }

  function finishDropItem(clientX: number, clientY: number): void {
    if (!activeDrop) {
      return;
    }
    const { kind, ghost } = activeDrop;
    const accepted = options.onDrop(kind, clientX, clientY);
    if (!accepted) {
      cancelActiveDrop();
      return;
    }
    ghost.classList.add('is-dissolving');
    window.setTimeout(() => ghost.remove(), 360);
    removeDropListeners();
    activeDrop = null;
  }

  function cancelActiveDrop(): void {
    if (!activeDrop) {
      return;
    }
    activeDrop.ghost.remove();
    activeDrop = null;
    removeDropListeners();
  }

  function removeDropListeners(): void {
    window.removeEventListener('pointermove', handleDropPointerMove);
    window.removeEventListener('pointerup', handleDropPointerUp);
    window.removeEventListener('keydown', handleDropKeyDown);
  }

  function positionDropGhost(clientX: number, clientY: number): void {
    if (!activeDrop) {
      return;
    }
    activeDrop.ghost.style.left = `${clientX}px`;
    activeDrop.ghost.style.top = `${clientY}px`;
  }

  options.buttons.forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const kind = button.dataset.dropItem as DropItemKind | undefined;
      if (!kind) {
        return;
      }
      suppressClick = true;
      beginDropItem(kind, event.clientX, event.clientY, event.pointerId);
    });
    button.addEventListener('click', () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      const kind = button.dataset.dropItem as DropItemKind | undefined;
      if (!kind || activeDrop) {
        return;
      }
      const rect = button.getBoundingClientRect();
      beginDropItem(kind, rect.left + rect.width / 2, rect.top + rect.height / 2, null);
    });
  });

  return {
    cancel: cancelActiveDrop,
    isActive: () => Boolean(activeDrop),
  };
}

function createDropIcon(kind: DropItemKind): HTMLElement {
  const icon = document.createElement('span');
  icon.className = `drop-item-icon ${kind === 'cotton-candy' ? 'cotton-candy-icon' : 'cat-pawn-icon'}`;
  return icon;
}
