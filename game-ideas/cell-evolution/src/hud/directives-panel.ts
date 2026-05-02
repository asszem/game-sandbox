import type { Cell } from '../core/types';

type TransportControlKey = 'glucoseTransport' | 'aminoTransport' | 'oxygenMetabolism' | 'ribosomeActivity';

export function setDnaEnabled(
  dnaButtons: NodeListOf<HTMLButtonElement>,
  transportControls: NodeListOf<HTMLInputElement>,
  enabled: boolean,
): void {
  dnaButtons.forEach((button) => {
    button.setAttribute('aria-disabled', String(!enabled));
  });
  transportControls.forEach((control) => {
    control.disabled = !enabled;
  });
}

export function syncTransportControls(
  transportControls: NodeListOf<HTMLInputElement>,
  transportOutputs: NodeListOf<HTMLOutputElement>,
  cell: Cell | null,
): void {
  transportControls.forEach((control) => {
    const key = control.dataset.control as TransportControlKey;
    const value = cell ? Math.round((cell[key] ?? 0.5) * 100) : 0;
    control.value = String(value);
  });
  transportOutputs.forEach((output) => {
    const key = output.dataset.controlValue as TransportControlKey;
    const value = cell ? Math.round((cell[key] ?? 0.5) * 100) : 0;
    output.textContent = `${value}%`;
  });
}
