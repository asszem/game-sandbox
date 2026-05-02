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
