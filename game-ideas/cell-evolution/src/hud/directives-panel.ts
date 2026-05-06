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
  complexity = 1,
): void {
  transportControls.forEach((control) => {
    const key = control.dataset.control as CellControlKey;
    const value = cell ? Math.round((cell[key] ?? 0.5) * 100) : 0;
    const hiddenAtComplexityOne = complexity <= 1 && key !== 'movementBudget';
    control.value = String(value);
    control.disabled = !cell || hiddenAtComplexityOne;
    control.closest('label')?.toggleAttribute('hidden', hiddenAtComplexityOne);
    control.parentElement?.style.setProperty('--control-value', String(value / 100));
  });
  transportOutputs.forEach((output) => {
    const key = output.dataset.controlValue as CellControlKey;
    const value = cell ? Math.round((cell[key] ?? 0.5) * 100) : 0;
    output.textContent = controlLabel(key, value);
  });
}

function controlLabel(key: CellControlKey, value: number): string {
  if (key === 'glucoseTransport') {
    return value < 34 ? 'Use now' : value > 66 ? 'Store early' : 'Balanced';
  }
  if (key === 'aminoTransport') {
    return value < 34 ? 'Import low' : value > 66 ? 'Import high' : 'Balanced';
  }
  if (key === 'oxygenMetabolism') {
    return value < 34 ? 'Low ATP' : value > 66 ? 'High ATP' : 'Balanced';
  }
  if (key === 'ribosomeActivity') {
    return value < 34 ? 'Growth' : value > 66 ? 'Repair' : 'Balanced';
  }
  if (key === 'sensorBudget') {
    return value < 34 ? 'Short range' : value > 66 ? 'Wide range' : 'Balanced';
  }
  return value < 34 ? 'Conserve' : value > 66 ? 'Sprint' : 'Balanced';
}

export function syncDirectiveSelects(selects: NodeListOf<HTMLSelectElement>, cell: Cell | null): void {
  selects.forEach((select) => {
    if (select.dataset.cellSelect === 'searchPreference') {
      select.value = cell?.searchPreference ?? 'balanced';
      select.disabled = !cell;
    }
  });
}

export function syncDirectiveSelectsForComplexity(selects: NodeListOf<HTMLSelectElement>, cell: Cell | null, complexity = 1): void {
  selects.forEach((select) => {
    if (select.dataset.cellSelect !== 'searchPreference') {
      return;
    }
    const isMetabolismSelect = Boolean(select.closest('.metabolic-dashboard'));
    if (complexity <= 1) {
      select.value = 'glucose';
      select.disabled = !cell;
      select.closest('label')?.toggleAttribute('hidden', !isMetabolismSelect);
      return;
    }
    select.closest('label')?.toggleAttribute('hidden', false);
    select.value = cell?.searchPreference ?? 'balanced';
    select.disabled = !cell;
  });
}

export function isSearchPreference(value: string): value is SearchPreference {
  return value === 'balanced' || value === 'glucose' || value === 'amino-acid' || value === 'oxygen' || value === 'light';
}
