/**
 * The project's currently-supported locales (matches `frontend/src/components/LocaleTabs.tsx`'s
 * `KNOWN_LOCALES`, and 003-translation-drafting's fr→en-only translation flow).
 *
 * @remarks
 * `Locale` itself (domain/types.ts) is deliberately an open `string`, not this fixed list — a
 * recipe can carry content in any locale tag. This constant exists only so
 * `rebuild-index.ts` can rebuild a *stale-but-currently-empty* locale's `browse-index.json` and
 * reconcile its category shells (Important 11 from code review: a locale dropping to zero live
 * recipes must not leave its last-generated index/shells stuck showing deleted content). Adding
 * a new locale to the project means adding it here too.
 */
export const SUPPORTED_LOCALES = ['en', 'fr'] as const;
