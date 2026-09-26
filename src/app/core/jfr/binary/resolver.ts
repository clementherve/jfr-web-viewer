import { ConstantRef, type ConstantPools, type DecodedValue } from './jfr-types';

/**
 * Builds a `resolve` function that recursively dereferences ConstantRef nodes
 * against the given pools. Resolved pool entries are memoized by
 * `classId:index`, so a stack trace (or method, class, symbol, thread, ...)
 * shared by thousands of samples is only ever walked and rebuilt once.
 */
export function createResolver(pools: ConstantPools): (value: DecodedValue) => DecodedValue {
  const memo = new Map<string, DecodedValue>();
  const inProgress = new Set<string>();

  function resolve(value: DecodedValue): DecodedValue {
    if (value instanceof ConstantRef) {
      const key = `${value.classId}:${value.index}`;
      const cached = memo.get(key);
      if (cached !== undefined) return cached;
      if (inProgress.has(key)) return null; // cyclic reference guard
      inProgress.add(key);
      const raw = pools.get(value.classId)?.get(value.index);
      const resolved = raw === undefined ? null : resolve(raw);
      inProgress.delete(key);
      memo.set(key, resolved);
      return resolved;
    }
    if (Array.isArray(value)) {
      return value.map(resolve);
    }
    if (value !== null && typeof value === 'object') {
      const obj: { [k: string]: DecodedValue } = {};
      for (const k of Object.keys(value)) {
        obj[k] = resolve((value as { [k: string]: DecodedValue })[k]);
      }
      return obj;
    }
    return value;
  }

  return resolve;
}
