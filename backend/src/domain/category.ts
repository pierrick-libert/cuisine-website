/**
 * Normalizes a category display name for case-insensitive matching.
 *
 * @remarks
 * FR-008: "System MUST treat category names as equivalent regardless of letter case, so that
 * 'Dessert' and 'dessert' resolve to the same category rather than creating a duplicate."
 *
 * @param displayName - The category name as entered by the editor.
 * @returns The lowercased, trimmed form used as {@link Category.normalizedName}.
 */
export function normalizeCategoryName(displayName: string): string {
  return displayName.trim().toLowerCase();
}
