import type { NodeConfig, SimEdge } from './types';

export type LinkScope = 'unplaced' | 'same-zone' | 'inter-zone' | 'cross-region';

export interface LinkProfile {
  scope: LinkScope;
  requestMs: number;
  responseMs: number;
  jitterMs: number;
}

/** Illustrative one-way propagation assumptions, not cloud measurements. */
export const NETWORK_DEFAULTS = {
  sameZoneMs: 0.5,
  interZoneMs: 2,
  crossRegionMs: 80,
  networkJitterMs: 0,
} as const;

export function linkProfile(
  from: NodeConfig | undefined,
  to: NodeConfig | undefined,
  edge: SimEdge,
): LinkProfile {
  let scope: LinkScope = 'unplaced';
  let base = 0;
  if (from?.placementRegion !== undefined && to?.placementRegion !== undefined) {
    scope =
      from.placementRegion !== to.placementRegion
        ? 'cross-region'
        : (from.placementZone ?? 0) !== (to.placementZone ?? 0)
          ? 'inter-zone'
          : 'same-zone';
    const field =
      scope === 'same-zone'
        ? 'sameZoneMs'
        : scope === 'inter-zone'
          ? 'interZoneMs'
          : 'crossRegionMs';
    base = from[field] ?? NETWORK_DEFAULTS[field];
  }
  const requestMs = edge.latencyMs ?? base;
  return {
    scope,
    requestMs,
    responseMs: edge.responseLatencyMs ?? (scope === 'unplaced' ? 0 : requestMs),
    jitterMs:
      edge.jitterMs ?? (scope === 'unplaced' ? 0 : (from?.networkJitterMs ?? 0)),
  };
}

/** Independent uniform +/- jitter per crossing; no RNG draw for old links. */
export function crossingDelay(
  meanMs: number,
  jitterMs: number,
  random: () => number,
): number {
  if (!(meanMs > 0) && !(jitterMs > 0)) return 0;
  return jitterMs > 0 ? Math.max(0, meanMs + (random() * 2 - 1) * jitterMs) : meanMs;
}
