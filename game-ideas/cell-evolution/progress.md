Original prompt: Build a WebGL cell-evolution petri dish prototype with draggable/zoomable board, realistic cells, resources, toxins, DNA directives, save/load, and windowed UI.

Progress:
- Set up the prototype as a Vite + TypeScript + Three.js browser game in `game-ideas/cell-evolution`.
- Added simulation, WebGL rendering, draggable/resizable/collapsible UI windows, save/load, tooltips, shortcuts, and metabolic controls.
- Current task: make the screenshot layout the first-load default and redefine that dish framing as 100% zoom.
- Fixed the initial camera pan to remain top-down instead of tilting the orthographic projection.

Notes:
- Run from `game-ideas/cell-evolution`.
- Dev server URL: `http://localhost:4177/`.
- Verification: `npm run build` passed; `npm test` passed; web-game client screenshot passed without console errors; full-page Playwright screenshot at 1710x936 matches the requested default HUD positions and shows `Zoom 100%`.
- Added a Hover Info window that tracks board hover targets separately from selected entities.
