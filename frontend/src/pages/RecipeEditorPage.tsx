import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { IngredientGroupEditor } from '../components/IngredientGroupEditor.js';
import { StepsEditor } from '../components/StepsEditor.js';
import { CategoryTagPicker } from '../components/CategoryTagPicker.js';
import { LocaleTabs } from '../components/LocaleTabs.js';
import {
  createRecipe,
  deleteRecipe,
  getRecipeRaw,
  updateRecipe,
  type RawLocaleContent,
  type RawRecipeGroup,
} from '../services/recipesApi.js';
import {
  emptyLocaleContent,
  mergeGroupsForDisplay,
  mergeStepsForDisplay,
  splitGroupsFromDisplay,
  splitStepsFromDisplay,
} from '../lib/localeEditing.js';

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: 20,
  marginBottom: 24,
  background: 'var(--color-card-bg)',
};

/** A short "N minute(s)/second(s) ago" relative time, for the "Last saved" status. */
function timeAgo(from: Date, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
}

/**
 * Create (User Story 1), edit/delete (User Story 2), and multi-locale authoring (User Story 3)
 * for a draft recipe.
 *
 * @remarks
 * Structure (ingredient groups/lines' ids/quantities/units, step order) is kept separate from
 * per-locale text (names, descriptions, step rich text) in local state, mirroring the backend's
 * META/LOCALE split (`data-model.md`). This is what lets switching the active locale tab never
 * discard unsaved structural edits — merge/split helpers in `lib/localeEditing.ts` combine the
 * two only for display, and split them apart again on every change.
 */
export function RecipeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [categoryName, setCategoryName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [structureGroups, setStructureGroups] = useState<RawRecipeGroup[]>([]);
  const [stepsOrder, setStepsOrder] = useState<string[]>([]);
  const [activeLocale, setActiveLocale] = useState('en');
  const [localeTexts, setLocaleTexts] = useState<Record<string, RawLocaleContent>>({ en: emptyLocaleContent() });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (isNew || !id) return;
    setLoading(true);
    getRecipeRaw(id)
      .then((raw) => {
        setCategoryName(raw.categoryName ?? '');
        setTags(raw.tags);
        setStructureGroups(raw.ingredientGroups);
        setStepsOrder(raw.stepsOrder);
        setLocaleTexts(raw.locales);
        setActiveLocale(Object.keys(raw.locales)[0] ?? 'en');
      })
      .catch(() => setError('Could not load this recipe.'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const activeText = localeTexts[activeLocale] ?? emptyLocaleContent();

  function updateActiveText(patch: Partial<RawLocaleContent>) {
    setLocaleTexts((prev) => ({ ...prev, [activeLocale]: { ...(prev[activeLocale] ?? emptyLocaleContent()), ...patch } }));
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const input = {
        locale: activeLocale,
        name: activeText.name,
        description: activeText.description,
        categoryName: categoryName || null,
        tags,
        ingredientGroups: mergeGroupsForDisplay(structureGroups, activeText),
        steps: mergeStepsForDisplay(stepsOrder, activeText),
      };
      const recipe = isNew || !id ? await createRecipe(input) : await updateRecipe(id, input);
      setLastSavedAt(new Date());
      navigate(`/recipes/${recipe.recipeId}`, { replace: true });
    } catch {
      // FR-010: saving a partial draft must still be possible — only a genuine validation
      // failure (e.g. missing name, FR-002) should block the save.
      setError('Could not save the recipe. Make sure it has a name.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id || isNew) return;
    if (!window.confirm('Delete this recipe? This cannot be undone.')) return;
    await deleteRecipe(id);
    navigate('/', { replace: true });
  }

  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;

  const displayGroups = mergeGroupsForDisplay(structureGroups, activeText);
  const displaySteps = mergeStepsForDisplay(stepsOrder, activeText);

  return (
    <div style={{ maxWidth: 900, padding: '26px 34px 60px' }}>
      <Link to="/" style={{ display: 'inline-block', marginBottom: 16, fontWeight: 600, fontSize: 13.5 }}>
        ← Back to recipes
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: 6,
              background: 'var(--color-draft-bg)',
              color: 'var(--color-draft-text)',
            }}
          >
            DRAFT
          </span>
          {lastSavedAt && (
            <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
              Last saved {timeAgo(lastSavedAt, new Date())}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!isNew && (
            <button
              type="button"
              onClick={handleDelete}
              style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card-bg)', fontSize: 13.5, fontWeight: 600 }}
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontSize: 13.5 }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      <input
        aria-label="Recipe name"
        value={activeText.name}
        onChange={(e) => updateActiveText({ name: e.target.value })}
        placeholder="Recipe name"
        style={{
          width: '100%',
          fontSize: 26,
          fontWeight: 700,
          border: 'none',
          background: 'transparent',
          outline: 'none',
          padding: '0 0 14px',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 22,
          color: 'var(--color-text)',
        }}
      />

      <div style={{ marginBottom: 16 }}>
        <LocaleTabs
          availableLocales={Object.keys(localeTexts)}
          activeLocale={activeLocale}
          onSelect={setActiveLocale}
        />
      </div>

      <textarea
        aria-label="Description"
        value={activeText.description}
        onChange={(e) => updateActiveText({ description: e.target.value })}
        placeholder="Description"
        style={{
          width: '100%',
          minHeight: 60,
          marginBottom: 20,
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 10,
          fontSize: 13.5,
        }}
      />

      <div style={cardStyle}>
        <CategoryTagPicker
          categoryName={categoryName}
          onCategoryChange={setCategoryName}
          tags={tags}
          onTagsChange={setTags}
        />
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, margin: '0 0 16px' }}>Ingredients</h2>
        <IngredientGroupEditor
          groups={displayGroups}
          onChange={(groups) => {
            const { structure, groupNames, ingredientNames } = splitGroupsFromDisplay(groups);
            setStructureGroups(structure);
            updateActiveText({ groupNames, ingredientNames });
          }}
        />
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, margin: '0 0 16px' }}>Method</h2>
        <StepsEditor
          steps={displaySteps}
          onChange={(steps) => {
            const { stepsOrder: order, steps: stepTexts } = splitStepsFromDisplay(steps);
            setStepsOrder(order);
            updateActiveText({ steps: stepTexts });
          }}
        />
      </div>
    </div>
  );
}
