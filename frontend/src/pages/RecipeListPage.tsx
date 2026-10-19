import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { listRecipes, type RecipeSummary } from '../services/recipesApi.js';
import { PublishToggle } from '../components/PublishToggle.js';
import {
  getPublishStatus,
  startPublish,
  startUnpublish,
  PublishRequestError,
  type PipelineStatusResponse,
} from '../services/publishApi.js';

const STATUS_POLL_INTERVAL_MS = 3000;

const PUBLISH_STATUS_LABEL: Record<RecipeSummary['publishStatus'], string> = {
  not_published: 'Not published',
  live: 'Live',
  publishing: 'Publishing…',
  unpublishing: 'Unpublishing…',
};

/** Shows saved draft recipes (User Story 1's "reopen a previously saved draft") and the
 * 004-publish-pipeline-and Publish/Unpublish controls. */
export function RecipeListPage() {
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function refreshRecipes() {
    listRecipes()
      .then(setRecipes)
      .catch(() => setError('Could not load recipes.'));
  }

  useEffect(() => {
    refreshRecipes();
    getPublishStatus()
      .then(setPipelineStatus)
      .catch(() => {
        /* Non-fatal — the recipe list itself still works without a status display. */
      });
  }, []);

  // Poll GET /publish-status while a run is in progress (FR-008/FR-009) — a full run can exceed
  // a normal request's lifetime, so Publish/Unpublish are fire-and-forget (contracts/publish-api.md).
  useEffect(() => {
    if (!pipelineStatus?.running) {
      if (pollTimer.current) clearInterval(pollTimer.current);
      return;
    }
    pollTimer.current = setInterval(() => {
      getPublishStatus()
        .then((status) => {
          setPipelineStatus(status);
          // Refresh throughout the run, not only once it finishes, so per-recipe
          // "Publishing…"/"Unpublishing…" statuses (FR-008) are actually visible while in progress.
          refreshRecipes();
        })
        .catch(() => {
          /* Keep polling on a transient failure rather than abandoning the in-progress run's display. */
        });
    }, STATUS_POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [pipelineStatus?.running]);

  async function runAction(action: 'publish' | 'unpublish') {
    setActionError(null);
    try {
      const result = action === 'publish' ? await startPublish() : await startUnpublish();
      if (result.status === 'started') {
        setPipelineStatus({ running: true, action, startedAt: new Date().toISOString(), lastResult: null });
      } else {
        setActionError(`No recipes are currently toggled on — nothing to ${action}.`);
      }
    } catch (err) {
      if (err instanceof PublishRequestError && err.status === 409) {
        setActionError('A publish or unpublish run is already in progress.');
      } else {
        setActionError('Could not start the run. Please try again.');
      }
    }
  }

  function handleToggled(recipeId: string, selectedForNextPublish: boolean) {
    setRecipes((current) =>
      current?.map((recipe) => (recipe.recipeId === recipeId ? { ...recipe, selectedForNextPublish } : recipe)) ?? current,
    );
  }

  return (
    <div style={{ maxWidth: 900, padding: '26px 34px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Recipes</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="button" disabled={pipelineStatus?.running} onClick={() => runAction('unpublish')}>
            Unpublish
          </button>
          <button type="button" disabled={pipelineStatus?.running} onClick={() => runAction('publish')}>
            Publish
          </button>
          <Link
            to="/recipes/new"
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              background: 'var(--color-accent)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13.5,
            }}
          >
            + New recipe
          </Link>
        </div>
      </div>
      {pipelineStatus?.running && <p>A {pipelineStatus.action} run is in progress…</p>}
      {/* FR-010 requires a failed run to be clearly visible — not just a silent status revert. */}
      {!pipelineStatus?.running && pipelineStatus?.lastResult === 'failed' && (
        <p style={{ color: 'var(--color-danger)' }}>
          The last {pipelineStatus.action} run failed. Recipes that didn't complete have been reverted to their
          previous state; re-toggle and try again.
        </p>
      )}
      {!pipelineStatus?.running && pipelineStatus?.lastResult === 'succeeded' && (
        <p style={{ color: 'var(--color-text-muted)' }}>The last {pipelineStatus.action} run succeeded.</p>
      )}
      {actionError && <p style={{ color: 'var(--color-danger)' }}>{actionError}</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
      {!recipes && !error && <p>Loading…</p>}
      {recipes?.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No recipes yet.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {recipes?.map((recipe) => (
          <div
            key={recipe.recipeId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              background: 'var(--color-card-bg)',
              padding: '14px 18px',
            }}
          >
            <PublishToggle
              recipeId={recipe.recipeId}
              selected={recipe.selectedForNextPublish}
              onToggled={(selected) => handleToggled(recipe.recipeId, selected)}
            />
            <Link
              to={`/recipes/${recipe.recipeId}`}
              style={{ flex: 1, color: 'var(--color-text)', fontWeight: 600, fontSize: 14.5 }}
            >
              {recipe.name || '(untitled)'}
            </Link>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {PUBLISH_STATUS_LABEL[recipe.publishStatus]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
