import { ulid } from 'ulid';

/**
 * Generates a new unique id (a ULID — ulid.org), lexicographically sortable by creation time.
 *
 * @remarks
 * Used for every entity id in this feature (`recipeId`, `categoryId`, `groupId`, `lineId`, step
 * ids) — see `research.md`'s "ID generation" decision for why ULIDs over UUIDv4.
 *
 * @returns A new, globally unique id.
 */
export function generateId(): string {
  return ulid();
}
