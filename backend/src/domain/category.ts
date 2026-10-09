/**
 * Normalizes a category display name for case-insensitive matching.
 *
 * FR-008: "System MUST treat category names as equivalent regardless of letter case, so that
 * 'Dessert' and 'dessert' resolve to the same category rather than creating a duplicate."
 */
export function normalizeCategoryName(displayName: string): string {
  return displayName.trim().toLowerCase();
}
