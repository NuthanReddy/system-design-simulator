import { describe, expect, it } from 'vitest';
import { Engine } from './engine';
import { defaultConfig, PRESETS } from './presets';
import { packTopology, unpackTopology } from '../share/wire';
import { cacheAdvice } from '../learn/cacheAdvice';
import type { NodeConfig, NodeKind, SimNode, Topology } from './types';

function node(id: string, kind: NodeKind, patch: Partial<NodeConfig> = {}): SimNode {
  return {
    id,
    kind,
    label: id,
    x: 0,
    y: 0,
    config: {
      ...defaultConfig(kind),
      serviceMs: 1,
      serviceCv: 0,
      capacity: 256,
      queueLimit: 10000,
      timeoutMs: 0,
      retries: 0,
      ...patch,
    },
  };
}
const edge = (from: string, to: string) => ({
  id: `${from}>${to}`,
  from,
  to,
  weight: 1,
});
function topology(config: Partial<NodeConfig> = {}): Topology {
  return {
    nodes: [
      node('client', 'client', { rps: 500, keySkew: 0.8 }),
      node('api', 'service'),
      node('cache', 'cache', {
        cacheReadPolicy: 'cache-aside',
        cacheWritePolicy: 'write-through',
        cacheTtlMs: 60000,
        cacheInvalidationMs: 0,
        readFraction: 1,
        ...config,
      }),
      node('db', 'db', { serviceMs: 10, lockMs: 0, readFraction: 0 }),
    ],
    edges: [
      edge('client', 'api'),
      edge('api', 'cache'),
      edge('api', 'db'),
      edge('cache', 'db'),
    ],
  };
}
function advance(engine: Engine, ms: number) {
  const end = engine.now + ms;
  while (engine.now < end) engine.advance(Math.min(25, end - engine.now));
  return structuredClone(engine.snapshot());
}

describe('managed cache routing and real key versions', () => {
  it('uses the API link only for cold misses, never parallel duplicate DB work, then bypasses DB on hits', () => {
    const engine = new Engine(topology(), 7);
    const cold = advance(engine, 5000);
    expect(cold.nodes.cache.cacheEntries).toBe(64);
    expect(cold.nodes.db.totalCompleted).toBeLessThan(160);
    const initialDb = cold.nodes.db.totalCompleted;
    const warm = advance(engine, 5000);
    expect(warm.nodes.db.totalCompleted).toBe(initialDb);
    expect(warm.nodes.cache.hitRate).toBeGreaterThan(0.99);
    expect(warm.nodes.cache.cacheMissRate).toBe(0);
    expect(warm.nodes.cache.cacheFreshFraction).toBe(1);
    expect(warm.system.totalFailed).toBe(0);
  });

  it.each(['cache-aside', 'read-through'] as const)(
    'makes exactly one DB call per lookup when %s TTL is zero',
    (cacheReadPolicy) => {
      const engine = new Engine(topology({ cacheReadPolicy, cacheTtlMs: 0 }), 9);
      advance(engine, 3000);
      engine.updateNodeConfig('client', { rps: 0 });
      const s = advance(engine, 1000);
      expect(s.nodes.db.totalCompleted).toBe(s.nodes.cache.totalCompleted);
      expect(s.nodes.cache.hitRate).toBe(0);
      expect(s.system.totalFailed).toBe(0);
    },
  );

  it('TTL expiry causes database work again without claiming a preset hit percentage', () => {
    const engine = new Engine(topology({ cacheTtlMs: 100 }), 4);
    const s = advance(engine, 5000);
    expect(s.nodes.cache.cacheMissRate).toBeGreaterThan(50);
    expect(s.nodes.cache.hitRate).toBeLessThan(0.8);
    expect(s.nodes.db.totalCompleted).toBeGreaterThan(500);
  });

  it('retries cache-aside misses on their delegated API link without inventing a no-route error', () => {
    const engine = new Engine(
      topology({
        cacheTtlMs: 0,
        timeoutMs: 20,
        retries: 1,
      }),
      19,
    );
    engine.updateNodeConfig('db', { serviceMs: 100 });
    advance(engine, 2000);
    engine.updateNodeConfig('client', { rps: 0 });
    const s = advance(engine, 2000);
    expect(s.failuresByReason.timeout).toBeGreaterThan(0);
    expect(s.failuresByReason['no-route']).toBe(0);
    expect(s.nodes.db.totalCompleted).toBeGreaterThan(s.system.totalFailed * 1.5);
  });

  it('write-around exposes measured stale versions during invalidation lag and recovers when lag is removed', () => {
    const engine = new Engine(
      topology({
        cacheWritePolicy: 'write-around',
        cacheInvalidationMs: 2000,
        readFraction: 0.5,
      }),
      2,
    );
    const stale = advance(engine, 8000);
    expect(stale.nodes.cache.cacheStaleRate).toBeGreaterThan(0);
    expect(stale.nodes.cache.cacheFreshFraction).toBeLessThan(1);
    expect(stale.nodes.cache.cacheLagMs).toBeGreaterThan(0);
    const advice = cacheAdvice(
      engine.exportTopology().nodes.find((n) => n.id === 'cache')!,
      stale.nodes.cache,
    );
    expect(advice?.evidence).toBe('observed');
    expect(advice?.patch).toEqual({ cacheInvalidationMs: 0 });
    engine.updateNodeConfig('cache', { cacheInvalidationMs: 0 });
    const fresh = advance(engine, 8000);
    expect(fresh.nodes.cache.cacheStaleRate).toBe(0);
    expect(fresh.nodes.cache.cacheFreshFraction).toBe(1);
  });

  it('write-through waits for a successful database write; write-back acknowledges memory before flush and reports crash loss', () => {
    const through = new Engine(
      topology({ readFraction: 0, cacheWritePolicy: 'write-through' }),
      3,
    );
    through.updateNodeConfig('db', { serviceMs: 1000 });
    const waiting = advance(through, 100);
    expect(waiting.nodes.client.totalCompleted).toBe(0);
    expect(waiting.nodes.cache.cacheDirtyWrites).toBe(0);
    const back = new Engine(
      topology({
        readFraction: 0,
        cacheWritePolicy: 'write-back',
        flushDelayMs: 1000,
      }),
      3,
    );
    const acked = advance(back, 100);
    expect(acked.nodes.client.totalCompleted).toBeGreaterThan(0);
    expect(acked.nodes.db.totalCompleted).toBe(0);
    expect(acked.nodes.cache.cacheDirtyWrites).toBeGreaterThan(0);
    back.injectFailure('cache', 'crash');
    const lost = advance(back, 100);
    expect(lost.nodes.cache.flushFailRate).toBeGreaterThan(0);
    back.clearFailure('cache');
    advance(back, 3000);
    back.updateNodeConfig('client', { rps: 0 });
    const drained = advance(back, 10000);
    expect(drained.nodes.cache.cacheDirtyWrites).toBe(0);
    expect(drained.nodes.db.totalCompleted).toBeGreaterThan(0);
  });

  it('destroys delayed write-back work even when healed before its flush deadline', () => {
    const engine = new Engine(
      topology({
        readFraction: 0,
        cacheWritePolicy: 'write-back',
        flushDelayMs: 2000,
      }),
      14,
    );
    advance(engine, 100);
    engine.updateNodeConfig('client', { rps: 0 });
    advance(engine, 100);
    engine.injectFailure('cache', 'crash');
    engine.clearFailure('cache');
    const s = advance(engine, 3000);
    expect(s.nodes.cache.cacheDirtyWrites).toBe(0);
    expect(s.nodes.cache.cacheEntries).toBe(0);
    expect(s.nodes.db.totalCompleted).toBe(0);
    expect(s.nodes.cache.totalFailed).toBeGreaterThan(0);
  });

  it('SWR serves expired entries while making bounded real background reads; hard expiry blocks', () => {
    const swr = new Engine(
      topology({
        cacheReadPolicy: 'stale-while-revalidate',
        cacheTtlMs: 100,
        cacheStaleMs: 5000,
      }),
      5,
    );
    const s = advance(swr, 5000);
    expect(s.nodes.cache.cacheRefreshRate).toBeGreaterThan(0);
    expect(s.nodes.cache.cacheHitRate).toBeGreaterThan(0);
    expect(s.nodes.db.totalCompleted).toBeGreaterThan(100);
    expect(s.nodes.cache.cacheStaleRate).toBe(0);
    swr.updateNodeConfig('client', { rps: 0 });
    const settled = advance(swr, 500);
    expect(settled.nodes.cache.totalCompleted).toBe(
      settled.nodes.client.totalCompleted,
    );
    swr.updateNodeConfig('client', { rps: 500 });
    swr.updateNodeConfig('cache', { cacheStaleMs: 0 });
    const hard = advance(swr, 5000);
    expect(hard.nodes.cache.cacheRefreshRate).toBe(0);
    expect(hard.nodes.cache.cacheMissRate).toBeGreaterThan(0);
  });

  it('does not warm a cache on backing-store failure and becomes cold after a crash', () => {
    const engine = new Engine(topology(), 11);
    engine.injectFailure('db', 'crash');
    expect(advance(engine, 1000).nodes.cache.cacheEntries).toBe(0);
    engine.clearFailure('db');
    expect(advance(engine, 5000).nodes.cache.cacheEntries).toBe(64);
    engine.injectFailure('cache', 'crash');
    expect(advance(engine, 50).nodes.cache.cacheEntries).toBe(0);
    engine.clearFailure('cache');
    expect(advance(engine, 5000).nodes.cache.cacheEntries).toBe(64);
  });

  it('keeps new policy controls in shared designs and deterministic replay', () => {
    const example = PRESETS.find((p) => p.id === 'cache-policies')!.topology;
    const restored = unpackTopology(packTopology(example));
    expect(restored).not.toBeNull();
    const cfg = restored!.nodes.find((n) => n.kind === 'cache')!.config;
    expect(cfg.cacheReadPolicy).toBe('cache-aside');
    expect(cfg.cacheWritePolicy).toBe('write-through');
    expect(cfg.cacheInvalidationMs).toBe(1500);
    expect(advance(new Engine(example, 8), 5000)).toEqual(
      advance(new Engine(example, 8), 5000),
    );
  });

  it('keeps other dependencies in API fanout and makes read-through use only the cache-to-DB link', () => {
    const t = topology({ cacheReadPolicy: 'read-through', cacheTtlMs: 0 });
    t.nodes.push(node('audit', 'service'));
    t.edges.push(edge('api', 'audit'));
    const engine = new Engine(t, 12);
    const s = advance(engine, 5000);
    expect(s.edgeFlow['api>db']).toBe(0);
    expect(s.edgeFlow['cache>db']).toBeGreaterThan(0);
    expect(s.edgeFlow['api>audit']).toBeGreaterThan(0);
  });

  it('tracks writes from another API to the same database instead of treating retained cache versions as fresh', () => {
    const t = topology({ cacheInvalidationMs: 2000 });
    t.nodes.push(node('writer', 'client', { rps: 200 }), node('write-api', 'service'));
    t.edges.push(edge('writer', 'write-api'), edge('write-api', 'db'));
    const s = advance(new Engine(t, 10), 8000);
    expect(s.nodes.cache.cacheStaleRate).toBeGreaterThan(0);
    expect(s.nodes.cache.cacheFreshFraction).toBeLessThan(1);
  });
});
