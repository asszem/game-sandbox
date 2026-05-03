# lean-ctx — Context Engineering Layer

PREFER lean-ctx MCP tools over native equivalents for token savings:

| PREFER | OVER | Why |
|--------|------|-----|
| `ctx_read(path)` | Read / cat / head / tail | Cached, 8 compression modes, re-reads ~13 tokens |
| `ctx_shell(command)` | Shell / bash / terminal | Pattern compression for git/npm/cargo output |
| `ctx_search(pattern, path)` | Grep / rg / search | Compact, token-efficient results |
| `ctx_tree(path, depth)` | ls / find / tree | Compact directory maps |
| `ctx_edit(path, old_string, new_string)` | Edit (when Read unavailable) | Search-and-replace without native Read |

Edit files: use native Edit/StrReplace if available. If Edit requires Read and Read is unavailable, use ctx_edit.
Write, Delete, Glob — use normally. NEVER loop on Edit failures — switch to ctx_edit immediately.

# Repository Guidelines

## Repository Intent

This is a game development sandbox for quickly building and testing browser-based game ideas. Ideas that mature may later move into their own repositories. Each idea must live under `game-ideas/<idea-name>/`, for example `game-ideas/arena-dash/`.

The user will always specify the active idea. Put all related code, assets, tests, notes, and configuration inside that idea folder unless the user explicitly asks for shared repo-level tooling.

Use WebGL from the start for browser prototypes so rendering performance does not become a blocker. Prefer Three.js or another proven WebGL library for 3D or layered visual scenes unless the user asks for raw WebGL.

## Project Structure & Module Organization

Use this layout:

- `game-ideas/<idea-name>/` for each isolated prototype.
- `src/` inside the idea folder for game code, scenes, systems, and UI modules.
- `public/` for static files copied directly to the built site.
- `src/assets/` or `public/assets/` for images, audio, fonts, sprites, and maps.
- `tests/` for tests tied to that prototype.

Keep gameplay logic separate from rendering and DOM code where practical. Put reusable state or physics helpers in `src/core/` and screen-specific code in `src/scenes/`.

## Build, Test, and Development Commands

No shared package scripts are defined yet. Each idea may define commands in its own `package.json`:

- `npm install` installs dependencies.
- `npm run dev` starts the local development server.
- `npm run build` creates a production build.
- `npm test` runs tests.
- `npm run lint` checks formatting and code quality.

Run commands from the active idea folder unless documented otherwise.

## Coding Style & Naming Conventions

Use TypeScript or modern JavaScript consistently within each prototype. Prefer 2-space indentation, semicolons, and single quotes unless the formatter says otherwise. Use `camelCase` for variables and functions, `PascalCase` for classes and components, and kebab-case for folders and asset files such as `player-idle.png`.

Keep modules small and purpose-driven. Keep files under 400-500 lines; above that, refactor into focused modules. Do not commit generated files, caches, local env files, or build artifacts covered by `.gitignore`.

## Testing Guidelines

Add focused tests for gameplay systems when behavior can be verified without a browser. Use `*.test.ts` or `*.spec.ts` under the active idea's `tests/` folder or next to the module. For browser-facing changes, include a smoke test that loads the game, checks for console errors, and verifies the canvas or UI renders.

Smoke tests must fail fast. Keep explicit browser/action timeouts short enough that a stuck UI interaction does not run for minutes; prefer a total smoke-test cap around one minute or less unless the user asks for a long soak.

When the user asks to delegate testing, run verification in a sub-agent so the main agent can keep implementing or reviewing non-overlapping work. Keep delegated test tasks read-only unless explicitly assigned a separate implementation scope.

## Commit & Pull Request Guidelines

There is no existing commit history, so use concise imperative messages, for example `Add arena dash movement` or `Fix card tactics preload errors`. Keep each commit focused.

Pull requests should include a summary, test results, linked issue if applicable, and screenshots or short recordings for visible gameplay or UI changes.

## Agent-Specific Instructions

Agents should confirm the active game idea before creating or modifying prototype files. If the active idea is unclear, ask for it rather than placing files at the repository root.

Development is done entirely by AI agents. Optimize code for agent comprehension and modification: explicit names, clear module boundaries, low coupling, small files, deterministic tests, and minimal hidden side effects.

Load and follow `LEAN-CTX.md` when it exists in the repo or parent context. Prefer lean-ctx MCP tools for compact reads, searches, shell summaries, and directory maps. Use normal edit/write tools for file changes.

## Active Prototype: Cell Evolution

The current active idea is `game-ideas/cell-evolution`. Run all commands for this prototype from that folder unless the user explicitly asks for repo-level work.

Use these commands:

- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server.
- `npm run build` runs TypeScript and creates a production build.
- `npm test` runs the smoke test in `tests/smoke.mjs`.

Current module layout:

- `src/main.ts` is the app bootstrap and active selection/event callback orchestrator.
- `src/app/` owns DOM event binding, dish lifecycle, dish placement, save/load application, tutorial controller/world setup, drop tools, HUD sync sequencing, and app-level controllers.
- `src/core/` owns simulation state and gameplay rules. Keep it DOM-free and renderer-free. Helpers already exist for entity factories, constraints, death/remains, sensing, metabolism, resource transport, spawning, open-point placement, environment scan, light cycle, RNG, vectors, and types.
- `src/hud/` owns panel formatting, window/toast/tooltip helpers, directives controls, Game panel stats, metabolism display, hover info, and selected entity/dish state presentation.
- `src/render/` owns Three.js rendering. `PetriDishRenderer.ts` is the render facade; visual helpers already exist for blocks, cells, materials, resources, hazards, effects, picking, sensor overlay, shaders, textures, and render types.
- `src/styles/` is split by domain and imported through `src/styles/index.css`.
- `docs/refactor/history/refactor-archive-2026-05-02.md`, `progress.md`, and `refactor/REFACTOR-PROMPT.md` track refactor history and should be updated after structural refactor slices.

Keep files near or below 400-500 lines. The current largest files are intentionally near the threshold: `src/render/PetriDishRenderer.ts`, `src/core/simulation.ts`, and `src/main.ts`. Prefer extracting cohesive helpers over rewriting behavior.

For behavior changes:

- Preserve existing tutorial and save/load behavior unless the user asks otherwise.
- Do not put DOM/window code in `src/core/`.
- Do not put simulation rules in HUD or render modules.
- When editing UI/gameplay behavior, run `npm run build` and `npm test`.
- For visible or interaction-heavy changes, also run a browser smoke check or Playwright screenshot check when practical.
