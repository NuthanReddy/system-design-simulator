import type { NodeConfig, NodeStats, SimNode } from '../sim/types';

export interface CacheAdvice {
  evidence: 'observed' | 'risk';
  text: string;
  remedy: string;
  tradeoff: string;
  patch?: Partial<NodeConfig>;
  action?: string;
}

export function cacheAdvice(node: SimNode, stats?: NodeStats): CacheAdvice | null {
  if (
    node.kind !== 'cache' ||
    !node.config.cacheReadPolicy ||
    node.config.cacheReadPolicy === 'legacy'
  )
    return null;
  if (stats?.cacheOriginConnected === false && stats.arrivalRate > 0) {
    return {
      evidence: 'observed',
      text: `${node.label} has no unique backing Database; managed operations cannot be routed.`,
      remedy:
        'Connect this cache to exactly one Database. For cache-aside, connect the API to the same Database too. Use one managed cache for that branch.',
      tradeoff:
        'Other database dependencies still fan out independently; they are not automatically cached.',
    };
  }
  if ((stats?.cacheStaleRate ?? 0) > 0) {
    return {
      evidence: 'observed',
      text: `${node.label} returned ${(stats?.cacheStaleRate ?? 0).toFixed(1)} stale reads/s in the measurement window; a newer committed database version existed.`,
      remedy:
        'Remove invalidation delay, then replay the same load and fault schedule to compare stale reads and database traffic.',
      tradeoff:
        'Immediate invalidation trades fewer stale reads for more cache misses and database work. The modeled notification is idealized, not a real coherence protocol.',
      patch: { cacheInvalidationMs: 0 },
      action: 'Apply immediate invalidation',
    };
  }
  if ((stats?.flushFailRate ?? 0) > 0) {
    return {
      evidence: 'observed',
      text: `${node.label} failed ${(stats?.flushFailRate ?? 0).toFixed(1)} buffered database writes/s after acknowledging memory.`,
      remedy:
        'Wait for database acknowledgment with write-through, then replay the same crash and compare failed writes and latency.',
      tradeoff:
        'Write-through exposes database latency and unavailability to callers. It does not repair previously lost writes or guarantee disk durability.',
      patch: { cacheWritePolicy: 'write-through' },
      action: 'Apply write-through',
    };
  }
  if (node.config.cacheWritePolicy === 'write-back') {
    return {
      evidence: 'risk',
      text: `${node.label} acknowledges writes before its ${(node.config.flushDelayMs ?? 200).toFixed(0)} ms flush residence and database work complete.`,
      remedy:
        'Test a cache crash while dirty writes are visible. Choose write-through if the measured latency cost is acceptable.',
      tradeoff:
        'This is a configuration risk, not proof of data loss in this run. Buffered writes are volatile; a cache instance count is not modeled as replicated persistence.',
      patch: { cacheWritePolicy: 'write-through' },
      action: 'Apply write-through',
    };
  }
  return null;
}
