import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
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

/**
 * Create (User Story 1), edit/delete (User Story 2), and multi-locale authoring (User Story 3)
 * for a draft recipe.
 *
 * Structure (ingredient groups/lines' ids/quantities/units, step order) is kept separate from
 * per-locale text (names, descriptions, step rich text) in local state, mirroring the backend's
 * META/LOCALE split (data-model.md). This is what lets switching the active locale tab never
 * discard unsaved structural edits — merge/split helpers in lib/localeEditing.ts combine the two
 * only for display, and split them apart again on every change.
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

  useEffect(() => {
    if (isNew || !id) return;
    setLoading(true);
    getRecipeRaw(id)
      .then((raw) => {
        setCategoryName(raw.categoryId ?? ''); // categoryId shown until a name-lookup exists
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
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <input
          aria-label="Recipe name"
          value={activeText.name}
          onChange={(e) => updateActiveText({ name: e.target.value })}
          placeholder="Recipe name"
          style={{ fontSize: 24, fontWeight: 700, border: 'none', flex: 1 }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          {!isNew && (
            <button type="button" onClick={handleDelete} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #ccc', background: '#fff' }}>
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#40704f', color: '#fff', fontWeight: 700 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {error && <p style={{ color: '#b3261e' }}>{error}</p>}

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
        style={{ width: '100%', minHeight: 60, marginBottom: 20 }}
      />

      <div style={{ marginBottom: 20 }}>
        <CategoryTagPicker
          categoryName={categoryName}
          onCategoryChange={setCategoryName}
          tags={tags}
          onTagsChange={setTags}
        />
      </div>

      <h2 style={{ fontSize: 18 }}>Ingredients</h2>
      <IngredientGroupEditor
        groups={displayGroups}
        onChange={(groups) => {
          const { structure, groupNames, ingredientNames } = splitGroupsFromDisplay(groups);
          setStructureGroups(structure);
          updateActiveText({ groupNames, ingredientNames });
        }}
      />

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Method</h2>
      <StepsEditor
        steps={displaySteps}
        onChange={(steps) => {
          const { stepsOrder: order, steps: stepTexts } = splitStepsFromDisplay(steps);
          setStepsOrder(order);
          updateActiveText({ steps: stepTexts });
        }}
      />
    </div>
  );
}
