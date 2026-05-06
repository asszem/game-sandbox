import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({
  logLevel: 'error',
  server: { middlewareMode: true },
});

try {
  const { createCellEntity } = await server.ssrLoadModule('/src/core/entities.ts');
  const { removeDeadCells } = await server.ssrLoadModule('/src/core/cell-death.ts');
  const { applyCellMetabolism } = await server.ssrLoadModule('/src/core/metabolism.ts');
  const { vec } = await server.ssrLoadModule('/src/core/vector.ts');

  function rng() {
    return {
      next: () => 0.5,
      range: (min, max) => (min + max) / 2,
      signed: () => 0,
    };
  }

  function cell(overrides = {}) {
    return Object.assign(createCellEntity(1, rng(), vec()), {
      velocity: vec(),
      glucose: 20,
      glucose6Phosphate: 0,
      pyruvate: 0,
      lactate: 0,
      glycogen: 0,
      oxygen: 0,
      atp: 20,
      aminoAcids: 50,
      protein: 75,
      ros: 5,
      damage: 0,
      health: 1,
      ...overrides,
    });
  }

  function baseline(subject) {
    return {
      atp: subject.atp,
      glucose: subject.glucose,
      glucose6Phosphate: subject.glucose6Phosphate,
      pyruvate: subject.pyruvate,
      lactate: subject.lactate,
      amino: subject.aminoAcids,
      protein: subject.protein,
      oxygen: subject.oxygen,
      ros: subject.ros,
      damage: subject.damage,
      glycogen: subject.glycogen,
      health: subject.health,
    };
  }

  {
    const subject = cell({ oxygen: 0, oxygenMetabolism: 0.6 });
    applyCellMetabolism(subject, 0, baseline(subject));
    assert.equal(subject.respirationRate, 0, 'respiration should not run without oxygen');
    assert.ok(subject.fermentationRate > 0, 'fermentation should produce ATP without oxygen');
    assert.ok(subject.atpRate > 0, 'anaerobic metabolism should still produce some ATP');
  }

  {
    const anaerobic = cell({ oxygen: 0, oxygenMetabolism: 0.65 });
    const aerobic = cell({ oxygen: 20, oxygenMetabolism: 0.65 });
    applyCellMetabolism(anaerobic, 0, baseline(anaerobic));
    applyCellMetabolism(aerobic, 0, baseline(aerobic));
    assert.ok(aerobic.atpRate > anaerobic.atpRate, 'oxygen should increase ATP yield from glucose metabolism');
    assert.ok(aerobic.respirationRate > 0, 'oxygen should enable respiration');
    assert.ok(aerobic.rosRate > anaerobic.rosRate, 'respiration should generate more ROS than fermentation');
  }

  {
    const subject = cell({
      atp: 2,
      glucose: 0,
      glucose6Phosphate: 0,
      glycogen: 0,
      aminoAcids: 5,
      protein: 55,
      damage: 60,
      health: 0.8,
    });
    applyCellMetabolism(subject, 0, baseline(subject));
    assert.ok(subject.autophagyRate > 0, 'autophagy should activate under stress and starvation');
    assert.ok(subject.proteinRate < 0, 'autophagy should consume protein');
    assert.ok(subject.aminoRate > 0, 'autophagy should return amino acids to the pool');
  }

  {
    const subject = cell({ damage: 70, ros: 65, health: 0.8, atp: 18, aminoAcids: 14, protein: 45 });
    applyCellMetabolism(subject, 0, baseline(subject));
    assert.ok(subject.healthRate < 0, 'high damage and ROS should lower health');
    assert.ok(subject.damage >= 70, 'unresolved oxidative stress should not reduce damage');
  }

  {
    const subject = cell({ atp: 0, health: 1, mass: 0.8, protein: 75, damage: 0 });
    const state = {
      tick: 0,
      running: true,
      selectedCellId: subject.id,
      cellComplexity: 1,
      boardRadius: 92,
      cells: [subject],
      resources: [],
      hazards: [],
      blocks: [],
    };
    const events = [];
    removeDeadCells({ state, events, rng: rng(), nextId: 2 });
    assert.equal(state.cells.length, 0, 'complexity 1 cells should die when ATP pool reaches 0');
    assert.equal(events[0]?.kind, 'cell-died', 'ATP depletion should emit a death event');
  }
} finally {
  await server.close();
}
