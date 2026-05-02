# Cell Evolution Refactor Prompt

## Goal
Refactor `game-ideas/cell-evolution` into smaller, AI-friendly TypeScript and CSS modules without changing gameplay behavior. Preserve the current Vite + TypeScript + Three.js stack.

Target file size:
- Preferred: 100-300 lines
- Acceptable: up to 450 lines for tightly coupled classes or shader-heavy render modules
- Split required: files above 500 lines unless there is a clear reason to keep a cohesive class together

## Current Code Structure

```text
game-ideas/cell-evolution/
  index.html
  src/
    main.ts
    styles.css
    core/
      rng.ts
      simulation.ts
      types.ts
      vector.ts
    render/
      PetriDishRenderer.ts
  tests/
    smoke.mjs
  docs/
    game-rules.spec.md
    tutorial.spec.md
    todo.md
  refactor/
    REFACTOR-PROMPT.md
```

Current oversized files:
- `src/main.ts` - app orchestration, DOM wiring, windows, save/load, tutorial, HUD formatting, drop tools
- `src/styles.css` - all layout, windows, panels, controls, modals, icons, responsive rules
- `src/render/PetriDishRenderer.ts` - Three.js scene setup, cell/resource/hazard/block visuals, picking, camera/zoom/pan
- `src/core/simulation.ts` - simulation state updates, metabolism, sensing, movement, collisions, spawning

## Refactor Principles

- Make small mechanical moves first. Do not rewrite logic while splitting files.
- Preserve behavior exactly unless a task explicitly asks for behavior changes.
- Keep imports explicit. Avoid broad barrel files until module boundaries are stable.
- Prefer one-level-deep folders under `src/`.
- Use kebab-case for file and folder names.
- Keep domain helpers near the code that owns the domain.
- Keep Three.js shader/material code near render modules, not in core simulation.
- Keep simulation code DOM-free and renderer-free.
- Keep DOM/window code out of `src/core/`.
- Update `tests/smoke.mjs` only when user-visible structure changes.

## Target TypeScript Structure

```text
src/
  app/
    bootstrap.ts              # app startup, animation loop, global keyboard/pointer orchestration
    dishes.ts                 # DishInstance lifecycle, create/select/delete/position labels
    save-load.ts              # SaveData, slots, import/export, localStorage
    tutorial.ts               # tutorial state, milestones, scenario setup
    drop-tools.ts             # drag/drop item tools and ghost UI
  core/
    rng.ts
    simulation.ts             # eventually split once app/render are separated
    types.ts
    vector.ts
  hud/
    state-panel.ts            # dish state formatting and dish picker list
    entity-panel.ts           # selected cell/resource/hazard/block detail formatting
    metabolism-panel.ts       # metabolism stores, rates, sliders, chart/dashboard formatting
    directives-panel.ts       # current directive and DNA/transport control display
    hover-info.ts             # hover title/detail formatting
    windows.ts                # draggable/collapsible/resizable window system
    tooltips.ts               # tooltip enable/position/render helpers
    toasts.ts                 # toast messages
  render/
    PetriDishRenderer.ts      # keep as facade during first pass
    scene.ts                  # scene/camera/renderer setup
    cells.ts                  # cell visual creation/update
    resources.ts              # resource visual creation/update
    hazards.ts                # poison visual creation/update
    blocks.ts                 # mineral block visual creation/picking
    effects.ts                # consume/death effects
    picking.ts                # screen/world picking helpers
    shaders.ts                # shared shader chunks/material factories
```

Do not create all of these files in one pass unless the user asks for a broad refactor. Prefer incremental extraction by domain.

## Target CSS Structure

```text
src/styles/
  base.css                    # reset, body, app shell, shared tokens
  dish.css                    # dish canvas and floating dish labels
  windows.css                 # generic game-window, titlebars, resize/collapse
  game-panel.css              # Game window, save/load, dish picker controls
  state-panel.css             # Dish State window
  entity-panel.css            # Metabolism/entity detail window
  directives-panel.css        # Directives window, DNA buttons, sliders
  hover-info.css              # Hover Info fact cards
  drop-tools.css              # Drop Items window, icons, drag ghost
  tutorial.css                # Tutorial window and milestones
  modals.css                  # New dish and save/load modals
  responsive.css              # media queries only
```

After CSS splitting:
- Import CSS from `src/main.ts` or a single `src/styles/index.css`.
- Keep cascade order stable: base -> dish -> windows -> panels -> modals -> responsive.
- Do not move CSS into `index.html` inline styles.

## Recommended Refactor Order

1. Extract pure utility/UI helpers from `src/main.ts`:
   - `hud/toasts.ts`
   - `hud/tooltips.ts`
   - `hud/windows.ts`
2. Extract formatting-only HUD modules:
   - `hud/hover-info.ts`
   - `hud/state-panel.ts`
   - `hud/entity-panel.ts`
   - `hud/directives-panel.ts`
   - `hud/metabolism-panel.ts`
3. Extract app domains from `src/main.ts`:
   - `app/dishes.ts`
   - `app/save-load.ts`
   - `app/tutorial.ts`
   - `app/drop-tools.ts`
4. Split `src/styles.css` by panel/domain while preserving visual output.
5. Split `src/render/PetriDishRenderer.ts` after app/HUD code is stable.
6. Split `src/core/simulation.ts` only after renderer and app boundaries are clear.

## Domain Boundaries

### Core Simulation
Owned by `src/core/`.

Allowed:
- `SimulationState`, `Cell`, `Resource`, `Hazard`, `Block`
- ticks, metabolism, movement, sensing, spawning, collision constraints
- save/import normalization for simulation state

Not allowed:
- DOM nodes
- CSS classes
- Three.js meshes/materials
- window layout or localStorage save slots

### Renderer
Owned by `src/render/`.

Allowed:
- Three.js scene graph, materials, shaders, geometry
- resource/cell/hazard/block visuals
- camera zoom/pan/reset
- screen-to-world and picking

Not allowed:
- mutating simulation state except through read-only rendering assumptions
- localStorage
- tutorial milestone logic
- DOM HUD updates

### App/HUD
Owned by `src/app/` and `src/hud/`.

Allowed:
- DOM queries and event listeners
- window layout, panels, buttons, tooltips, toasts
- save/load payload assembly
- tutorial UI orchestration
- formatting values for display

Not allowed:
- direct Three.js material/geometry creation
- low-level simulation physics/metabolism logic

## File Naming Rules

- Use kebab-case: `save-load.ts`, `hover-info.ts`, `game-panel.css`.
- Folder name supplies the broad domain; file name supplies the component.
- Avoid redundant prefixes: `hud/hover-info.ts`, not `hud/hud-hover-info.ts`.
- Keep existing class names only when moving code exactly.

## Split Criteria

Split when:
- a file exceeds 500 lines
- unrelated domains are mixed in one file
- a section can be moved with minimal dependencies
- an extracted module can expose a small, named API

Do not split when:
- the split would create circular imports
- a helper is only meaningful inside one class
- the move requires behavior rewrites
- tests cannot be run afterward

## Current Verification Commands

Run from `game-ideas/cell-evolution/`:

```bash
npm run build
npm test
```

`npm test` runs `tests/smoke.mjs`, starts Vite, opens the game with Playwright, checks major UI flows, and fails on console errors.

Expected known warning:
- Vite may warn that the main chunk is larger than 500 kB. This warning is currently accepted unless the refactor specifically addresses bundling.

## Refactoring Workflow

1. Read the full source file being split.
2. Identify natural sections and dependencies.
3. Choose one domain to extract.
4. Create the target file with moved code only.
5. Add imports/exports.
6. Update references in the original file.
7. Run `npm run build`.
8. Run `npm test`.
9. If behavior changed, stop and fix before continuing.
10. Log the refactor.

## Refactor Log

Write log entries under:

```text
docs/refactor/history/refactor-archive-YYYY-MM-DD.md
```

Create directories if needed.

Log format:

```markdown
## <Domain> extraction - <short description>

### Motivation
<why this split helps>

### Old files changed
- `src/main.ts` - moved <section/domain>

### New files created
- `src/hud/hover-info.ts` - hover title/detail formatting

### Behavior
No behavior changes intended.

### Verification
- `npm run build` - pass
- `npm test` - pass
```

## Safety Notes

- Do not delete `dist/`, `node_modules/`, screenshots, or test output unless the user explicitly asks.
- Do not move files outside `game-ideas/cell-evolution/`.
- Do not rename public DOM ids/classes unless all references and smoke tests are updated.
- Preserve save compatibility where possible. If save payload shape changes, keep import fallback for older saves.
- Keep tutorial state, dish state, window layout, and save slots stable during refactors.
