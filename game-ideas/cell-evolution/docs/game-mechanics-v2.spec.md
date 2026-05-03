# Cellular Resource System – Game Mechanics Specification

## Overview

This system simulates simplified cellular metabolism and homeostasis for gameplay purposes. It models three primary resource domains:

- **Energy** (ATP)
- **Building Blocks** (Amino Acids)
- **Storage** (Glycogen)

The system operates through interconnected subsystems:
- Energy production
- Resource conversion
- Biosynthesis
- Stress response
- Damage and recovery

The goal is to determine **Overall Cell Health**, which drives outcomes:
- Cell Growth / Division
- Cell Stalling / Apoptosis

---

## 1. External Inputs (Per Tick)

### Inputs:
- `glucose_external`
- `oxygen_external`
- `amino_acids_external`
- `stressors` (toxins, stress signals)

### Behavior:
- These values are injected into internal pools each tick based on permeability/uptake rates.

---

## 2. Internal Resource Pools

### 2.1 ATP Pool (Energy Currency)
- Represents usable energy
- Consumed by all active processes

#### Inputs:
- Glycolysis
- Respiration

#### Outputs:
- Biosynthesis
- Maintenance costs
- Antioxidant defenses

---

### 2.2 Amino Acid Pool (AA Pool)
- Represents available building blocks

#### Inputs:
- External amino acids
- Autofágia (protein breakdown)

#### Outputs:
- Protein synthesis
- Other biosynthesis
- Gluconeogenesis (conversion to glucose)

---

### 2.3 Glycogen (Storage)
- Stored glucose reserve

#### Inputs:
- Excess glucose (via glucose-6-phosphate)
- Gluconeogenesis output

#### Outputs:
- Mobilization to glucose when energy is low

---

### 2.4 Glucose-6-Phosphate (Intermediate Hub)
- Central conversion node

#### Inputs:
- External glucose
- Glycogen mobilization
- Gluconeogenesis

#### Outputs:
- Glycolysis
- Glycogen synthesis

---

## 3. Energy Loop

### 3.1 Glycolysis

#### Inputs:
- Glucose-6-phosphate

#### Outputs:
- Pyruvate
- Small amount of ATP

#### Notes:
- Always active if glucose is present

---

### 3.2 Pyruvate Branching

#### If oxygen is sufficient:
- → Respiration

#### If oxygen is low:
- → Fermentation

---

### 3.3 Respiration (Mitochondrial)

#### Inputs:
- Pyruvate
- Oxygen

#### Outputs:
- High ATP yield
- Reactive Oxygen Species (ROS)

---

### 3.4 Fermentation (Anaerobic Path)

#### Inputs:
- Pyruvate

#### Outputs:
- Minimal ATP
- No ROS

---

## 4. Reactive Oxygen Species (ROS)

### Generation:
- Produced by respiration

### Effects:
- Low levels:
  - Neutral / minor signaling
- High levels:
  - Increase cell damage

### Mitigation:
- Antioxidant defenses consume ATP to reduce ROS

---

## 5. Building Blocks & Biosynthesis

### 5.1 Protein Synthesis

#### Inputs:
- Amino acids
- ATP

#### Outputs:
- Proteins (contribute to cell health)

---

### 5.2 Other Biosynthesis

#### Inputs:
- Amino acids
- ATP

#### Outputs:
- Lipids, nucleotides, etc.
- Contribute to overall cell function

---

### 5.3 Biosynthesis Cost

- All synthesis processes consume ATP
- If ATP is insufficient:
  - Synthesis is reduced or halted

---

## 6. Autofágia (Autophagy)

### Trigger Conditions:
- Low ATP
- High stress
- High damage

### Inputs:
- Proteins

### Outputs:
- Amino acids (to AA Pool)

### Behavior:
- Emergency resource recovery mechanism
- Reduces structural integrity (protein loss)

---

## 7. Gluconeogenesis

### Inputs:
- Amino acids
- ATP

### Outputs:
- Glucose-6-phosphate

### Use Case:
- Activated when glucose is low and amino acids are available

---

## 8. Storage System

### 8.1 Glycogenesis

#### Inputs:
- Glucose-6-phosphate
- ATP

#### Outputs:
- Glycogen

---

### 8.2 Glycogen Mobilization

#### Trigger:
- Low ATP or low glucose

#### Outputs:
- Glucose-6-phosphate

---

## 9. Stress and Damage System

### 9.1 Stressors

#### Inputs:
- External stressors

#### Outputs:
- Cell damage
- Activation of signaling
- Activation of autophagy

---

### 9.2 Cell Damage

#### Sources:
- ROS
- Stressors

#### Effects:
- Reduces overall cell health
- Increases apoptosis probability

---

## 10. Signaling System

### Regulated Secretion

#### Trigger:
- High stress or damage

#### Outputs:
- Signals affecting environment or other cells (game-dependent)

---

## 11. Overall Cell Health

### Computation Factors:
- ATP level
- Amino acid availability
- Protein levels (structural integrity)
- ROS level
- Cell damage

### Derived States:

#### Positive State:
- High ATP
- Adequate AA
- Low damage
→ Cell Growth / Division

#### Negative State:
- Low ATP
- High damage
- Resource depletion
→ Cell Stalling / Apoptosis

---

## 12. Tick Processing Order

1. Apply external inputs
2. Update glucose-6-phosphate pool
3. Run glycolysis
4. Branch pyruvate (respiration vs fermentation)
5. Generate ATP and ROS
6. Apply antioxidant mitigation
7. Update AA pool (input + autophagy)
8. Run biosynthesis (protein + other)
9. Run gluconeogenesis if needed
10. Update glycogen (store/mobilize)
11. Apply stress and damage
12. Update signaling
13. Compute overall cell health
14. Resolve outcome (growth vs apoptosis)

---

## 13. Failure States

- **Energy Collapse**: ATP near zero → shutdown
- **Oxidative Overload**: ROS exceeds threshold → damage spike
- **Structural Collapse**: protein depletion via autophagy → health drop
- **Resource Starvation**: no glucose + no AA → irreversible decline

---

## 14. Design Constraints

- No direct AA → Glycogen conversion (must go through gluconeogenesis)
- Respiration requires oxygen
- Fermentation is fallback, inefficient
- Autophagy is conditional, not baseline
- ATP is universal cost driver

---

This system is designed for clarity, modularity, and gameplay tuning while maintaining biological plausibility.