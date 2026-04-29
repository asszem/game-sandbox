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

## Commit & Pull Request Guidelines

There is no existing commit history, so use concise imperative messages, for example `Add arena dash movement` or `Fix card tactics preload errors`. Keep each commit focused.

Pull requests should include a summary, test results, linked issue if applicable, and screenshots or short recordings for visible gameplay or UI changes.

## Agent-Specific Instructions

Agents should confirm the active game idea before creating or modifying prototype files. If the active idea is unclear, ask for it rather than placing files at the repository root.

Development is done entirely by AI agents. Optimize code for agent comprehension and modification: explicit names, clear module boundaries, low coupling, small files, deterministic tests, and minimal hidden side effects.

Load and follow `LEAN-CTX.md` when it exists in the repo or parent context. Prefer lean-ctx MCP tools for compact reads, searches, shell summaries, and directory maps. Use normal edit/write tools for file changes.
