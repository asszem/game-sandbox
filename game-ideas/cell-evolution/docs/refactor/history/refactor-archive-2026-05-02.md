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
