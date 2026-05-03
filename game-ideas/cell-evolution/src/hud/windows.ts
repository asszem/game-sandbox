export type WindowLayout = Record<string, { left: number; top: number; width: number; height: number; collapsed: boolean }>;

type GameWindow = {
  id: string;
  element: HTMLElement;
  stackElement: HTMLElement;
  body: HTMLElement | null;
  collapseButton: HTMLButtonElement | null;
};

export type WindowSystem = {
  exportLayout(): WindowLayout;
  applyLayout(layout: WindowLayout): void;
  fitHeight(id: string): void;
};

export function createWindowSystem(): WindowSystem {
  const windows: GameWindow[] = Array.from(document.querySelectorAll<HTMLElement>('.game-window')).map((element) => ({
    id: element.dataset.windowId ?? '',
    element,
    stackElement: element.classList.contains('hud') ? element : element.closest<HTMLElement>('.hud') ?? element,
    body: element.querySelector<HTMLElement>('.window-body'),
    collapseButton: element.querySelector<HTMLButtonElement>('.window-collapse'),
  }));

  for (const gameWindow of windows) {
    setupWindow(gameWindow, windows);
    setCollapsed(gameWindow, gameWindow.element.classList.contains('is-collapsed'), false);
  }

  return {
    exportLayout(): WindowLayout {
      const layout: WindowLayout = {};
      for (const gameWindow of windows) {
        const rect = gameWindow.element.getBoundingClientRect();
        layout[gameWindow.id] = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          collapsed: gameWindow.element.classList.contains('is-collapsed'),
        };
      }
      return layout;
    },
    applyLayout(layout: WindowLayout): void {
      for (const gameWindow of windows) {
        const saved = layout[gameWindow.id];
        if (!saved) {
          continue;
        }
        gameWindow.element.style.left = `${clamp(saved.left, 8, window.innerWidth - 80)}px`;
        gameWindow.element.style.top = `${clamp(saved.top, 8, window.innerHeight - 32)}px`;
        gameWindow.element.style.width = `${Math.max(180, saved.width)}px`;
        gameWindow.element.style.height = saved.collapsed ? 'auto' : `${Math.max(44, saved.height)}px`;
        setCollapsed(gameWindow, saved.collapsed, false);
      }
    },
    fitHeight(id: string): void {
      const gameWindow = windows.find((item) => item.id === id);
      if (!gameWindow || gameWindow.element.classList.contains('is-collapsed')) {
        return;
      }
      requestAnimationFrame(() => fitWindowHeightToContent(gameWindow));
    },
  };
}

function setupWindow(gameWindow: GameWindow, windows: GameWindow[]): void {
  const { element } = gameWindow;
  const titlebar = element.querySelector<HTMLElement>('.window-titlebar');
  const resizeHandle = element.querySelector<HTMLElement>('.window-resize');
  let drag: { pointerId: number; startX: number; startY: number; left: number; top: number } | null = null;
  let resize: { pointerId: number; startX: number; startY: number; width: number; height: number } | null = null;
  let lastTitlePress = 0;

  gameWindow.collapseButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    bringWindowToFront(gameWindow, windows);
    setCollapsed(gameWindow, !element.classList.contains('is-collapsed'));
  });

  element.addEventListener('pointerdown', () => bringWindowToFront(gameWindow, windows), { capture: true });
  element.addEventListener('focusin', () => bringWindowToFront(gameWindow, windows));

  titlebar?.addEventListener('pointerdown', (event) => {
    if (event.target instanceof HTMLButtonElement) {
      return;
    }
    const now = performance.now();
    if (now - lastTitlePress < 320) {
      event.preventDefault();
      lastTitlePress = 0;
      drag = null;
      setCollapsed(gameWindow, !element.classList.contains('is-collapsed'));
      return;
    }
    lastTitlePress = now;
    const rect = element.getBoundingClientRect();
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top };
    element.setPointerCapture(event.pointerId);
  });

  element.addEventListener('pointermove', (event) => {
    if (drag?.pointerId === event.pointerId) {
      const rect = element.getBoundingClientRect();
      const nextLeft = clamp(drag.left + event.clientX - drag.startX, 8, window.innerWidth - rect.width - 8);
      const nextTop = clamp(drag.top + event.clientY - drag.startY, 8, window.innerHeight - rect.height - 8);
      element.style.left = `${nextLeft}px`;
      element.style.top = `${nextTop}px`;
    }
    if (resize?.pointerId === event.pointerId && !element.classList.contains('is-collapsed')) {
      element.style.width = `${Math.max(180, resize.width + event.clientX - resize.startX)}px`;
      element.style.height = `${Math.max(72, resize.height + event.clientY - resize.startY)}px`;
    }
  });

  element.addEventListener('pointerup', (event) => {
    if (drag?.pointerId === event.pointerId) {
      drag = null;
    }
    if (resize?.pointerId === event.pointerId) {
      resize = null;
    }
  });

  resizeHandle?.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    const rect = element.getBoundingClientRect();
    resize = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, width: rect.width, height: rect.height };
    element.setPointerCapture(event.pointerId);
  });
}

function bringWindowToFront(selected: GameWindow, windows: GameWindow[]): void {
  const ordered = [...windows].sort((left, right) => windowZIndex(left) - windowZIndex(right));
  let zIndex = 3;
  for (const gameWindow of ordered) {
    gameWindow.stackElement.style.zIndex = String(zIndex);
    gameWindow.element.classList.toggle('is-selected', gameWindow === selected);
    zIndex += 1;
  }
  selected.stackElement.style.zIndex = String(zIndex);
  selected.element.classList.add('is-selected');
}

function windowZIndex(gameWindow: GameWindow): number {
  const zIndex = Number(gameWindow.stackElement.style.zIndex || getComputedStyle(gameWindow.stackElement).zIndex);
  return Number.isFinite(zIndex) ? zIndex : 3;
}

function setCollapsed(gameWindow: GameWindow, collapsed: boolean, fitOnExpand = true): void {
  gameWindow.element.classList.toggle('is-collapsed', collapsed);
  if (!collapsed && fitOnExpand) {
    fitWindowHeightToContent(gameWindow);
  }
  if (gameWindow.collapseButton) {
    gameWindow.collapseButton.textContent = collapsed ? '▸' : '▾';
    gameWindow.collapseButton.setAttribute('aria-expanded', String(!collapsed));
  }
}

function fitWindowHeightToContent(gameWindow: GameWindow): void {
  const titlebar = gameWindow.element.querySelector<HTMLElement>('.window-titlebar');
  const body = gameWindow.body;
  if (!titlebar || !body) {
    return;
  }
  const rect = gameWindow.element.getBoundingClientRect();
  const desiredHeight = Math.ceil(titlebar.offsetHeight + body.scrollHeight + 2);
  const desiredTop = desiredHeight > window.innerHeight - rect.top - 8
    ? clamp(window.innerHeight - desiredHeight - 8, 8, rect.top)
    : rect.top;
  if (desiredTop !== rect.top) {
    gameWindow.element.style.top = `${desiredTop}px`;
  }
  const maxHeight = Math.max(72, window.innerHeight - desiredTop - 8);
  gameWindow.element.style.height = `${clamp(desiredHeight, 72, maxHeight)}px`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
