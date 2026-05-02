## HUD utility extraction - toasts, tooltips, windows

### Motivation
`src/main.ts` mixes app orchestration with reusable HUD utilities. Moving the low-risk UI helpers first reduces the file size and creates clear homes for later panel refactors.

### Old files changed
- `src/main.ts` - moved toast rendering, tooltip behavior, and draggable/collapsible window system helpers.

### New files created
- `src/hud/toasts.ts` - toast region factory and toast lifecycle.
- `src/hud/tooltips.ts` - tooltip toggle sync, event binding, positioning, and hide logic.
- `src/hud/windows.ts` - window layout types, draggable/resizable/collapsible window system.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Renderer cell geometry extraction - body and cilia shapes

### Motivation
Cell body shape generation, cilia geometry updates, and seeded visual noise are standalone geometry helpers. Moving them out of `PetriDishRenderer.ts` reduces renderer class size while keeping cell materials and object lifecycle local.

### Old files changed
- `src/render/PetriDishRenderer.ts` - uses cell geometry helpers for body shapes, cilia, and seeded organelle noise.

### New files created
- `src/render/cell-geometry.ts` - cell body geometry, cilia geometry/update helpers, and seeded noise.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Core sensing extraction - shared signal profile math

### Motivation
Sensing radius, clarity, and processing math was duplicated between simulation and renderer. Moving it to `src/core/sensing.ts` gives both domains one shared source for cell signal transduction calculations.

### Old files changed
- `src/core/simulation.ts` - delegates awareness and sensing profile calculation to core sensing helpers.
- `src/render/PetriDishRenderer.ts` - uses the shared sensing profile for the sensor overlay.

### New files created
- `src/core/sensing.ts` - sensing profile and awareness radius helpers.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Backdrop extraction - microscope canvas drawing

### Motivation
The procedural microscope backdrop drawing does not depend on app state. Moving it into an app helper removes canvas drawing noise from `src/main.ts`.

### Old files changed
- `src/main.ts` - delegates backdrop drawing to `drawMicroscopeBackdrop(canvas)`.

### New files created
- `src/app/backdrop.ts` - microscope backdrop canvas drawing helper.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Renderer shader helper extraction - timed materials

### Motivation
Timed shader material creation, uniform time updates, and the shared noise shader chunk are renderer utilities used across many visual domains. Moving them out of the renderer class clarifies which shader code is generic.

### Old files changed
- `src/render/PetriDishRenderer.ts` - uses shared shader utility functions for timed materials and shader noise.

### New files created
- `src/render/shaders.ts` - timed shader material factory, time uniform updater, and noise shader chunk.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Renderer texture extraction - canvas texture factories

### Motivation
Procedural canvas texture generation for the dish and microscope backdrop is independent of the renderer class state. Moving it to a render helper module reduces `PetriDishRenderer.ts` without changing scene behavior.

### Old files changed
- `src/render/PetriDishRenderer.ts` - imports procedural texture factories instead of defining them as private methods.

### New files created
- `src/render/textures.ts` - dish vein texture and microscope backdrop texture factories.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Save payload extraction - dish export assembly

### Motivation
Save payload assembly and dish serialization belong with save/load types and storage helpers. Moving them out of `src/main.ts` reduces persistence knowledge in the app orchestrator while keeping world restoration local for now.

### Old files changed
- `src/main.ts` - replaced local save payload and dish export helpers with `createSavePayloadData`.
- `src/app/save-load.ts` - added save payload assembly and dish export support.

### New files created
- None.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## CSS domain split - stylesheet modules

### Motivation
`src/styles.css` exceeded 2,000 lines and mixed global shell, dish visuals, windows, panels, modals, drop tools, tutorial, and responsive rules. Splitting it by UI domain makes visual changes easier to target and keeps every CSS file below the refactor size threshold.

### Old files changed
- `src/main.ts` - now imports `src/styles/index.css`.
- `src/styles.css` - removed after splitting into domain files.

### New files created
- `src/styles/index.css` - ordered CSS imports.
- `src/styles/base.css`, `dish.css`, `windows.css`, `game-panel.css`, `entity-panel.css`, `hover-info.css`, `tutorial.css`, `drop-tools.css`, `directives-panel.css`, `metabolism-panel.css`, `metabolism-icons.css`, `metabolism-flow.css`, `metabolism-controls.css`, `feedback.css`, `modals.css`, and `responsive.css`.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Drop tools extraction - drag ghost and pointer lifecycle

### Motivation
Drop item pointer handling, ghost creation, click suppression, and cancel behavior were generic drop-tool UI state in `src/main.ts`. Moving them to an app controller leaves `main.ts` responsible only for validating dish drops and applying game effects.

### Old files changed
- `src/main.ts` - replaced drop ghost state/listeners with a `createDropController` callback.

### New files created
- `src/app/drop-tools.ts` - drop item type, ghost rendering, pointer/key listeners, cancel behavior, and button binding.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Tutorial module extraction - milestones, progress, and panel state

### Motivation
Tutorial milestone definitions, completion checks, local progress storage, and tutorial panel rendering were all in `src/main.ts`. Moving them to an app module separates tutorial presentation/state rules from world mutation and app orchestration.

### Old files changed
- `src/main.ts` - moved milestone data, completion predicates, tutorial progress storage, and tutorial panel rendering helpers.

### New files created
- `src/app/tutorial.ts` - tutorial step definitions, completion checks, milestone storage, and panel rendering.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Directives panel extraction - DNA and transport controls

### Motivation
DNA button enabled state and transport slider output syncing are directive-panel DOM concerns. Extracting them keeps selected-cell control presentation outside app orchestration.

### Old files changed
- `src/main.ts` - replaced local directive control helpers with wrappers around a HUD module.

### New files created
- `src/hud/directives-panel.ts` - DNA enable state and transport control value syncing.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## New dish setup extraction - modal defaults and control reads

### Motivation
New dish defaults, slider output syncing, and modal input parsing were app-specific helpers in `src/main.ts`. Moving them to `src/app/` keeps dish creation setup separate from dish lifecycle and renderer orchestration.

### Old files changed
- `src/main.ts` - replaced local new-dish setup helpers with small wrappers around an app module.

### New files created
- `src/app/new-dish.ts` - new dish setup type, defaults, cell-count sync, range reset, and setup reading from modal controls.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Save slot extraction - storage and modal rows

### Motivation
Save slot storage and modal row rendering were independent of dish restore mechanics but still lived in `src/main.ts`. Extracting them starts the app-domain split while leaving save payload assembly and world restoration in the orchestrator.

### Old files changed
- `src/main.ts` - moved save slot constants, slot storage, and modal row rendering behind a small save-load module.

### New files created
- `src/app/save-load.ts` - save payload types, single-save key, save slot storage, and save/load modal row rendering.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Metabolism panel extraction - dashboard rates and readouts

### Motivation
Metabolism dashboard rendering and configured rate projection were embedded in `src/main.ts`. Moving them to a panel module keeps metabolic UI behavior next to the panel it drives and removes a long calculation block from app orchestration.

### Old files changed
- `src/main.ts` - replaced local metabolism dashboard and rate helpers with a call into the panel module.

### New files created
- `src/hud/metabolism-panel.ts` - metabolic rate projection, resource readouts, light factor display, and dashboard flow styling.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Hover info extraction - target labels and compact facts

### Motivation
Hover target descriptions, compact fact HTML, resource labels, and short entity summaries were presentation-specific helpers in `src/main.ts`. Moving them to a dedicated HUD module keeps hover behavior easier to evolve without touching app orchestration.

### Old files changed
- `src/main.ts` - moved hover target formatting, labels, resource descriptions, and position formatting.

### New files created
- `src/hud/hover-info.ts` - hover fact rendering, target labels, resource descriptions, and short entity summaries.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Entity panel helper extraction - cell stats and directives

### Motivation
Selected-cell stat formatting, directive text, and sensing scans are HUD/domain presentation helpers rather than app bootstrap logic. Moving them out of `src/main.ts` makes the selected entity panel easier to adjust independently.

### Old files changed
- `src/main.ts` - moved cell stat formatting, directive description, directive selection, and detection scan helpers.

### New files created
- `src/hud/entity-panel.ts` - selected cell stat HTML, directive text, and detection summary helpers.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## HUD DOM helper extraction - input target and button pulse helpers

### Motivation
`src/main.ts` still contains generic DOM helpers unrelated to game orchestration. Moving them to `src/hud/` keeps input utility code reusable and reduces app bootstrap noise.

### Old files changed
- `src/main.ts` - moved typing-target checks, range-target checks, and button pulse helper.

### New files created
- `src/hud/dom.ts` - generic DOM input and button helpers.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Core utility reuse - remove duplicate main helpers

### Motivation
`src/main.ts` had local `distance` and `clamp` helpers duplicating `src/core/vector.ts`, plus an unused `setText` helper. Reusing the existing core utilities reduces duplicated logic before larger module extraction.

### Old files changed
- `src/main.ts` - imported `clamp` and `distance` from `src/core/vector.ts`, removed local duplicates and unused helper.

### New files created
- None.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## State panel formatting extraction - dish stats and picker HTML

### Motivation
Dish state and picker HTML formatting was embedded in `src/main.ts` even though it is panel-specific presentation code. Moving it to a HUD module keeps the app orchestrator focused on simulation, renderer, and event flow.

### Old files changed
- `src/main.ts` - moved dish state and picker formatting helpers.

### New files created
- `src/hud/state-panel.ts` - dish stat HTML, dish picker rows, picker signature, dish name sanitization, and HTML escaping.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Core metabolism extraction - cell resource flow

### Motivation
Cell metabolism updates were embedded in `CellSimulation.updateCell`, making movement, sensing, resource flow, growth, and rate calculation difficult to scan together. Moving metabolism to a core helper keeps the simulation step focused on orchestration while preserving the existing resource math.

### Old files changed
- `src/core/simulation.ts` - delegated cell metabolism and mass-radius calculation.

### New files created
- `src/core/metabolism.ts` - cell resource flow, rate calculation, and radius-from-mass helper.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Core resource transport extraction - ingestion helper

### Motivation
Resource ingestion math was embedded in `CellSimulation`, even though it only mutates a cell and the resource being consumed. Moving it to a focused helper makes consume-resource logic shorter and gives metabolism-adjacent behavior a clear home.

### Old files changed
- `src/core/simulation.ts` - delegated transport math from resource consumption.

### New files created
- `src/core/resource-transport.ts` - glucose, amino-acid, and oxygen uptake math.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Core environment scan extraction - sensing pull vector

### Motivation
The logic that converts nearby resources, hazards, and other cells into a movement pull vector is sensing behavior, not simulation orchestration. Moving it out of `CellSimulation` keeps `updateCell` focused on step ordering and makes sensing easier to test or tune separately.

### Old files changed
- `src/core/simulation.ts` - delegated environment pull calculation.

### New files created
- `src/core/environment-scan.ts` - resource attraction, hazard avoidance, and cell interaction pull vector.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Renderer dish material extraction - base agar rim shaders

### Motivation
The renderer facade still contained dish-only shader factories. Moving base, agar, and rim materials into a render helper reduces class size while keeping shader code in the render domain.

### Old files changed
- `src/render/PetriDishRenderer.ts` - delegated dish material creation.

### New files created
- `src/render/dish-materials.ts` - dish base, agar, and rim shader material factories.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Renderer resource visual extraction - resource markers and colors

### Motivation
Resource marker construction and shader code were embedded in the renderer facade. Moving them to `render/resources.ts` keeps molecule marker visuals together and leaves the renderer responsible for syncing scene objects.

### Old files changed
- `src/render/PetriDishRenderer.ts` - delegated resource group creation and imported shared resource colors.

### New files created
- `src/render/resources.ts` - resource colors, marker geometry, and resource shader material.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Renderer hazard material extraction - poison shader

### Motivation
The poison shader is hazard-specific render code. Moving it out of the renderer facade keeps hazard material tuning separate from scene synchronization.

### Old files changed
- `src/render/PetriDishRenderer.ts` - delegated poison material creation.

### New files created
- `src/render/hazards.ts` - poison shader material factory.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass

## Renderer block helper extraction - mineral visuals and hit test

### Motivation
Mineral block geometry, shader material, and polygon hit testing are block-specific render helpers. Moving them out of the renderer facade keeps block rendering and picking math together.

### Old files changed
- `src/render/PetriDishRenderer.ts` - delegated block geometry, material, and point-in-block checks.

### New files created
- `src/render/blocks.ts` - mineral block geometry, shader material, and polygon hit test helper.

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass
