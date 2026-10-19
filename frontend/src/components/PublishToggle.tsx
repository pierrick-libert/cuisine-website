import { useState } from 'react';
import { setRecipePublishToggle } from '../services/publishApi.js';

interface PublishToggleProps {
  recipeId: string;
  /** The recipe's current `selectedForNextPublish` value (004-publish-pipeline-and FR-001). */
  selected: boolean;
  /** Called with the new value once the toggle is confirmed saved. Never called on failure. */
  onToggled: (selected: boolean) => void;
}

/**
 * The one-shot "included in the next Publish/Unpublish run" toggle for one recipe
 * (004-publish-pipeline-and FR-001). Self-contained: owns its own pending/error state, mirroring
 * 003's `TranslationDraftButton` pattern, so it never needs the full recipe list rendered to be
 * tested.
 */
export function PublishToggle({ recipeId, selected, onToggled }: PublishToggleProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange() {
    const next = !selected;
    setError(null);
    setPending(true);
    try {
      const result = await setRecipePublishToggle(recipeId, next);
      onToggled(result.selectedForNextPublish);
    } catch {
      setError('Could not update the publish selection. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
      <input type="checkbox" checked={selected} disabled={pending} onChange={handleChange} />
      {error && <span style={{ fontSize: 11, color: 'var(--color-danger)' }}>{error}</span>}
    </div>
  );
}
