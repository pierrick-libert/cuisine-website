import { useState } from 'react';
import { translateRecipe } from '../services/translationApi.js';
import type { RawLocaleContent } from '../services/recipesApi.js';

interface TranslationDraftButtonProps {
  /** The current (in-browser, possibly unsaved) French content to translate. */
  frenchContent: RawLocaleContent;
  /** Whether the English locale already has any content — gates the overwrite confirmation. */
  hasExistingEnglishContent: boolean;
  /** Called with the translated content on success. Never called on failure or if the owner
   * declines the overwrite confirmation. */
  onDraft: (translated: RawLocaleContent) => void;
}

/**
 * "Generate translation draft" — a single, explicit, French-to-English translation action
 * (003-translation-drafting). Self-contained: owns its own loading/error/confirm-gate state so it
 * never needs the full recipe editor rendered to be tested.
 *
 * @remarks
 * Never persists anything itself (FR-003) — {@link onDraft} only updates in-browser editor state;
 * the owner still uses the existing Save action to keep a draft.
 */
export function TranslationDraftButton({ frenchContent, hasExistingEnglishContent, onDraft }: TranslationDraftButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (hasExistingEnglishContent) {
      const confirmed = window.confirm(
        'This will overwrite the existing English content with a new translation draft. Continue?',
      );
      if (!confirmed) return;
    }

    setError(null);
    setGenerating(true);
    try {
      const translated = await translateRecipe({
        sourceLocale: 'fr',
        targetLocale: 'en',
        name: frenchContent.name,
        description: frenchContent.description,
        groupNames: frenchContent.groupNames,
        ingredientNames: frenchContent.ingredientNames,
        steps: frenchContent.steps,
      });
      onDraft(translated);
    } catch {
      setError('Could not generate a translation. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        type="button"
        disabled={!frenchContent.name.trim() || generating}
        onClick={handleClick}
        style={{
          padding: '7px 13px',
          borderRadius: 7,
          border: '1px solid var(--color-accent-soft-text)',
          background: 'var(--color-accent-soft-bg)',
          color: 'var(--color-accent-soft-text)',
          fontSize: 12.5,
          fontWeight: 700,
        }}
      >
        {generating ? 'Generating…' : 'Generate translation draft (EN)'}
      </button>
      {error && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{error}</span>}
    </div>
  );
}
