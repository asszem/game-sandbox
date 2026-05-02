export function pulseButton(button: HTMLButtonElement): void {
  button.classList.remove('pulsed');
  requestAnimationFrame(() => {
    button.classList.add('pulsed');
  });
}

export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

export function isRangeControlTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.type === 'range';
}
