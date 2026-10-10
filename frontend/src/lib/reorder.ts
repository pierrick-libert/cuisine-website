/**
 * Moves the item at `index` by `delta` positions, returning a new array.
 *
 * @remarks
 * Out-of-range moves are no-ops (returns the original array), so a caller can always safely call
 * this from a "move up"/"move down" button without bounds-checking first.
 *
 * @param list - The array to reorder; never mutated.
 * @param index - The index of the item to move.
 * @param delta - The number of positions to move by (e.g. `-1` = up, `+1` = down).
 * @returns A new array with the item moved, or `list` unchanged if the move is out of range.
 */
export function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item as T);
  return next;
}
