import { describe, expect, it } from 'vitest';
import { Engine } from './engine';
import { defaultConfig, PRESETS } from './presets';
import { isTopology } from '../clipboard';
import { crossingDelay, linkProfile } from './network';
import { packTopology, unpackTopology } from '../share/wire';
import type { Topology } from './types';

function design(region = 1, zone = 0): Topology {
  return {
    nodes: [
      {
        id: 'client',
        kind: 'client',
        label: 'Client',
        x: 0,
        y: 0,
        config: {
          ...defaultConfig('client'),
          rps: 100,
          timeoutMs: 1000,
          retries: 0,
          placementRegion: 0,
          placementZone: 0,
        },
      },
      {
        id: 'api',
        kind: 'service',
        label: 'API',
        x: 200,
        y: 0,
        config: {
          ...defaultConfig('service'),
          serviceMs: 1,
          serviceCv: 0,
          capacity: 1000,
          placementRegion: region,
          placementZone: zone,
        },
      },
    ],
    edges: [{ id: 'call', from: 'client', to: 'api', weight: 1 }],
    seed: 7,
  };
}
function advance(engine: Engine, ms: number) {
  const end = engine.now + ms;
  while (engine.now < end) engine.advance(Math.min(25, end - engine.now));
  return structuredClone(engine.snapshot());
}

describe('placement-aware request and response propagation', () => {
  it('rejects invalid geographic settings and reply loss at import/share boundaries', () => {
    const t = design();
    t.nodes[0].config.placementZone = 0.5;
    expect(isTopology(t)).toBe(false);
    expect(unpackTopology(packTopology(t))).toBeNull();
    t.nodes[0].config.placementZone = 0;
    t.edges[0].responseLossRate = 2;
    expect(isTopology(t)).toBe(false);
    expect(unpackTopology(packTopology(t))).toBeNull();
  });

  it('keeps cache-aside hit bypass and single-branch routing with a cross-region store', () => {
    const preset = PRESETS.find((entry) => entry.id === 'cache-policies');
    if (!preset) throw new Error('missing cache example');
    const t = structuredClone(preset.topology);
    for (const n of t.nodes) {
      n.config.placementRegion = n.id === 'db' ? 1 : 0;
      n.config.placementZone = 0;
      if (n.kind === 'cache') {
        n.config.readFraction = 1;
        n.config.cacheTtlMs = 60000;
      }
    }
    const engine = new Engine(t);
    const warm = advance(engine, 8000);
    const calls = warm.nodes.db.totalCompleted;
    const hot = advance(engine, 3000);
    expect(hot.nodes.db.totalCompleted).toBe(calls);
    expect(hot.nodes.cache.hitRate).toBeGreaterThan(0.99);
    expect(hot.nodes.cache.cacheEntries).toBe(64);
    expect(hot.system.totalFailed).toBe(0);
  });

  it('times out and retries after work finishes but before its delayed acknowledgment', () => {
    const t = design(0);
    t.nodes[0].config.timeoutMs = 50;
    t.nodes[0].config.retries = 1;
    t.edges[0].responseLatencyMs = 100;
    const snapshot = advance(new Engine(t), 5000);
    expect(snapshot.system.goodputRps).toBe(0);
    expect(snapshot.nodes.api.totalCompleted).toBeGreaterThan(
      snapshot.system.totalRequests * 1.7,
    );
    expect(snapshot.failuresByReason.timeout).toBeGreaterThan(0);
  });
  it.each([
    [0, 0, 2, 0.5],
    [0, 1, 5, 2],
    [1, 0, 161, 80],
  ])(
    'region %s zone %s adds one crossing each way, not two RTTs',
    (region, zone, latency, oneWay) => {
      const snapshot = advance(new Engine(design(region, zone)), 5000);
      expect(snapshot.system.p50).toBeCloseTo(latency, 6);
      expect(snapshot.network?.call.requestMs).toBeCloseTo(oneWay, 6);
      expect(snapshot.network?.call.responseMs).toBeCloseTo(oneWay, 6);
      expect(snapshot.network?.call.roundTripMs).toBeCloseTo(latency, 6);
    },
  );

  it('uses caller defaults, independent directional overrides, and exact share reload', () => {
    const t = design();
    t.nodes[0].config.crossRegionMs = 30;
    t.edges[0].latencyMs = 7;
    t.edges[0].responseLatencyMs = 11;
    t.edges[0].jitterMs = 0;
    t.edges[0].responseLossRate = 0;
    const restored = unpackTopology(packTopology(t));
    if (!restored) throw new Error('network design did not decode');
    const snapshot = advance(new Engine(restored), 5000);
    expect(snapshot.system.p50).toBeCloseTo(19, 6);
    expect(restored.nodes[0].config.crossRegionMs).toBe(30);
    expect(restored.edges[0].responseLatencyMs).toBe(11);
  });

  it('preserves legacy request-only latency and adds no profile or random draw', () => {
    const t = design();
    for (const n of t.nodes) delete n.config.placementRegion;
    t.edges[0].latencyMs = 80;
    const snapshot = advance(new Engine(t), 5000);
    expect(snapshot.system.p50).toBeCloseTo(81, 6);
    expect(snapshot.network).toBeUndefined();
    expect(
      crossingDelay(5, 0, () => {
        throw new Error('must not draw');
      }),
    ).toBe(5);
  });

  it('includes the return crossing in caller deadlines and recovers after moving nearby', () => {
    const t = design();
    t.nodes[0].config.timeoutMs = 100;
    const engine = new Engine(t);
    const failed = advance(engine, 5000);
    expect(failed.system.goodputRps).toBe(0);
    expect(failed.nodes.api.totalCompleted).toBeGreaterThan(300);
    expect(failed.failuresByReason.timeout).toBeGreaterThan(300);
    t.nodes[1].config.placementRegion = 0;
    engine.setTopology(t);
    const healed = advance(engine, 5000);
    expect(healed.system.goodputRps).toBeGreaterThan(50);
    expect(healed.system.p50).toBeCloseTo(2, 6);
  });

  it('silently loses only replies: work still completes and caller timeouts reveal loss', () => {
    const t = design(0);
    t.nodes[0].config.timeoutMs = 100;
    t.edges[0].responseLossRate = 1;
    const snapshot = advance(new Engine(t), 5000);
    expect(snapshot.nodes.api.totalCompleted).toBeGreaterThan(300);
    expect(snapshot.system.goodputRps).toBe(0);
    expect(snapshot.failuresByReason.timeout).toBeGreaterThan(300);
  });

  it('checks a cut encountered in flight, restores traffic, and replays bounded jitter', () => {
    const t = design();
    t.nodes[0].config.timeoutMs = 200;
    t.nodes[0].config.networkJitterMs = 10;
    const engine = new Engine(t);
    advance(engine, 500);
    engine.cutEdge('call');
    const cut = advance(engine, 500);
    expect(cut.system.totalFailed).toBeGreaterThan(0);
    engine.restoreEdge('call');
    expect(advance(engine, 1000).system.goodputRps).toBeGreaterThan(0);
    const a = advance(new Engine(t), 5000);
    const b = advance(new Engine(t), 5000);
    expect(a).toEqual(b);
    expect(a.system.p50).toBeGreaterThan(141);
    expect(a.system.p99).toBeLessThan(181.01);
    expect(linkProfile(t.nodes[0].config, t.nodes[1].config, t.edges[0]).scope).toBe(
      'cross-region',
    );
  });
});
