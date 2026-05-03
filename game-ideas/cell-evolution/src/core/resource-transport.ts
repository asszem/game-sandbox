import type { Cell, Resource } from './types';

export function transportResource(cell: Cell, resource: Resource): number {
  const channel =
    resource.kind === 'glucose'
      ? 0.42 + cell.genome.harvest * 0.28
      : resource.kind === 'amino-acid'
        ? cell.aminoTransport
        : resource.kind === 'oxygen'
          ? cell.oxygenMetabolism
          : 0;
  const consumedAmount = Math.min(resource.amount, 0.16 + channel * 0.72);
  const transportCost = (0.08 + resource.radius * 0.018) * (0.5 + channel);
  cell.atp -= transportCost;
  const uptake = consumedAmount * (0.7 + cell.genome.harvest * 0.55);
  if (resource.kind === 'glucose') {
    cell.glucose += uptake * 18;
  }
  if (resource.kind === 'amino-acid') {
    cell.aminoAcids += uptake * 22;
    cell.mass += uptake * 0.035 * (resource.radius / 2.4);
  }
  if (resource.kind === 'oxygen') {
    cell.oxygen += uptake * 28;
    cell.ros += uptake * 0.08;
  }
  resource.amount = Math.max(0, resource.amount - consumedAmount);
  resource.radius = Math.max(0.65, resource.radius * (0.62 + resource.amount * 0.38));
  cell.energy = cell.atp;
  return consumedAmount;
}
