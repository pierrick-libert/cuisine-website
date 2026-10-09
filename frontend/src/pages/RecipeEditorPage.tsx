import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { IngredientGroupEditor } from '../components/IngredientGroupEditor.js';
import { StepsEditor } from '../components/StepsEditor.js';
import { CategoryTagPicker } from '../components/CategoryTagPicker.js';
import {
  createRecipe,
  deleteRecipe,
  getRecipe,
  updateRecipe,
  type IngredientGroup,
  type RecipeInput,
  type Step,
} from '../services/recipesApi.js';

/**
 * Create (User Story 1) and edit/delete (User Story 2) a draft recipe. Multi-locale authoring
 * (User Story 3) extends this page further.
 */
export function RecipeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [ingredientGroups, setIngredientGroups] = useState<IngredientGroup[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew || !id) return;
    setLoading(true);
    getRecipe(id)
      .then((recipe) => {
        setName(recipe.name);
        setDescription(recipe.description);
        setCategoryName(recipe.categoryId ?? ''); // categoryId displayed until a name-lookup exists
        setTags(recipe.tags);
        setIngredientGroups(recipe.ingredientGroups);
        setSteps(recipe.steps);
      })
      .catch(() => setError('Could not load this recipe.'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const input: RecipeInput = {
        locale: 'en',
        name,
        description,
        categoryName: categoryName || null,
        tags,
        ingredientGroups,
        steps,
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

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <input
          aria-label="Recipe name"
          value={name}
          onChange={(e) => setName(e.target.value)}
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

      <textarea
        aria-label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
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
      <IngredientGroupEditor groups={ingredientGroups} onChange={setIngredientGroups} />

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Method</h2>
      <StepsEditor steps={steps} onChange={setSteps} />
    </div>
  );
}
