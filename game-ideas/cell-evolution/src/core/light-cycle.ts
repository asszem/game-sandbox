import type { Resource } from './types';
import { add, clamp, length, normalize, scale, sub, vec } from './vector';

export function updateLightResources(resources: Resource[], tick: number, boardRadius: number): void {
  const dayAngle = tick * 0.012;
  const sunPosition = vec(Math.cos(dayAngle) * 52, Math.sin(dayAngle * 0.82) * 42);

  for (const resource of resources) {
    if (resource.kind !== 'light') {
      continue;
    }

    const origin = resource.origin ?? resource.position;
    const orbitRadius = resource.orbitRadius ?? 16;
    const orbitSpeed = resource.orbitSpeed ?? 0.007;
    const orbitPhase = resource.orbitPhase ?? 0;
    const angle = tick * orbitSpeed + orbitPhase;
    const drift = vec(Math.cos(angle) * orbitRadius, Math.sin(angle * 1.37) * orbitRadius * 0.55);
    const sunPull = scale(sub(sunPosition, origin), 0.34);
    const next = add(add(origin, drift), sunPull);
    const max = boardRadius - resource.radius - 3;
    const fromCenter = length(next);
    resource.position = fromCenter > max ? scale(normalize(next), max) : next;

    const dayPulse = 0.5 + Math.sin(dayAngle + orbitPhase) * 0.5;
    resource.amount = clamp(0.28 + dayPulse * 0.72, 0.18, 1);
  }
}
