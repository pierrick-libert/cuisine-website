import { ulid } from 'ulid';

/** Generates a sortable-by-creation-time unique id, per research.md's ID generation decision. */
export function generateId(): string {
  return ulid();
}
