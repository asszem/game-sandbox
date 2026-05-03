import type { Cell, SearchPreference } from '../core/types';

export type CellControlKey = 'glucoseTransport' | 'aminoTransport' | 'oxygenMetabolism' | 'ribosomeActivity' | 'sensorBudget' | 'movementBudget';

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
    const key = control.dataset.control as CellControlKey;
    const value = cell ? Math.round((cell[key] ?? 0.5) * 100) : 0;
    control.value = String(value);
  });
  transportOutputs.forEach((output) => {
    const key = output.dataset.controlValue as CellControlKey;
    const value = cell ? Math.round((cell[key] ?? 0.5) * 100) : 0;
    output.textContent = `${value}%`;
  });
}

export function syncDirectiveSelects(selects: NodeListOf<HTMLSelectElement>, cell: Cell | null): void {
  selects.forEach((select) => {
    if (select.dataset.cellSelect === 'searchPreference') {
      select.value = cell?.searchPreference ?? 'balanced';
      select.disabled = !cell;
    }
  });
}

export function isSearchPreference(value: string): value is SearchPreference {
  return value === 'balanced' || value === 'glucose' || value === 'amino-acid' || value === 'oxygen' || value === 'light';
}
