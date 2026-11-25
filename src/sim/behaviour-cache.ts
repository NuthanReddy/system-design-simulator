import type { ComponentBehaviour } from './behaviour';
import type {
  BehaviourCtx,
  NodeStateLike,
  ReqLike,
  StoreVersion,
} from './engine-types';
import type { NodeConfig, SimEdge } from './types';

interface Entry {
  value: StoreVersion;
  loadedAt: number;
  invalidAt?: number;
  staleSince?: number;
  dirty?: boolean;
}

interface CacheState {
  entries: Map<number, Entry>;
  loading: WeakMap<ReqLike, { generation: number }>;
  refreshing: Map<number, { token: number; generation: number }>;
  dirty: Map<number, Map<number, { at: number; generation: number }>>;
  nextWrite: number;
  nextRefresh: number;
  generation: number;
  origin: string;
}

const enabled = (config: NodeConfig) =>
  config.cacheReadPolicy !== undefined && config.cacheReadPolicy !== 'legacy';
const nonnegative = (value: number | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
const memory = (state: NodeStateLike) => state.ext as CacheState;
const writePolicy = (state: NodeStateLike) =>
  state.config.cacheWritePolicy ?? 'write-through';
const ttl = (state: NodeStateLike) => nonnegative(state.config.cacheTtlMs, 5000);
const isDatabase = (ctx: BehaviourCtx, edge: SimEdge) =>
  ctx.nodeState(edge.to)?.kind === 'db';

function originEdge(
  ctx: BehaviourCtx,
  state: NodeStateLike,
  req?: ReqLike,
  owner?: NodeStateLike,
): SimEdge | undefined {
  const own = state.out.filter((edge) => isDatabase(ctx, edge));
  if (own.length > 1) return undefined;
  if (state.config.cacheWritePolicy === 'write-back' && own.length !== 1)
    return undefined;
  const parent = owner ?? (req?.parent && ctx.nodeState(req.parent.nodeId));
  const siblings = parent?.out.filter((edge) => isDatabase(ctx, edge)) ?? [];
  if (state.config.cacheReadPolicy === 'cache-aside') {
    const candidates =
      own.length === 1 ? siblings.filter((edge) => edge.to === own[0].to) : siblings;
    if (candidates.length === 1) {
      const competing = parent?.out.some((edge) => {
        const other = ctx.nodeState(edge.to);
        if (
          !other ||
          other.id === state.id ||
          other.kind !== 'cache' ||
          !enabled(other.config)
        )
          return false;
        const databases = other.out.filter((candidate) => isDatabase(ctx, candidate));
        return (
          databases.some((candidate) => candidate.to === candidates[0].to) ||
          (other.config.cacheReadPolicy === 'cache-aside' && databases.length === 0)
        );
      });
      if (competing) return undefined;
      return candidates[0];
    }
  }
  if (own.length === 1) return own[0];
  return undefined;
}

/** A managed cache owns its database branch; unrelated dependencies still fan out. */
export function cacheAwareEdges(
  ctx: BehaviourCtx,
  state: NodeStateLike,
  req: ReqLike,
): readonly SimEdge[] {
  const cachedOrigins = new Set<string>();
  for (const edge of state.out) {
    const target = ctx.nodeState(edge.to);
    if (target?.kind !== 'cache' || !enabled(target.config)) continue;
    const origin = originEdge(ctx, target, req, state);
    if (origin) cachedOrigins.add(origin.to);
  }
  return cachedOrigins.size
    ? state.out.filter((edge) => !cachedOrigins.has(edge.to))
    : state.out;
}

function observe(ctx: BehaviourCtx, state: NodeStateLike): void {
  const data = memory(state);
  for (const [key, entry] of data.entries) {
    if (entry.dirty) continue;
    const latest = ctx.storeVersion(entry.value.storeId, key);
    if (latest.version > entry.value.version && entry.invalidAt === undefined) {
      entry.invalidAt =
        latest.updatedAtMs + nonnegative(state.config.cacheInvalidationMs, 0);
      entry.staleSince = latest.updatedAtMs;
    }
    if (entry.invalidAt !== undefined && ctx.now >= entry.invalidAt) {
      data.entries.delete(key);
    }
  }
}

function fill(
  ctx: BehaviourCtx,
  state: NodeStateLike,
  key: number,
  value: StoreVersion,
): void {
  const data = memory(state);
  const entry = data.entries.get(key);
  if (entry?.dirty || (entry && entry.value.version > value.version)) return;
  data.entries.set(key, { value, loadedAt: ctx.now });
}

export const cache: ComponentBehaviour = {
  kind: 'cache',
  blocksOnDownstream: false,
  servesRequests: true,
  instanceModel: 'slots',
  scaleField: 'instances',
  generatesLoad: false,
  pullsFromQueues: false,
  buffersForConsumers: false,
  pump: 'own',
  creditsJoinCompletion: true,
  initState: (): CacheState => ({
    entries: new Map(),
    loading: new WeakMap(),
    refreshing: new Map(),
    dirty: new Map(),
    nextWrite: 0,
    nextRefresh: 0,
    generation: 0,
    origin: '',
  }),
  onAdmit(ctx, state, req) {
    if (!enabled(state.config)) return 'serve';
    const edge = originEdge(ctx, state, req);
    memory(state).origin = edge?.to ?? '';
    if (!edge) {
      ctx.reject(state, req, 'no-route');
      return 'handled';
    }
    if (!req.operationClassified) {
      ctx.classifyOperation(
        req,
        ctx.roll() >= nonnegative(state.config.readFraction, 0.9),
      );
    }
    if (req.isWrite && writePolicy(state) === 'write-back' && !req.relayAcked) {
      if (ctx.queueDepth(state) >= ctx.effectiveQueueLimit(state)) return 'shed';
      const data = memory(state);
      const list = data.dirty.get(req.key) ?? new Map();
      const token = ++data.nextWrite;
      list.set(token, { at: ctx.now, generation: data.generation });
      data.dirty.set(req.key, list);
      data.entries.set(req.key, {
        value: ctx.storeVersion(edge.to, req.key),
        loadedAt: ctx.now,
        dirty: true,
      });
      ctx.ackAndRelay(
        state,
        req,
        nonnegative(state.config.flushDelayMs, 200),
        true,
        token,
      );
      return 'handled';
    }
    return 'serve';
  },
  outgoing(ctx, state, req) {
    if (!enabled(state.config)) return state.out;
    const edge = originEdge(ctx, state, req);
    return edge ? [edge] : [];
  },
  onServiceComplete(ctx, state, req) {
    if (!enabled(state.config)) {
      if (ctx.roll() < Math.max(0, Math.min(1, state.config.hitRate))) {
        ctx.countHit(state);
        return 'complete';
      }
      ctx.countMiss(state);
      return state.out.length ? 'downstream' : 'complete';
    }
    observe(ctx, state);
    const data = memory(state);
    const edge = originEdge(ctx, state, req);
    if (!edge) {
      ctx.reject(state, req, 'no-route');
      return 'handled';
    }
    if (req.isWrite) {
      data.loading.set(req, { generation: data.generation });
      return 'downstream';
    }
    const entry = data.entries.get(req.key);
    const age = entry ? ctx.now - entry.loadedAt : Infinity;
    const expired = age >= ttl(state);
    const swr = state.config.cacheReadPolicy === 'stale-while-revalidate';
    const mayServe =
      entry &&
      (entry.dirty ||
        !expired ||
        (swr && age < ttl(state) + nonnegative(state.config.cacheStaleMs, 5000)));
    if (mayServe) {
      ctx.countHit(state);
      ctx.countCustom(state, 'cacheHit', 1);
      const latest = ctx.storeVersion(edge.to, req.key);
      const stale = !entry.dirty && entry.value.version < latest.version;
      ctx.countCustom(
        state,
        entry.dirty ? 'cacheDirtyRead' : stale ? 'cacheStale' : 'cacheFresh',
        1,
      );
      if (expired && !entry.dirty && swr && !data.refreshing.has(req.key)) {
        const token = ++data.nextRefresh;
        data.refreshing.set(req.key, { token, generation: data.generation });
        ctx.countCustom(state, 'cacheRefresh', 1);
        if (!ctx.emitDetached(state, edge, req.key, req, token)) {
          data.refreshing.delete(req.key);
          ctx.countCustom(state, 'cacheRefreshFailed', 1);
        }
      }
      ctx.setValueVersion(req, entry.value);
      return 'complete';
    }
    ctx.countMiss(state);
    ctx.countCustom(state, 'cacheMiss', 1);
    data.loading.set(req, { generation: data.generation });
    return 'downstream';
  },
  onResolved(ctx, state, req, ok) {
    const active = enabled(state.config);
    const data = memory(state);
    if (req.cacheRefreshToken !== undefined) {
      const refresh = data.refreshing.get(req.key);
      if (
        refresh?.token !== req.cacheRefreshToken ||
        refresh.generation !== data.generation
      )
        return;
      data.refreshing.delete(req.key);
      if (active && ok && req.valueVersion) fill(ctx, state, req.key, req.valueVersion);
      else ctx.countCustom(state, 'cacheRefreshFailed', 1);
      return;
    }
    if (req.relayAcked) {
      const list = data.dirty.get(req.key);
      const pending =
        req.cacheWriteToken === undefined ? undefined : list?.get(req.cacheWriteToken);
      if (req.cacheWriteToken !== undefined) list?.delete(req.cacheWriteToken);
      if (!list?.size) {
        data.dirty.delete(req.key);
        if (pending?.generation === data.generation) {
          data.entries.delete(req.key);
          if (active && ok && req.valueVersion)
            fill(ctx, state, req.key, req.valueVersion);
        }
      }
      ctx.countCustom(state, ok ? 'flushed' : 'flushFailed', 1);
      return;
    }
    const load = data.loading.get(req);
    if (!load) return;
    data.loading.delete(req);
    if (!active || !ok || load.generation !== data.generation || !req.valueVersion)
      return;
    if (req.isWrite && writePolicy(state) === 'write-around') return;
    fill(ctx, state, req.key, req.valueVersion);
  },
  onTick(ctx, state) {
    if (enabled(state.config)) observe(ctx, state);
  },
  onCrash(ctx, state) {
    const data = memory(state);
    if (enabled(state.config) && data.refreshing.size) {
      ctx.countCustom(state, 'cacheRefreshFailed', data.refreshing.size);
    }
    data.generation++;
    data.entries.clear();
    data.refreshing.clear();
  },
  decorateStats(ctx, state, stats) {
    if (!enabled(state.config)) return;
    const data = memory(state);
    stats.cacheHitRate = ctx.counterRate(state, 'cacheHit');
    stats.cacheDirtyReadRate = ctx.counterRate(state, 'cacheDirtyRead');
    stats.cacheMissRate = ctx.counterRate(state, 'cacheMiss');
    stats.cacheStaleRate = ctx.counterRate(state, 'cacheStale');
    const versionedHits = ctx.counterRate(state, 'cacheFresh') + stats.cacheStaleRate;
    stats.cacheFreshFraction =
      versionedHits > 0
        ? ctx.counterRate(state, 'cacheFresh') / versionedHits
        : undefined;
    stats.cacheEntries = data.entries.size;
    stats.cacheOriginConnected = data.origin !== '';
    stats.cacheLagMs = 0;
    for (const [key, entry] of data.entries) {
      const latest = ctx.storeVersion(entry.value.storeId, key);
      if (!entry.dirty && latest.version > entry.value.version) {
        stats.cacheLagMs = Math.max(
          stats.cacheLagMs,
          ctx.now - (entry.staleSince ?? latest.updatedAtMs),
        );
      }
    }
    stats.cacheRefreshRate = ctx.counterRate(state, 'cacheRefresh');
    stats.cacheRefreshFailedRate = ctx.counterRate(state, 'cacheRefreshFailed');
    stats.cacheDirtyWrites = 0;
    stats.cacheOldestDirtyMs = 0;
    for (const list of data.dirty.values()) {
      stats.cacheDirtyWrites += list.size;
      for (const pending of list.values()) {
        stats.cacheOldestDirtyMs = Math.max(
          stats.cacheOldestDirtyMs,
          ctx.now - pending.at,
        );
      }
    }
    stats.flushedRate = ctx.counterRate(state, 'flushed');
    stats.flushFailRate = ctx.counterRate(state, 'flushFailed');
  },
};
