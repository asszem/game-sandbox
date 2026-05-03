export function syncTooltipToggle(
  tooltipToggle: HTMLInputElement | null,
  tooltipStatus: HTMLElement | null,
  enabled: boolean,
): void {
  if (tooltipToggle) {
    tooltipToggle.checked = enabled;
  }
  if (tooltipStatus) {
    tooltipStatus.textContent = enabled ? 'On' : 'Off';
    tooltipStatus.dataset.state = enabled ? 'on' : 'off';
  }
}

export function setupTooltips(tooltipLayer: HTMLElement | null, isEnabled: () => boolean): void {
  document.addEventListener('pointerover', (event) => {
    const target = tooltipTarget(event.target);
    if (target) {
      showTooltip(tooltipLayer, target, isEnabled, event);
    }
  });
  document.addEventListener('pointermove', (event) => {
    const target = tooltipTarget(event.target);
    if (target) {
      positionTooltip(tooltipLayer, target, event);
    }
  });
  document.addEventListener('pointerout', (event) => {
    const target = tooltipTarget(event.target);
    if (target && !target.contains(event.relatedTarget as Node | null)) {
      hideTooltip(tooltipLayer);
    }
  });
  document.addEventListener('focusin', (event) => {
    const target = tooltipTarget(event.target);
    if (target) {
      showTooltip(tooltipLayer, target, isEnabled);
    }
  });
  document.addEventListener('focusout', (event) => {
    const target = tooltipTarget(event.target);
    if (target) {
      hideTooltip(tooltipLayer);
    }
  });
  window.addEventListener('scroll', () => hideTooltip(tooltipLayer), true);
  window.addEventListener('resize', () => hideTooltip(tooltipLayer));
}

export function hideTooltip(tooltipLayer: HTMLElement | null): void {
  if (tooltipLayer) {
    tooltipLayer.hidden = true;
  }
}

function tooltipTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-tooltip]') : null;
}

function showTooltip(tooltipLayer: HTMLElement | null, target: HTMLElement, isEnabled: () => boolean, pointer?: PointerEvent): void {
  if (!tooltipLayer) {
    return;
  }
  if (!isEnabled()) {
    hideTooltip(tooltipLayer);
    return;
  }
  const text = target.dataset.tooltip;
  if (!text) {
    return;
  }
  tooltipLayer.textContent = text;
  tooltipLayer.hidden = false;
  positionTooltip(tooltipLayer, target, pointer);
}

function positionTooltip(tooltipLayer: HTMLElement | null, target: HTMLElement, pointer?: PointerEvent): void {
  if (!tooltipLayer || tooltipLayer.hidden) {
    return;
  }
  const gap = 14;
  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltipLayer.getBoundingClientRect();
  const maxLeft = window.innerWidth - tooltipRect.width - 8;
  const anchorX = pointer?.clientX ?? targetRect.left;
  const anchorY = pointer?.clientY ?? targetRect.bottom;
  const left = clamp(anchorX, 8, Math.max(8, maxLeft));
  let top = anchorY + gap;
  if (top + tooltipRect.height > window.innerHeight - 8) {
    top = pointer
      ? clamp(pointer.clientY - tooltipRect.height - gap, 8, Math.max(8, window.innerHeight - tooltipRect.height - 8))
      : Math.max(8, targetRect.top - tooltipRect.height - gap);
  }
  tooltipLayer.style.left = `${left}px`;
  tooltipLayer.style.top = `${top}px`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
