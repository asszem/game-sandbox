# Cell Evolution Game Rules

This document describes the current gameplay and simulation rules implemented in `src/core/` and the connected HUD controls. It is a live-code spec for balancing work.

## Simulation Loop

- Each running dish advances in fixed simulation ticks.
- A tick performs, in order:
  - increment dish tick counter
  - update moving light resources and their day-cycle intensity
  - maybe spawn one ambient resource
  - update every living cell
  - resolve cell-cell collisions and predator attacks
  - resolve cell-block constraints
  - remove dead cells and spawn remains
  - clear selected cell if it died

## Dish World

- `boardRadius` is the playable simulation radius.
- Default non-random radius is `92`.
- Randomized radius is `84..104`.
- User-controlled radius is clamped to `72..128`.
- Dish radius changes simulation geometry only. Canvas size and camera zoom are separate visual controls.
- Cells and mineral blocks are clamped inside the board.

## Starting World

- Default deterministic world:
  - `boardRadius = 92`
  - `16` cells
  - `4` mineral blocks
  - `70` resources
  - `14` poison hazards
- Randomized world:
  - `9..26` cells
  - `3..6` mineral blocks
  - `45..114` resources
  - `5..26` poison hazards
- New-dish modal can override:
  - board radius
  - cell count, clamped `1..80` by simulation
  - resource counts per kind, clamped `0..100`
  - poison count, clamped `0..80`
  - mineral block count, clamped `0..24`

## Cell State

Each cell tracks:

- position and velocity
- radius, body length, mass
- health
- ATP
- glucose
- glycogen
- amino acids
- oxygen
- ROS
- autophagy rate
- current light factor
- genome traits
- homeostasis priorities:
  - glucose storage priority: `glucoseTransport`
  - repair material import: `aminoTransport`
  - ATP production intensity: `oxygenMetabolism`
  - repair allocation: `ribosomeActivity`
- navigation priorities:
  - sensor budget
  - movement budget
  - search preference

New cells start with:

- `health = 1`
- `ATP = 80`
- `glucose = 60`
- `glycogen = 30`
- `aminoAcids = 70`
- `oxygen = 50`
- `ROS = 5`
- `mass = 0.45..1.05`
- `radius = 2.7..4.2`, later recalculated from mass
- initial homeostasis/navigation controls randomized around midrange

## Genome Traits

Genome keys:

- `motility`
- `split`
- `harvest`
- `predator`
- `caution`

Initial ranges:

- `motility = 0.35..0.8`
- `split = 0.25..0.65`
- `harvest = 0.3..0.85`
- `predator = 0.45..0.9` for family 2, otherwise `0.05..0.35`
- `caution = 0.25..0.75`

DNA infusion:

- Adds `0.18` to the selected genome key.
- Clamps that key to `0..1.6`.
- Reduces legacy `energy` to at least `12`, but does not directly reduce ATP in current code.
- Adds signal phase for visual feedback.

Mutation on split:

- Each genome key changes by `-0.07..+0.07`.
- Mutated traits clamp to `0.02..1.5`.

## Sensing And Navigation

### Sensor Profile

Sensor budget affects awareness radius and processing.

Base sensing radius:

```text
(16 + radius * 3.4 + caution * 16) * (0.72 + sensorBudget * 0.62)
```

Radius is then modified by:

- ATP resolution: `clamp(ATP / 80, 0.18, 1.25)`
- oxygen processing: `clamp(oxygen / 35, 0.35, 1.15)`
- ROS integrity: `clamp(1 - max(0, ROS - 18) / 82, 0.35, 1)`

Sensing clarity combines:

- amino integrity: `42%`
- ATP resolution: `24%`
- oxygen processing: `16%`
- ROS integrity: `12%`
- health integrity: `6%`

### Search Preference

Search preference can be:

- balanced
- glucose
- oxygen
- amino acids
- light

When scanning resources:

- matching preferred resource multiplier: `1.8`
- balanced multiplier: `1`
- non-preferred multiplier: `0.72`

Resource attraction also depends on internal need:

- glucose need uses free glucose plus part of glycogen
- oxygen need uses oxygen store
- amino need uses amino acid store
- light need uses current light factor

Resource pull strength:

```text
baseResourceValue * preference * max(0.35, need) * distanceFalloff * harvest
```

Light has lower base attraction than molecules.

### Hazards And Cells

- Poison hazards push cells away when within awareness plus hazard radius.
- Avoidance scales with caution.
- Other cells are sensed within awareness:
  - predator-capable larger cells move toward smaller prey
  - otherwise nearby cells add mild repulsion

### Movement

Each cell combines sensed pull with jitter.

- Movement force scales with motility and movement budget.
- Maximum speed scales with:
  - motility
  - ATP-production intensity
  - inverse size drag
  - movement budget
- Movement has ATP cost later in metabolism.

## Resources

Kinds:

- glucose
- amino acid
- oxygen
- light

Resource defaults:

- amount: `0.45..1`
- light radius: `4..8`
- oxygen radius: `2.6..5.6`
- glucose/amino radius: `1.3..4.8`

Ambient spawning:

- If total resources are below `95`, each tick has `30%` chance to spawn one random resource.

Manual drops:

- Cotton candy spawns `18` glucose resources around drop point.
- Cat-pawn spawns `7` poison hazards around drop point.

## Light And Photosynthesis

Light resources move every tick.

- Global sun point follows a day-cycle path.
- Each light resource orbits its origin and is pulled toward the sun point.
- Light resources are clamped inside the board.
- Light amount pulses by day cycle and clamps to `0.18..1`.

Local light factor for a cell:

- Starts at `-0.12`.
- Each nearby light contributes:

```text
max(0, 1 - distance / (light.radius * 3.2)) * light.amount
```

Photosynthesis:

- `lightFactor = max(0, localLight)`
- glucose gain:

```text
lightFactor * (0.35 + harvest * 0.25)
```

- oxygen gain:

```text
lightFactor * 0.018
```

## Resource Consumption

Cells consume non-light resources only when overlapping.

Overlap condition:

```text
distance(cell, resource) < cell.radius + resource.radius
```

Cells can ingest a resource if:

```text
cell.radius * (1.22 + harvest * 0.45) >= resource.radius
```

If too large to ingest:

- legacy `energy` loses `0.08`
- resource remains

Transport channel:

- glucose uses `0.42 + harvest * 0.28`
- amino acid uses repair material import (`aminoTransport`)
- oxygen uses ATP production intensity (`oxygenMetabolism`)
- light is not transported this way

Consumed amount:

```text
min(resource.amount, 0.16 + channel * 0.72)
```

Transport ATP cost:

```text
(0.08 + resource.radius * 0.018) * (0.5 + channel)
```

Uptake multiplier:

```text
consumedAmount * (0.7 + harvest * 0.55)
```

Store gains:

- glucose resource adds `uptake * 18` glucose
- amino resource adds `uptake * 22` amino acids and mass
- oxygen resource adds `uptake * 28` oxygen and `uptake * 0.25` ROS

Resource amount decreases by consumed amount.
Resource radius shrinks with remaining amount.
Resource is removed when amount falls to `0.06` or lower.

## Homeostasis And Metabolism

Metabolism runs once per cell per tick after movement, collisions, resource consumption, and poison exposure.

### Glycogen Storage

Glucose storage priority is `glucoseTransport`.

Storage threshold:

```text
92 - storagePriority * 32
```

If free glucose is above threshold, glycogen is below `200`, and ATP is above `1`:

- glucose is packed into glycogen
- `2` glucose becomes `1` glycogen
- packing costs ATP equal to `glucoseToPack / 2`

Glucose packed:

```text
min((glucose - threshold) * (0.35 + storagePriority), (200 - glycogen) * 2)
```

### Glycogen Release

Release threshold:

```text
4 + (1 - storagePriority) * 12
```

If glucose is below release threshold and glycogen is available:

- glycogen converts back to glucose
- `1` glycogen becomes `2` glucose

### ATP Production

Each tick can consume up to `1` glucose.

Oxygen needed:

```text
glucoseUsed * (0.28 + oxygenMetabolism * 0.42)
```

ATP gain:

```text
2 * glucoseUsed * oxygenRatio * (0.7 + oxygenMetabolism * 0.6)
```

ROS gain:

```text
(0.06 + oxygenMetabolism * 0.12) * glucoseUsed * oxygenRatio
```

If oxygen is insufficient, ATP gain and ROS gain scale down by oxygen ratio.

### Baseline Repair

If ATP is at least `1` and amino acids at least `0.2`:

- ATP loses `1`
- amino acids lose `0.2`
- health gains `0.002`

Otherwise:

- health loses `0.012`

### Autophagy

If glucose and glycogen are empty and amino acids are available:

- up to `2` amino acids are consumed
- mass decreases by `aminoConsumed * 0.002`
- health decreases by `aminoConsumed * 0.003`
- ATP increases by `aminoConsumed * 0.8`
- autophagy rate records consumed amino amount

### Movement And Sensor Costs

Movement ATP cost:

```text
velocityLength
* (0.28 + motility * 0.12)
* (radius / 3.2) ^ 1.45
* (0.85 + oxygenMetabolism * 0.35)
* (0.72 + movementBudget * 0.7)
```

Sensor ATP cost:

```text
sensorBudget * 0.045
```

### ROS Repair

Repair budget:

```text
min(ATP, aminoAcids, 0.06 + ribosomeActivity * 0.16)
```

If ROS is above `18` and repair budget is positive:

- ROS decreases by `repairBudget * (0.55 + ribosomeActivity * 0.65)`
- ATP decreases by `repairBudget * (0.35 + ribosomeActivity * 0.45)`
- amino acids decrease by `repairBudget * (0.35 + ribosomeActivity * 0.55)`

### Growth

Growth bias:

```text
1 - ribosomeActivity
```

Mass gain:

```text
max(0, min(ATP - 78, aminoAcids - 45))
* 0.0012
* (0.45 + growthBias * 0.75 + harvest * 0.4)
```

High repair allocation reduces growth bias.

### Starvation And Damage

If ATP is below `12`:

- mass loses `0.0045`
- amino acids lose `0.03`

If amino acids are below `8`:

- health loses `0.006`

If ROS is above `45`:

- health loses `(ROS - 45) * 0.0008`

Final passive health adjustment:

- if ATP above `15`, amino acids above `12`, and ROS below `35`: health gains `0.001`
- otherwise health loses `0.006`

### Clamps

After metabolism:

- mass clamps to `0.18..2.4`
- ATP clamps to `-12..100`
- glucose clamps to `0..100`
- amino acids clamp to `0..100`
- oxygen clamps to `0..100`
- ROS clamps to `0..100`
- glycogen clamps to `0..200`
- health clamps to `0..1`
- radius recalculates from mass:

```text
clamp(1.85 + sqrt(mass) * 2.55, 2.2, 6.4)
```

Rates are recorded as post-metabolism values minus pre-tick baseline.

## Poison Hazards

If a cell overlaps poison:

- health loses:

```text
0.018 * potency * (1.4 - caution * 0.35)
```

- ATP loses `0.45 * potency`
- ROS gains `0.6 * potency`

Poison potency is generally `0.45..1` for seeded hazards, `0.48..0.95` for cat-pawn drops, or caller-provided `0.1..1` for direct spawns.

## Cell Collisions And Predation

Cell collision radius:

```text
cell.radius * max(1, bodyLength) * 1.18 + 0.35
```

When two cells overlap:

- they are pushed apart equally
- larger cell can become hunter if its radius is more than `1.12x` the other
- hunter attacks only if:
  - predator genome is above `0.55`
  - hunter ATP is above `18`

Predator attack:

- size advantage:

```text
clamp((hunter.radius - prey.radius) / 3, 0.2, 1.5)
```

- prey health loses:

```text
0.08 * hunter.predator * sizeAdvantage
```

- hunter ATP gains `1.4 * sizeAdvantage`

If prey health reaches `0.08` or lower:

- hunter gains `38%` of prey ATP
- hunter gains `28%` of prey amino acids
- hunter gains `22%` of prey mass
- a devour event is emitted

## Mineral Blocks And Boundaries

Blocks are irregular polygons with radius based on vertices.

Block collision:

- if cell center is closer than block radius plus cell collision radius:
  - cell is pushed outward
  - velocity is reversed and damped by `-0.2`

Board boundary:

- if cell exceeds board radius minus collision radius:
  - cell is moved inward
  - velocity is reversed and damped by `-0.25`
  - legacy `energy` loses `0.25`

## Death And Remains

A cell survives only if all are true:

- health above `0`
- ATP above `-10`
- mass above `0.16`

Dead cells emit a death event and become amino-acid remains.

Remain pieces:

```text
clamp(round(cell.mass * 3), 1, 7)
```

Each remain piece:

- kind: amino acid
- amount: `clamp(cell.mass / pieces, 0.18, 0.9)`
- radius: `1.1..max(1.4, cell.radius * 0.42)`
- placed near the corpse if possible, otherwise at an open point

## Division

A cell splits if all are true:

- ATP above `92`
- amino acids above `55`
- mass above `1.12`
- split genome above `0.4`
- dish has fewer than `55` cells

On split:

- child gets mutated genome
- child receives:
  - `42%` of parent ATP
  - `42%` glucose
  - `42%` amino acids
  - `50%` oxygen
  - `35%` ROS
  - `42%` glycogen
  - `48%` mass
- parent retains:
  - `48%` ATP
  - `52%` glucose
  - `52%` amino acids
  - `55%` oxygen
  - `65%` ROS
  - `52%` glycogen
  - `58%` mass

## Player Controls

### Homeostasis Window

Interactive conversion drivers:

- ATP production rate: controls oxygen-driven ATP production and ROS generation.
- Glucose storage priority: controls free glucose threshold and glycogen packing/release behavior.
- Repair material import: controls amino-acid transport from external amino-acid clusters.
- Repair allocation: controls ROS repair vs growth allocation.

Photosynthesis readout:

- shows light intake
- shows generated glucose
- shows generated oxygen

ROS waste and autophagy readouts:

- show current net rates from configured metabolism prediction.

### Navigation Window

Controls:

- Sensor budget: increases awareness/processing and adds ATP cost.
- Movement budget: increases movement force/speed and movement ATP cost.
- Search preference: biases attraction toward balanced need, glucose, oxygen, amino acids, or light.
- DNA buttons: increase selected genome traits.

Navigation state shows:

- sensing range and clarity
- strongest DNA trait
- nearby sensed molecules, poison, prey, and rivals
- active search preference

## Current Balance Risk Areas

These are not proposed changes, only rule hotspots that can make cells die easily:

- Baseline repair costs `1 ATP` and `0.2 amino acids` every tick, or health drops immediately.
- Passive health loses `0.006` per tick unless ATP, amino acids, and ROS are all in safe ranges.
- Poison overlap stacks health loss, ATP loss, and ROS gain.
- Movement and sensor budgets add continuous ATP drains.
- ATP production requires oxygen; without oxygen, glucose use produces little or no ATP.
- Autophagy preserves ATP only briefly while consuming amino acids, mass, and health.
- Glycogen packing currently costs substantial ATP when glucose is stored.
