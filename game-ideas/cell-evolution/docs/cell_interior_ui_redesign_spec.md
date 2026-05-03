# Cell Interior UI Redesign Specification

## Purpose

Redesign the Cell Interior panel so the player can understand the metabolic relationships at a glance. The screen should read as a flow system, not as a flat grid of unrelated resource cards.

The design must visually communicate:

- External resources enter the cell from the top.
- Glucose moves into the Glucose Hub.
- Glycolysis converts glucose into pyruvate.
- Pyruvate branches into either respiration or fermentation.
- Respiration requires oxygen and produces strong ATP output, but also ROS.
- Fermentation works under low oxygen and produces weaker ATP output.
- ATP powers protein repair and biosynthesis.
- Glycogen stores and releases glucose through a two-way buffer loop.
- ROS and negative balance damage overall cell health.
- Cell Health determines growth, stall, or apoptosis outcome.

---

## Layout Model

Use a three-zone layout inside the Cell Interior panel.

### Zone A: Input Layer

Positioned at the top of the panel.

Components:

| Component | Role |
|---|---|
| Glucose Intake | Feeds the Glucose Hub |
| Oxygen Intake | Enables respiration |
| Amino Acid / Protein Input, if implemented later | Feeds repair and biosynthesis |

The current implementation only shows glucose and oxygen intake, so those should remain visible near the top.

---

### Zone B: Metabolic Core

Positioned in the center-left and center of the panel.

This is the main flow spine:

`Glucose Hub → Glycolysis → Pyruvate → Respiration / Fermentation → ATP Pool`

### Visual Rules

- Glucose Hub should be above Glycolysis.
- Glycolysis should feed downward or rightward into Pyruvate.
- Pyruvate should be a visible branch point.
- Respiration and Fermentation should sit after Pyruvate as alternative routes.
- ATP Pool should be larger than regular process nodes.
- Arrows must make the transformation chain clear.

---

### Zone C: Health, Repair, and Damage

Positioned on the right and bottom.

Main positive path:

`ATP Pool → Protein / Repair → Cell Health → Growth`

Main negative path:

`Respiration → ROS / Damage → Cell Health → Stall / Apoptosis`

### Visual Rules

- Protein / Repair should be downstream of ATP.
- ROS / Damage should be downstream of Respiration.
- Cell Health should be the final central outcome node.
- Damage should visually oppose the repair path.
- Growth and apoptosis should be small outcome badges below Cell Health.

---

## Component Specification

## 1. Glucose Hub

### Display Name
`G6P / Glucose Hub`

### Meaning
Represents intracellular usable glucose, simplified as glucose-6-phosphate.

### Inputs
- External glucose intake
- Glycogen mobilization
- Future gluconeogenesis, if implemented

### Outputs
- Glycolysis
- Glycogen storage

### Visual Placement
Upper-left to mid-left, before Glycolysis.

### Visual Priority
Medium.

### Required Connections
- Incoming arrow from Glucose Intake
- Outgoing arrow to Glycolysis
- Two-way loop with Glycogen

---

## 2. Glycolysis

### Display Name
`Glycolysis`

### Meaning
Basic glucose breakdown pathway.

### Inputs
- Glucose Hub

### Outputs
- Pyruvate
- Small ATP gain, if directly modeled

### Visual Placement
Directly after Glucose Hub.

### Visual Priority
Small to medium process node.

### Required Connections
- Incoming arrow from Glucose Hub
- Outgoing arrow to Pyruvate

---

## 3. Pyruvate

### Display Name
`Pyr / Pyruvate`

### Meaning
Branching metabolite that can enter oxygen-based respiration or low-oxygen fermentation.

### Inputs
- Glycolysis

### Outputs
- Respiration, if oxygen is available
- Fermentation, if oxygen is low

### Visual Placement
Central branch node.

### Visual Priority
Medium-high because it controls pathway choice.

### Required Connections
- Incoming arrow from Glycolysis
- Outgoing arrow to Respiration
- Outgoing dashed or alternative arrow to Fermentation

---

## 4. Respiration

### Display Name
`Respiration uses O₂`

### Meaning
Efficient oxygen-dependent ATP production.

### Inputs
- Pyruvate
- Oxygen

### Outputs
- ATP
- ROS / Damage

### Visual Placement
Right of Pyruvate, upstream of ATP and ROS.

### Visual Priority
Medium.

### Required Connections
- Incoming arrow from Pyruvate
- Incoming oxygen indicator from Oxygen Intake
- Outgoing arrow to ATP Pool
- Outgoing red or warning arrow to ROS / Damage

---

## 5. Fermentation

### Display Name
`Fermentation`

### Meaning
Low-oxygen fallback pathway.

### Inputs
- Pyruvate

### Outputs
- Small ATP gain

### Activation Condition
Used when oxygen is insufficient for respiration.

### Visual Placement
Below Pyruvate or below Respiration as the alternate branch.

### Visual Priority
Small to medium.

### Required Connections
- Conditional incoming arrow from Pyruvate
- Outgoing arrow to ATP Pool
- Label: `Low O₂ fallback`

---

## 6. ATP Pool

### Display Name
`ATP Pool`

### Meaning
Main energy currency.

### Inputs
- Respiration
- Fermentation
- Optional direct glycolysis gain

### Outputs
- Protein / Repair
- Antioxidant defense, if implemented
- Maintenance costs

### Visual Placement
Center-right, visually central.

### Visual Priority
High. This should be one of the largest nodes.

### Required Connections
- Incoming arrow from Respiration
- Incoming arrow from Fermentation
- Outgoing arrow to Protein / Repair
- Optional outgoing arrow to antioxidant defense

---

## 7. Glycogen

### Display Name
`Glycogen`

### Meaning
Stored glucose buffer.

### Inputs
- Excess Glucose Hub resource

### Outputs
- Glucose Hub through mobilization

### Visual Placement
Left-bottom, attached to Glucose Hub as a loop.

### Visual Priority
Medium.

### Required Connections
- Arrow from Glucose Hub to Glycogen labelled `Store excess`
- Arrow from Glycogen to Glucose Hub labelled `Mobilize when low`

---

## 8. Protein / Repair

### Display Name
`Protein / Repair`

### Meaning
Represents structural maintenance, repair, and simplified biosynthesis.

### Inputs
- ATP
- Future amino acid pool, if implemented

### Outputs
- Improved Cell Health
- Repair of damage, if implemented

### Visual Placement
Right of ATP or below ATP.

### Visual Priority
Medium-high.

### Required Connections
- Incoming arrow from ATP Pool
- Outgoing arrow to Cell Health

---

## 9. ROS / Damage

### Display Name
`ROS / Damage`

### Meaning
Represents oxidative stress and accumulated damage.

### Inputs
- Respiration
- External stressors, if implemented

### Outputs
- Reduced Cell Health
- Negative Balance

### Visual Placement
Right-bottom, near but separate from Protein / Repair.

### Visual Priority
High when dangerous.

### Required Connections
- Incoming red/warning arrow from Respiration
- Outgoing red/warning arrow to Cell Health
- Optional outgoing indicator to Negative Balance

---

## 10. Cell Health

### Display Name
`Cell Health`

### Meaning
Final integrated state of the cell.

### Inputs
- Positive contribution from Protein / Repair
- Negative contribution from ROS / Damage
- Negative contribution from low ATP or starvation
- Negative contribution from external stressors, if implemented

### Outputs
- Growth / Division
- Stalling
- Apoptosis

### Visual Placement
Bottom-center or lower-right as the final sink.

### Visual Priority
Very high. Similar or slightly larger than ATP Pool.

### Required Connections
- Incoming positive arrow from Protein / Repair
- Incoming negative arrow from ROS / Damage
- Outgoing green arrow to Growth / Division
- Outgoing red arrow to Stall / Apoptosis

---

## 11. Balance Strip

### Display Name
`Balance`

### Meaning
A compact summary of current metabolic direction.

### Inputs
- ATP trend
- Health trend
- ROS trend
- Resource depletion

### Outputs
- Positive, neutral, or negative state

### Visual Placement
Bottom or near Cell Health.

### Visual Priority
Low to medium.

### Required Behavior
Show a short state summary, such as:

- `Positive balance: +Growth`
- `Stable balance: Maintenance`
- `Negative balance: -Health / Apoptosis risk`

---

## Arrow Semantics

Use consistent arrow types.

| Arrow Type | Meaning |
|---|---|
| Solid green/yellow | Resource flow or productive conversion |
| Solid blue | Oxygen-dependent pathway |
| Dashed purple/gray | Conditional or fallback pathway |
| Solid red | Damage or negative effect |
| Two-way loop | Storage and mobilization |

---

## Recommended Screen Arrangement

```text
┌──────────────────────────────────────────────────────────────┐
│ CELL INTERIOR                                                 │
│                                                              │
│  Glucose Intake                         Oxygen Intake         │
│       ↓                                      ↓                │
│  ┌─────────────┐      ┌─────────────┐   ┌─────────────┐       │
│  │ Glucose Hub │ ───▶ │ Glycolysis  │ ─▶│ Pyruvate    │       │
│  └──────┬──────┘      └─────────────┘   └──────┬──────┘       │
│         │                                      / \             │
│         │                          Low O₂    /   \ O₂          │
│         ▼                                   ▼     ▼            │
│  ┌─────────────┐                    ┌────────┐ ┌────────────┐ │
│  │ Glycogen    │◀────mobilize──────▶│ Ferm.  │ │ Respiration│ │
│  └─────────────┘                    └───┬────┘ └─────┬──────┘ │
│                                         │            │        │
│                                         └────▶┌──────▼──────┐ │
│                                              │ ATP Pool     │ │
│                                              └──────┬──────┘ │
│                                                     ▼        │
│                                              ┌─────────────┐ │
│                          ┌──────────────────▶│Protein/Repair│ │
│                          │                   └──────┬──────┘ │
│                          │                          ▼        │
│                    ┌─────▼──────┐             ┌────────────┐ │
│                    │ROS/Damage  │────────────▶│Cell Health │ │
│                    └────────────┘             └─────┬──────┘ │
│                                                     / \       │
│                                                Growth Apoptosis│
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Notes

- Use a graph-like layout with anchored node positions.
- Keep node positions stable between ticks.
- Animate values inside nodes rather than moving the nodes.
- Highlight active arrows based on current flow.
- Fade inactive branches instead of hiding them.
- Keep all core pathways visible even when inactive.
- Use Cell Health and ATP Pool as the main visual anchors.

---

## Suggested Relative Coordinates

Assume the panel uses normalized coordinates from `0.0` to `1.0`.

| Node | X | Y | Width | Height |
|---|---:|---:|---:|---:|
| Glucose Intake | 0.12 | 0.08 | 0.16 | 0.08 |
| Oxygen Intake | 0.64 | 0.08 | 0.16 | 0.08 |
| Glucose Hub | 0.12 | 0.24 | 0.18 | 0.12 |
| Glycolysis | 0.34 | 0.24 | 0.16 | 0.10 |
| Pyruvate | 0.54 | 0.24 | 0.16 | 0.12 |
| Fermentation | 0.45 | 0.48 | 0.16 | 0.11 |
| Respiration | 0.69 | 0.48 | 0.18 | 0.12 |
| ATP Pool | 0.66 | 0.67 | 0.20 | 0.14 |
| Glycogen | 0.13 | 0.52 | 0.18 | 0.13 |
| Protein / Repair | 0.66 | 0.86 | 0.20 | 0.12 |
| ROS / Damage | 0.91 | 0.60 | 0.16 | 0.13 |
| Cell Health | 0.42 | 0.86 | 0.20 | 0.13 |
| Growth | 0.18 | 0.92 | 0.18 | 0.08 |
| Stall / Apoptosis | 0.88 | 0.92 | 0.20 | 0.08 |

---

## Success Criteria

The redesign is successful if a player can understand these relationships without reading detailed help text:

1. Glucose feeds energy production.
2. Oxygen makes respiration available.
3. Pyruvate is the branch between respiration and fermentation.
4. Respiration creates much more ATP but also creates ROS.
5. ATP powers repair.
6. Glycogen buffers glucose shortage.
7. ROS damages cell health.
8. Cell Health determines growth or apoptosis.
