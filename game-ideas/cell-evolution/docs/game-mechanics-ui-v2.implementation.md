# Game Mechanics UI V2 Implementation Plan

This plan redesigns only the selected-cell Homeostasis window after the mechanics work in `game-mechanics-v2.implementation.md` is complete. Other windows and game elements should remain unchanged unless a small compatibility hook is required to display v2 metabolism data.

## Scope

Redesign:

- selected cell Homeostasis window content
- Homeostasis-specific markup in `index.html`
- Homeostasis-specific HUD formatting/sync code
- Homeostasis-specific styles
- tooltips for Homeostasis concepts

Do not redesign:

- Game window
- Dish State window, except existing selected-cell meters if they are already shared
- Navigation window
- Hover window
- Drop tools
- Save/load windows
- renderer/game visuals
- dish layout, zoom, dragging, selection, or window stacking

## Dependency on Mechanics Phase

Start this UI phase only after core v2 provides a stable selected-cell metabolism snapshot. The UI should consume that snapshot rather than duplicating metabolic calculations.

Required mechanics data:

- current pools:
  - glucose
  - glucose6Phosphate
  - glycogen
  - oxygen
  - pyruvate
  - lactate
  - ATP
  - amino acids
  - protein
  - ROS
  - damage
  - health
- current rates:
  - glucose import / G6P conversion
  - glycolysis
  - respiration
  - fermentation
  - ATP net
  - oxygen use
  - ROS generation and mitigation
  - amino import
  - protein synthesis
  - autophagy
  - gluconeogenesis
  - glycogen storage/mobilization
  - damage rate
  - health rate
- derived statuses:
  - oxygen efficiency state
  - fermentation active
  - autophagy active
  - oxidative stress
  - structural integrity
  - energy collapse risk
  - growth/division readiness

## UI Goals

The Homeostasis window must teach the player these relationships:

- Environmental glucose becomes internal glucose and glucose-6-phosphate.
- Glycolysis can generate some ATP without oxygen.
- Oxygen does not create ATP alone; oxygen makes pyruvate respiration more efficient.
- Respiration yields more ATP but creates ROS.
- Fermentation is the low-oxygen fallback: lower ATP, little/no ROS.
- Glycogen is stored glucose and can be mobilized during low energy.
- Amino acids are imported building blocks.
- ATP powers amino-acid use for protein synthesis, repair, sensors, enzymes, and growth.
- Autophagy is emergency protein breakdown into amino acids under stress/starvation.
- Health is an integrated result of ATP, amino acids, protein integrity, ROS, damage, and starvation.

The player should feel they can intervene at specific control points in a complex system:

- ATP production / respiration priority
- glucose storage vs mobilization priority
- amino-acid import priority
- repair/biosynthesis allocation

Every control movement should visibly affect:

- flow intensity
- predicted deltas
- warnings/status labels
- health pressure badges where relevant

## Information Architecture

Use three vertical sections in the Homeostasis window.

### Section 1: Health Outcome

Keep the current top health bar concept because it works.

Display:

- Health percentage and meter
- Health trend: improving, stable, declining
- impact chips:
  - ATP
  - Amino Acids
  - Protein
  - ROS
  - Damage
  - Autophagy
  - Fermentation if active

Behavior:

- Green chips are helping health.
- Yellow chips are limiting health.
- Red chips are actively damaging health.
- Tooltip explains that health is the final homeostasis outcome, not a separate resource the player directly spends.

Files likely touched:

- `src/hud/entity-panel.ts`
- `src/styles/entity-panel.css`

### Section 2: Metabolic Flow Map

Replace the current resource-card relationship diagram with a compact flow map inspired by the v2 flowchart, but sized for the existing game window.

Suggested layout:

```text
External / Internal Inputs

Glucose -> G6P -> Glycolysis -> Pyruvate -> Respiration -> ATP
                         \              \-> Fermentation -> low ATP
Oxygen -------------------^

G6P <-> Glycogen

Amino Acids + ATP -> Protein / Repair -> Health
Protein -> Autophagy -> Amino Acids

ROS + Damage -> Health pressure
```

Represent as grouped lanes, not as a single left-to-right row of resource cards:

- Energy lane:
  - Glucose
  - G6P
  - Glycolysis
  - Pyruvate
  - ATP
  - oxygen booster branch into Respiration
  - fermentation fallback branch
- Storage lane:
  - G6P and Glycogen bidirectional link
- Building/repair lane:
  - Amino Acids
  - Protein / Repair
  - Health
  - Autophagy emergency loop
- Stress lane:
  - ROS
  - Damage
  - Health pressure

Use icons from current resource blocks where available:

- Glucose icon
- Oxygen icon
- ATP icon
- Amino-acid icon
- Glycogen icon

Add simple symbolic nodes for:

- G6P
- Pyruvate
- Fermentation
- Protein
- Damage

Do not create a large infographic image; keep it DOM/CSS so values can update live.

Files likely touched:

- `index.html`
- `src/hud/metabolism-panel.ts`
- `src/styles/metabolism-panel.css`
- `src/styles/metabolism-flow.css`

### Section 3: Intervention Controls

Controls should sit on or beside the specific flow they influence.

Controls:

- Respiration priority:
  - attached to Pyruvate -> Respiration -> ATP
  - label states: `Ferment more`, `Balanced`, `Respire more`
  - conveys: higher oxygen use means higher ATP yield when oxygen is available, more ROS.
- Storage priority:
  - attached to G6P <-> Glycogen
  - label states: `Mobilize`, `Balanced`, `Store`
  - conveys: store surplus glucose or release reserve for ATP.
- Amino import:
  - attached to external amino acids -> AA pool
  - label states: `Low import`, `Balanced`, `High import`
  - conveys: more building blocks for repair/growth.
- Repair allocation:
  - attached to ATP + AA -> Protein/Repair -> Health
  - label states: `Growth`, `Balanced`, `Repair`
  - conveys: spend more on repair/antioxidants or leave more for growth.

Reuse the existing draggable semantic label-handle pattern, but place each handle in context rather than in a dense table.

## Visual Design Rules

Use the existing dark microscope UI style, but avoid implying false causality.

Rules:

- Do not place Oxygen as if Glucose creates it.
- Do not place Amino Acids as if ATP creates them.
- Make Oxygen visually a booster/input to respiration.
- Make Fermentation visibly an alternative fallback branch from pyruvate.
- Make Glycogen visibly a reserve loop with glucose/G6P.
- Make Health the outcome of repair and damage balance.
- Keep cards at 8px radius or less.
- Keep text compact and readable.
- Avoid nested cards.
- Avoid a full landing-page/infographic feel; this is an operational game panel.

Color mapping:

- Yellow: ATP / energy flow
- Green: building blocks / repair / health-positive flow
- Blue: oxygen / respiration booster
- Orange: storage / glycogen
- Red: ROS / damage / stress
- Purple: fermentation / alternative anaerobic path
- Gray: inactive/zero flow

## Data Contract

The Homeostasis UI should receive a single snapshot object from core/HUD sync. Proposed shape:

```ts
type HomeostasisSnapshot = {
  pools: {
    glucose: number;
    glucose6Phosphate: number;
    glycogen: number;
    oxygen: number;
    pyruvate: number;
    lactate: number;
    atp: number;
    aminoAcids: number;
    protein: number;
    ros: number;
    damage: number;
    health: number;
  };
  rates: {
    glycolysis: number;
    respiration: number;
    fermentation: number;
    atp: number;
    oxygen: number;
    glycogen: number;
    aminoAcids: number;
    protein: number;
    autophagy: number;
    gluconeogenesis: number;
    ros: number;
    damage: number;
    health: number;
  };
  states: {
    fermentationActive: boolean;
    respirationLimitedByOxygen: boolean;
    oxygenWouldImproveYield: boolean;
    autophagyActive: boolean;
    oxidativeStress: boolean;
    repairLimitedByATP: boolean;
    repairLimitedByAminoAcids: boolean;
    structuralRisk: boolean;
    growthReady: boolean;
  };
};
```

Implementation preference:

- Core owns snapshot computation.
- HUD renders snapshot.
- UI does not duplicate metabolism math.

## File-Level Plan

### Step 1: Add Snapshot Consumption

- Update `src/hud/metabolism-panel.ts` to consume the core v2 snapshot.
- Keep existing method names where practical so `src/app/hud-sync.ts` remains stable.
- Remove HUD-side copied metabolism prediction once core snapshot exists.

Validation:

- Build.
- Existing Homeostasis panel still updates before layout changes.

### Step 2: Replace Homeostasis Markup

- Update only the selected-cell Homeostasis block in `index.html`.
- Keep existing IDs that app code depends on where reasonable.
- Add new IDs/classes for v2 nodes:
  - `g6p-rate`
  - `pyruvate-rate`
  - `protein-rate`
  - `damage-rate`
  - `fermentation-rate`
  - `respiration-rate`
  - related delta elements.

Compatibility:

- Existing `atp-core`, `glucose-rate`, `glycogen-rate`, `oxygen-rate`, `amino-rate`, `ros-delta`, `autophagy-delta`, and `light-factor` can remain if useful.

### Step 3: Build Flow Map CSS

- Create or extend styles in:
  - `src/styles/metabolism-panel.css`
  - `src/styles/metabolism-flow.css`
- Use CSS grid with named areas for lanes.
- Use stable node dimensions so labels and deltas cannot resize the panel unexpectedly.
- Make paths animated only where they represent current flow.
- Use `data-flow="good|bad|flat|active|limited"` and CSS variables for intensity.

Responsive rule:

- The panel should remain readable at the current default window width.
- Long labels should wrap within nodes, not overlap other nodes.

### Step 4: Reposition Controls Onto Flows

- Keep `data-control` attributes so existing binding in `src/app/app-events.ts` can continue.
- Move each range input/label into the relevant lane.
- Keep semantic label handles.
- Update labels:
  - `Ferment more / Balanced / Respire more`
  - `Mobilize / Balanced / Store`
  - `Low import / Balanced / High import`
  - `Growth / Balanced / Repair`

Files:

- `src/hud/directives-panel.ts` or rename/extract the control-label function if it becomes Homeostasis-specific.
- `src/styles/metabolism-flow.css`

### Step 5: Health Impact Strip V2

- Extend the current health strip to include:
  - `Protein`
  - `Damage`
  - `Fermentation`
  - oxygen limitation when relevant
- Keep it compact.
- Tooltip explains causal health model.

Files:

- `src/hud/entity-panel.ts`
- `src/styles/entity-panel.css`

### Step 6: Tooltips

Add tooltips to major nodes:

- Glucose: external fuel, becomes G6P.
- G6P: central glucose hub for glycolysis/storage.
- Oxygen: respiration booster, not fuel by itself.
- Pyruvate: branch point.
- Respiration: high ATP, ROS cost.
- Fermentation: low ATP, oxygen-independent fallback.
- Glycogen: stored glucose reserve.
- Amino acids: imported building blocks.
- Protein/repair: ATP-powered use of amino acids for health.
- Autophagy: emergency breakdown of protein into amino acids.
- ROS/damage: harms health unless repaired.

### Step 7: Remove Redundant/Confusing UI

Remove or replace:

- any visual that implies Glucose -> Oxygen -> ATP -> Amino Acids
- generic `Source / Priority / Produces / Tradeoff` table if it duplicates the flow map
- redundant Autophagy top-row detail; keep Autophagy in the stress/emergency area

Keep:

- top Health bar and influencing factors
- Gen/Size bottom vitals strip if still useful
- Photosynthesis, ROS, Autophagy gauges if they remain clear and do not duplicate the main map

## Testing Plan

Run after each meaningful UI step:

- `npm run build`
- `npm test`

For visible changes:

- Start Vite.
- Use Playwright screenshot checks for selected cell Homeostasis.
- Inspect screenshot manually.
- Verify:
  - no overlapping text
  - oxygen is shown as an input/booster to respiration
  - fermentation is visible as fallback
  - glycogen is a reserve loop
  - amino acids are building blocks
  - ATP powers repair/health
  - health strip remains prominent
  - sliders are draggable and visibly update labels
  - other windows remain visually unchanged

Interaction checks:

- Select a cell.
- Drag each Homeostasis slider.
- Confirm the matching label handle moves.
- Confirm rates/status labels update.
- Confirm Navigation sliders/selects are unaffected.
- Confirm window dragging/stacking is unaffected.

## Rollout Boundary

The UI phase is complete when:

- Homeostasis explains v2 mechanics without implying false resource production.
- Slider intervention points are visually attached to their affected processes.
- Health makes visible what helps or hurts it.
- Build and smoke tests pass.
- A Playwright screenshot confirms the selected-cell Homeostasis window is readable.
- No other UI windows were redesigned.

## Risks and Mitigations

- Risk: compact flow map becomes too dense.
  - Mitigation: use grouped lanes and short labels; move deeper explanations to tooltips.
- Risk: player confuses pools with processes.
  - Mitigation: visually distinguish resource nodes from process nodes.
- Risk: oxygen still appears as ATP source by itself.
  - Mitigation: connect oxygen only into respiration/efficiency, not into ATP directly.
- Risk: HUD math duplicates core.
  - Mitigation: use shared core snapshot.
- Risk: current window width is too small.
  - Mitigation: prefer vertical lanes over a wide infographic; use wrapping process labels and stable dimensions.
