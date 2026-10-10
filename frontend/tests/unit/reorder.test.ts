import { describe, expect, it } from 'vitest';
import { move } from '../../src/lib/reorder.js';

describe('move (FR-012, SC-004 — reordering never corrupts unrelated content)', () => {
  it('moves an item up', () => {
    expect(move(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
  });

  it('moves an item down', () => {
    expect(move(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
  });

  it('is a no-op moving the first item up', () => {
    expect(move(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op moving the last item down', () => {
    expect(move(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });

  it('never mutates the input array', () => {
    const input = ['a', 'b', 'c'];
    move(input, 0, 1);
    expect(input).toEqual(['a', 'b', 'c']);
  });

  it('leaves every other item unchanged and in place', () => {
    const input = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const result = move(input, 2, -1);
    expect(result.map((i) => i.id)).toEqual([1, 3, 2, 4]);
  });
});
