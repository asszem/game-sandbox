type DishSummary = {
  simulation: {
    state: {
      cells: unknown[];
      running: boolean;
    };
  };
};

export function syncGameStats(
  elements: {
    dishCount: HTMLElement | null;
    cellCount: HTMLElement | null;
    runningCount: HTMLElement | null;
  },
  dishes: DishSummary[],
): void {
  const totalCells = dishes.reduce((total, dish) => total + dish.simulation.state.cells.length, 0);
  const runningCount = dishes.filter((dish) => dish.simulation.state.running).length;
  if (elements.dishCount) {
    elements.dishCount.textContent = String(dishes.length);
  }
  if (elements.cellCount) {
    elements.cellCount.textContent = String(totalCells);
  }
  if (elements.runningCount) {
    elements.runningCount.textContent = String(runningCount);
  }
}

export function syncGamePanelVisibility(
  elements: {
    metabolicDashboard: HTMLElement | null;
    directiveIntro: HTMLElement | null;
    transportControlsPanel: HTMLElement | null;
    dnaButtonsPanel: HTMLElement | null;
    selectedDishActions: HTMLElement | null;
    addDishButton: HTMLButtonElement | null;
    deleteDishButton: HTMLButtonElement | null;
    dishActionButtons: NodeListOf<HTMLButtonElement>;
  },
  hasActiveDish: boolean,
  hasSelectedCell: boolean,
): void {
  if (elements.metabolicDashboard) {
    elements.metabolicDashboard.hidden = !hasSelectedCell;
  }
  if (elements.directiveIntro) {
    elements.directiveIntro.hidden = !hasSelectedCell;
  }
  if (elements.transportControlsPanel) {
    elements.transportControlsPanel.hidden = !hasSelectedCell;
  }
  if (elements.dnaButtonsPanel) {
    elements.dnaButtonsPanel.hidden = !hasSelectedCell;
  }
  if (elements.selectedDishActions) {
    elements.selectedDishActions.hidden = !hasActiveDish;
  }
  if (elements.addDishButton) {
    elements.addDishButton.hidden = false;
  }
  if (elements.deleteDishButton) {
    elements.deleteDishButton.hidden = !hasActiveDish;
  }
  elements.dishActionButtons.forEach((button) => {
    const action = button.dataset.dishAction;
    if (action === 'tutorial') {
      button.hidden = false;
    }
    const requiresDish = action === 'restart' || action === 'random';
    if (requiresDish) {
      button.hidden = !hasActiveDish;
    }
  });
}
