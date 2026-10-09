/**
 * Moves the item at `index` by `delta` positions (e.g. -1 = up, +1 = down), returning a new
 * array. Out-of-range moves are no-ops (returns the original array), so a caller can always
 * safely call this from a "move up"/"move down" button without bounds-checking first.
 */
export function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item as T);
  return next;
}
