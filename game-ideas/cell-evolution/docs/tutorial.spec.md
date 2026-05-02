# Cell Evolution Tutorial Spec

## Entry

The `Start tutorial` button starts a controlled tutorial game. Existing dishes are removed, a new game is created with exactly one dish and one selected cell, and the tutorial window opens.

Tutorial milestone completion is stored in `localStorage` under `cell-evolution-tutorial-progress-v1`. Completed milestones unlock numbered jump buttons in the tutorial window. Jumping to a milestone rebuilds a controlled version of that lesson.

## Milestone 1: ATP, Glucose, Oxygen

Setup: one selected cell, no resources, no poison, no rocks. The cell starts with enough glucose and oxygen, but a moderate ATP production rate.

Lesson: ATP is cell energy. Glucose is fuel. Oxygen makes glucose produce more ATP, but high ATP production also raises ROS.

Goal: set `ATP production rate` to at least 75% and reach 92 ATP.

## Milestone 2: Harvest Glucose

Setup: the same controlled dish is rebuilt. A glucose molecule is dropped near the cell and the cell glucose store is lowered.

Lesson: glucose board markers replenish the internal glucose store. `Fuel uptake` controls how quickly the membrane imports glucose when touching it.

Goal: harvest glucose until the cell reaches at least 45 glucose.

## Milestone 3: Harvest Amino Acids

Setup: an amino-acid cluster is dropped near the cell and the amino-acid store is lowered.

Lesson: amino acids are repair, receptor, growth, and division material. `Repair material uptake` controls import speed.

Goal: harvest amino acids until the cell reaches at least 45 amino acids.

## Milestone 4: Use Light

Setup: a light bloom is dropped near the cell.

Lesson: light gives a local intake factor. While the cell sits in light, photosynthesis-like support slowly adds glucose and a small oxygen benefit.

Goal: move into the light and reach a light intake factor above 0.20.

## Milestone 5: Avoid Poison

Setup: a poison cloud is dropped near the cell.

Lesson: poison damages health, drains ATP, and increases ROS. `Caution` DNA improves avoidance.

Goal: add Caution DNA and keep the cell outside the poison cloud.

## Milestone 6: Avoid Rock

Setup: a rock is dropped near the cell with glucose beyond it.

Lesson: rocks are mineral blocks, not resources. Cells must route around them and cannot overlap them.

Goal: add Motility DNA and keep the cell clear of the rock.

## Milestone 7: Directives

Setup: two additional cells are dropped near the selected cell.

Lesson: directives summarize what the selected cell is trying to do based on ATP, resources, hazards, neighbors, transport settings, and DNA traits.

Goal: select a cell and add any DNA directive.
