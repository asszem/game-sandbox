# Game Mechanics V2 Implementation Plan

This plan implements the mechanics described in `docs/game-mechanics-v2.spec.md` and the companion flowchart image, without redesigning the Homeostasis UI in this phase. The goal is to replace the current simplified glucose/oxygen/ATP loop with a clearer, biologically plausible resource network that remains playable and tunable.

## Scope

Phase 1 changes only core simulation mechanics, data model, balancing constants, and focused tests. Existing windows, controls, dish management, navigation behavior, rendering, save/load entry points, and non-Homeostasis UI should remain functionally unchanged except where they need compatibility with the new cell fields.

The Homeostasis window redesign is intentionally deferred to `game-mechanics-ui-v2.implementation.md`.

## Current System Summary

The current metabolism is concentrated in:

- `src/core/types.ts`: `Cell` resource fields and rates.
- `src/core/entities.ts`: cell creation and import normalization.
- `src/core/resource-transport.ts`: overlapping resource uptake.
- `src/core/metabolism.ts`: photosynthesis, glycogen packing/release, ATP production, repair, autophagy, movement/sensor costs, health updates.
- `src/core/simulation.ts`: tick order, poison damage, collision/predation, division.
- `src/hud/metabolism-panel.ts`: mirrors current metabolism to display predicted deltas.

Important current simplifications that v2 will replace:

- Free glucose is used directly as the ATP substrate.
- Oxygen shortage reduces ATP almost to zero instead of falling back to fermentation.
- Amino acids are only a repair/growth material and emergency autophagy fuel.
- Health is adjusted by several independent local rules rather than a single damage/homeostasis model.
- There is no explicit glucose-6-phosphate, pyruvate, lactate/fermentation, protein/structural integrity, damage, or signaling state.

## Target Mechanics Model

### Cell State Additions

Add these fields to `Cell` in `src/core/types.ts`:

- `glucose6Phosphate`: conversion hub fed by glucose, glycogen mobilization, and gluconeogenesis.
- `pyruvate`: glycolysis output that branches into respiration or fermentation.
- `lactate`: fermentation byproduct/readout for anaerobic metabolism.
- `protein`: structural and functional protein integrity pool.
- `damage`: accumulated cell damage from ROS and stressors.
- `stressSignal`: internal stress/secretion pressure used for future signaling and AI.
- `respirationRate`, `glycolysisRate`, `fermentationRate`, `gluconeogenesisRate`, `glycogenesisRate`, `glycogenMobilizationRate`, `biosynthesisRate`, `proteinSynthesisRate`, `antioxidantRate`, `damageRate`, `healthRate`: per-tick rates for UI and tests.

Keep existing public fields for compatibility:

- `atp`, `glucose`, `glycogen`, `aminoAcids`, `oxygen`, `ros`, `health`, `mass`, `autophagyRate`, and current control fields.
- `glucose` remains the free imported glucose pool, but metabolism should first move it into `glucose6Phosphate`.
- `energy` remains an alias of `atp` until all legacy references are removed.

### Save/Load Compatibility

Update import normalization in `src/core/entities.ts` so old saves receive sensible defaults:

- `glucose6Phosphate = 0`
- `pyruvate = 0`
- `lactate = 0`
- `protein = clamp(45 + mass * 30, 20, 100)` if missing
- `damage = clamp(100 - health * 100, 0, 100)` if missing
- all new rates default to `0`
- `stressSignal = 0`

Do not invalidate existing save slots.

## Processing Pipeline

Replace the body of `applyCellMetabolism` with a staged v2 pipeline. Keep the exported function name initially to avoid broad call-site churn.

Recommended internal step order:

1. `resetMetabolicRates(cell, before)`
2. `applyPhotosynthesis(cell, lightFactor)`
3. `transferFreeGlucoseToG6P(cell)`
4. `mobilizeGlycogenIfNeeded(cell)`
5. `runGlycolysis(cell)`
6. `branchPyruvate(cell)`
7. `runRespiration(cell)`
8. `runFermentation(cell)`
9. `payMovementAndSensorCosts(cell)`
10. `runAntioxidantDefense(cell)`
11. `runAutophagyIfStressed(cell)`
12. `runBiosynthesis(cell)`
13. `runGluconeogenesisIfNeeded(cell)`
14. `storeGlycogenSurplus(cell)`
15. `applyDamageAndStress(cell)`
16. `computeOverallHealth(cell)`
17. `clampAndRecordRates(cell, before)`

Keep the function DOM-free and renderer-free.

## Detailed Mechanics

### External Resource Uptake

Keep overlap-based resource consumption in `src/core/resource-transport.ts`, but route stores into v2 pools:

- Glucose resources increase `glucose`; metabolism converts free glucose into `glucose6Phosphate`.
- Oxygen resources increase `oxygen`; oxygen should improve ATP efficiency, not be the only way to make ATP.
- Amino-acid resources increase `aminoAcids`; they remain external building blocks, not directly created by ATP.
- Oxygen uptake may still add a small ROS cost, but reduce it if it makes oxygen seeking feel punishing. ROS should mainly come from respiration intensity.

Gameplay intent:

- A cell with plenty of glucose and amino acids should prefer oxygen because oxygen makes ATP production more efficient.
- A cell with no oxygen should still survive for a while through fermentation, but with lower ATP yield and likely slower growth/repair.

### Glucose-6-Phosphate Hub

Free glucose should not be burned directly.

Rules:

- Move up to a per-tick amount from `glucose` into `glucose6Phosphate`.
- This transfer should be inexpensive and mostly controlled by substrate availability.
- `glucose6Phosphate` can feed glycolysis or glycogen synthesis.
- Glycogen mobilization and gluconeogenesis also feed `glucose6Phosphate`.

Suggested starting balance:

- `glucoseToG6P = min(glucose, 1.4 + harvest * 0.35)`
- `glucose -= glucoseToG6P`
- `glucose6Phosphate += glucoseToG6P`

### Glycolysis

Glycolysis is always available if `glucose6Phosphate` exists.

Rules:

- Consume `glucose6Phosphate`.
- Produce small ATP and pyruvate.
- This is the anaerobic baseline path.

Suggested starting balance:

- `g6pUsed = min(glucose6Phosphate, 1.0 + oxygenMetabolism * 0.25)`
- `atp += g6pUsed * 0.65`
- `pyruvate += g6pUsed * 0.9`

### Pyruvate Branching

Pyruvate should split between respiration and fermentation.

Rules:

- Respiration consumes pyruvate and oxygen.
- Fermentation consumes remaining pyruvate and produces small ATP.
- Low oxygen shifts more pyruvate into fermentation.

Suggested starting balance:

- `respirationDemand = pyruvate * (0.2 + oxygenMetabolism * 0.8)`
- `oxygenLimitedRespiration = min(respirationDemand, oxygen / oxygenPerPyruvate)`
- remaining pyruvate goes to fermentation, capped by a fermentation throughput.

### Respiration

Respiration produces high ATP but also ROS.

Rules:

- Inputs: pyruvate + oxygen.
- Outputs: ATP + ROS.
- Higher `oxygenMetabolism` means higher throughput and higher ROS risk.

Suggested starting balance:

- `oxygenPerPyruvate = 0.45`
- `atp += respiredPyruvate * (2.2 + oxygenMetabolism * 0.9)`
- `oxygen -= respiredPyruvate * oxygenPerPyruvate`
- `ros += respiredPyruvate * (0.08 + oxygenMetabolism * 0.18)`

### Fermentation

Fermentation is the oxygen-independent fallback.

Rules:

- Inputs: pyruvate.
- Outputs: low ATP + lactate.
- No ROS.
- Allows survival without oxygen but cannot sustain high movement, repair, or division.

Suggested starting balance:

- `fermentedPyruvate = min(remainingPyruvate, 0.9)`
- `atp += fermentedPyruvate * 0.45`
- `lactate += fermentedPyruvate * 0.6`

Lactate can decay slowly each tick so it acts as a recent anaerobic stress indicator.

### Glycogen Storage and Mobilization

Keep the player-facing `glucoseTransport` control as "storage priority", but route through `glucose6Phosphate`.

Storage:

- If ATP is adequate and `glucose6Phosphate` is surplus, store it as glycogen.
- Storage costs ATP.

Mobilization:

- If ATP or `glucose6Phosphate` is low, convert glycogen back to `glucose6Phosphate`.
- High storage priority raises the threshold for storing and lowers eagerness to mobilize; low storage priority does the opposite.

Suggested starting balance:

- Store when `glucose6Phosphate > 3 + (1 - glucoseTransport) * 3` and `atp > 8`.
- Mobilize when `atp < 24 || glucose6Phosphate < 0.8`.

### Amino Acids, Protein, and Biosynthesis

Add `protein` as the structural integrity pool. Amino acids are the building blocks; ATP powers synthesis and maintenance.

Rules:

- Protein synthesis consumes ATP + amino acids.
- Protein improves structural integrity and supports health.
- Other biosynthesis consumes ATP + amino acids and contributes to mass/growth when conditions are good.
- If ATP is low, biosynthesis stalls.

Suggested starting balance:

- `proteinRepairNeed = max(0, 80 - protein)`
- `proteinSynthesis = min(aminoAcids, atp * 0.35, 0.08 + ribosomeActivity * 0.22, proteinRepairNeed * 0.04)`
- `protein += proteinSynthesis`
- `aminoAcids -= proteinSynthesis`
- `atp -= proteinSynthesis * 0.9`

Growth should require:

- ATP high
- amino acids adequate
- protein adequate
- damage low

### Autophagy

Autophagy should be conditional, not baseline.

Triggers:

- ATP below a critical threshold
- high damage
- high stress
- glucose/glycogen/G6P depleted

Rules:

- Autophagy converts protein into amino acids.
- It provides emergency resources but damages structural integrity.
- It should not directly consume amino acids to produce ATP as the primary model. If ATP support is needed, amino acids can later enter gluconeogenesis.

Suggested starting balance:

- Trigger if `atp < 10 || damage > 45 || stressSignal > 50`.
- `proteinBroken = min(protein - 12, 0.2 + stressFactor * 0.8)`
- `protein -= proteinBroken`
- `aminoAcids += proteinBroken * 0.75`
- `damage += proteinBroken * 0.12`

### Gluconeogenesis

Gluconeogenesis should be an emergency bridge from amino acids to the glucose hub, not a direct amino-acid-to-glycogen conversion.

Triggers:

- Low `glucose6Phosphate`
- Low glucose/glycogen
- ATP not completely collapsed
- amino acids available

Rules:

- Consumes amino acids and ATP.
- Produces `glucose6Phosphate`.
- This can then feed glycolysis or later glycogen storage.

Suggested starting balance:

- Trigger if `glucose6Phosphate < 0.6 && glucose < 3 && glycogen < 4 && aminoAcids > 12 && atp > 6`.
- `aminoUsed = min(aminoAcids - 10, 0.35)`
- `atp -= aminoUsed * 0.45`
- `glucose6Phosphate += aminoUsed * 0.65`

### ROS and Antioxidant Defense

ROS should primarily come from respiration and poison/stressors.

Rules:

- Respiration creates ROS.
- High ROS increases damage.
- Antioxidant defense consumes ATP and possibly protein/amino acids to reduce ROS.
- Repair allocation should influence antioxidant defense.

Suggested starting balance:

- `antioxidantCapacity = min(atp, aminoAcids, 0.05 + ribosomeActivity * 0.18)`
- if `ros > 18`, reduce ROS by `antioxidantCapacity * (0.7 + ribosomeActivity * 0.8)`
- consume ATP and a small amino-acid amount.

### Stressors, Damage, and Signaling

Poison hazards currently directly reduce health, ATP, and increase ROS in `src/core/simulation.ts`. Convert poison into stress/damage pressure while preserving immediate danger.

Rules:

- Poison overlap increases `damage`, `ros`, and `stressSignal`.
- Direct health loss should be reduced compared with current code; health should mostly fall through computed damage/homeostasis.
- High stress/damage can activate autophagy and signaling.
- `stressSignal` should decay gradually.

Suggested starting balance:

- poison overlap:
  - `damage += 0.8 * potency * (1.3 - caution * 0.3)`
  - `ros += 0.5 * potency`
  - `stressSignal += 1.2 * potency`
  - `atp -= 0.25 * potency`

### Overall Health

Health should be computed from integrated state instead of many independent deltas.

Inputs:

- ATP availability
- amino-acid availability
- protein integrity
- ROS
- damage
- resource starvation
- autophagy activity

Rules:

- Track health as a slowly changing value, not a direct formula overwrite.
- Good state increases health modestly.
- Bad state decreases health faster.
- Death still occurs when health reaches 0, ATP drops below collapse threshold, or mass/protein collapse.

Suggested health pressure:

- `energyScore = clamp(atp / 65, 0, 1.2)`
- `buildingScore = clamp(aminoAcids / 45, 0, 1.1)`
- `proteinScore = clamp(protein / 70, 0, 1.1)`
- `damagePressure = clamp(damage / 60, 0, 1.4)`
- `rosPressure = clamp(max(0, ros - 28) / 60, 0, 1.2)`
- `starvationPressure` from low glucose, G6P, glycogen, ATP.

Apply:

- `health += positiveHomeostasis * 0.003`
- `health -= negativePressure * 0.006`

This should be tuned so cells die less abruptly than current rules but still spiral downward under sustained stress.

### Failure States

Implement explicit state detection helpers in core:

- `energyCollapse`: ATP near zero and no glucose/glycogen/G6P.
- `oxidativeOverload`: ROS above threshold and antioxidant capacity insufficient.
- `structuralCollapse`: protein very low or damage very high.
- `resourceStarvation`: no glucose/glycogen/G6P and no amino acids.

Use these for:

- health pressure
- autophagy trigger
- future UI badges
- tests

### Division and Growth

Update division eligibility to include v2 health/protein/damage:

- Existing ATP, amino-acid, mass, split, and population requirements remain.
- Add `protein > 70`.
- Add `damage < 18`.
- Add `ros < 35`.

This prevents high-ATP damaged cells from dividing unrealistically.

## Player/AI Decision Impact

Keep existing controls for phase 1, but change their mechanical meanings:

- `oxygenMetabolism`: mitochondrial respiration priority. Higher means more pyruvate routed to respiration, higher ATP yield when oxygen exists, and higher ROS.
- `glucoseTransport`: glycogen storage vs mobilization bias.
- `aminoTransport`: external amino-acid import intensity.
- `ribosomeActivity`: biosynthesis/repair allocation. Higher means more ATP/amino acids spent on protein repair and antioxidant response; lower means more growth when safe.
- `sensorBudget` and `movementBudget`: unchanged in phase 1 except their ATP costs should use v2 ATP.
- `searchPreference`: unchanged, but AI/resource attraction should benefit from the new needs:
  - oxygen need rises when glucose/G6P/pyruvate are available and ATP demand is high.
  - glucose need includes low G6P/glycogen.
  - amino need includes low amino acids, low protein, high damage.

## Implementation Steps

### Step 1: Types and Normalization

- Update `src/core/types.ts` with v2 fields and rates.
- Update `src/core/entities.ts` default cell creation.
- Update import/normalization for old saves.
- Ensure `CellSimulation.importState` and random scenario creation still work.

Validation:

- `npm run build`
- focused unit checks if test harness exists or small deterministic test added under `tests/`.

### Step 2: Extract Pure Metabolism Helpers

- Keep `applyCellMetabolism` as the public function.
- Add private helper functions inside `src/core/metabolism.ts` first.
- If file exceeds the 400-500 line guidance, extract to:
  - `src/core/metabolism-v2.ts`
  - `src/core/metabolism-rates.ts`
  - or `src/core/metabolism-helpers.ts`

Validation:

- deterministic tests for glycolysis, respiration, fermentation, glycogen storage, autophagy, and health pressure.

### Step 3: Resource Uptake Routing

- Update `src/core/resource-transport.ts`.
- Keep resource visuals and drop tools unchanged.
- Preserve non-light overlap ingestion rules.

Validation:

- test that glucose raises free glucose, oxygen raises oxygen, amino acid raises amino pool/protein potential, and resource shrinking/removal still works.

### Step 4: Poison and Stress

- Update poison overlap handling in `src/core/simulation.ts`.
- Route poison into `damage`, `ros`, `stressSignal`, and moderate ATP loss.
- Reduce direct health loss so health reflects the new integrated model.

Validation:

- test poison increases damage/stress and sustained poison kills cells.

### Step 5: Navigation Need Mapping

- Update `src/core/environment-scan.ts` so oxygen is attractive when it will improve ATP yield.
- Glucose need should consider `glucose6Phosphate` and glycogen.
- Amino need should consider `protein` and damage.
- Keep search preference behavior and existing Navigation UI unchanged.

Validation:

- deterministic pull-vector tests if practical.
- smoke test that selected cells still move and sense.

### Step 6: Division and Death Rules

- Update division checks in `src/core/simulation.ts`.
- Update death checks in `src/core/cell-death.ts` to include structural collapse if needed:
  - health <= 0
  - ATP collapse below existing threshold
  - mass collapse
  - optionally `protein <= 5` or `damage >= 100`

Validation:

- tests for no division under high damage and division under healthy surplus.

### Step 7: HUD Compatibility Mirror

This is not the UI redesign. The current Homeostasis display predicts rates in `src/hud/metabolism-panel.ts`, so it must not show stale/incorrect deltas.

- Add a pure preview helper in core, ideally exported from metabolism, so HUD does not duplicate v2 math.
- Replace the HUD-side copied `configuredMetabolicRates` with the shared preview result.
- Keep current markup/classes unchanged for phase 1.

Validation:

- build and screenshot check to ensure the existing Homeostasis panel still renders.

### Step 8: Balancing Pass

Initial tuning targets:

- Cells with glucose but no oxygen should survive via fermentation for a meaningful period, but ATP should trend lower than oxygen-rich cells.
- Cells with glucose and oxygen should generate more ATP and seek oxygen if other stores are plenty.
- High respiration should visibly increase ROS and eventually damage unless repair allocation is sufficient.
- Amino-acid shortage should limit repair and protein recovery.
- Autophagy should be visibly emergency-only.
- Cells should not die too easily in a normal seeded dish.

Run repeated smoke observations:

- default dish for 30-60 seconds
- oxygen-rich vs oxygen-poor selected cell
- poison exposure
- glucose starvation
- amino-acid starvation
- high repair allocation vs low repair allocation

## Test Plan

Run after each meaningful mechanics step:

- `npm run build`
- `npm test`

Add focused tests where possible for:

- fermentation produces ATP without oxygen
- oxygen increases ATP yield from the same glucose/G6P input
- respiration generates ROS
- antioxidant defense consumes ATP/amino acids and lowers ROS
- autophagy converts protein to amino acids under stress
- gluconeogenesis consumes amino acids/ATP and creates G6P
- glycogen mobilizes under low energy
- health improves with ATP + amino acids + protein + low damage
- health declines under high ROS/damage/starvation
- division requires healthy protein/damage state

For visible/simulation behavior:

- Run the browser smoke test.
- Use Playwright screenshot checks only to confirm no current UI regressions in phase 1.

## Rollout Boundary

Do not begin the Homeostasis UI redesign until:

- v2 mechanics build and smoke tests pass
- core rate values are available through a shared preview/snapshot API
- default seeded dishes are stable enough for a short observation
- current non-Homeostasis UI remains unchanged

## Risks and Mitigations

- Risk: adding many pools makes cells too hard to understand.
  - Mitigation: expose rates as named fields and keep UI wording simple in phase 2.
- Risk: old saves break.
  - Mitigation: normalize all missing fields and keep existing fields.
- Risk: HUD duplicates core math and drifts.
  - Mitigation: export a core preview/snapshot function.
- Risk: cells die too quickly after adding damage/protein.
  - Mitigation: start with gentle damage coefficients and tune from observation.
- Risk: file size growth in `metabolism.ts`.
  - Mitigation: extract cohesive helpers once the file approaches the project threshold.
