const KNOWN_LOCALES: Record<string, string> = { en: 'EN', fr: 'FR' };

interface LocaleTabsProps {
  availableLocales: string[];
  activeLocale: string;
  onSelect: (locale: string) => void;
}

/**
 * Switches which locale's text is being edited (FR-009) and shows which locales already have
 * content, per User Story 3's "indicate which locales have content."
 */
export function LocaleTabs({ availableLocales, activeLocale, onSelect }: LocaleTabsProps) {
  const locales = Array.from(new Set([...Object.keys(KNOWN_LOCALES), ...availableLocales]));

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {locales.map((locale) => {
        const hasContent = availableLocales.includes(locale);
        const isActive = locale === activeLocale;
        return (
          <button
            key={locale}
            type="button"
            aria-pressed={isActive}
            aria-label={`${KNOWN_LOCALES[locale] ?? locale.toUpperCase()}, ${hasContent ? 'has content' : 'no content yet'}`}
            onClick={() => onSelect(locale)}
            style={{
              padding: '7px 14px',
              borderRadius: '8px 8px 0 0',
              border: '1px solid #ddd',
              borderBottom: isActive ? 'none' : '1px solid #ddd',
              background: isActive ? '#fff' : 'transparent',
              fontWeight: isActive ? 700 : 500,
              fontSize: 13,
            }}
          >
            {KNOWN_LOCALES[locale] ?? locale.toUpperCase()}{' '}
            <span aria-hidden="true" style={{ color: hasContent ? '#40704f' : '#bbb' }}>
              {hasContent ? '●' : '○'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
