import { useState } from 'react';
import { useNavigate } from 'react-router';
import { IngredientGroupEditor } from '../components/IngredientGroupEditor.js';
import { StepsEditor } from '../components/StepsEditor.js';
import { createRecipe, type IngredientGroup, type RecipeInput, type Step } from '../services/recipesApi.js';

/**
 * Create a new draft recipe (User Story 1). Editing an existing recipe (User Story 2) and
 * multi-locale authoring (User Story 3) extend this page in later phases.
 */
export function RecipeEditorPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [tags, setTags] = useState('');
  const [ingredientGroups, setIngredientGroups] = useState<IngredientGroup[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const input: RecipeInput = {
        locale: 'en',
        name,
        description,
        categoryName: categoryName || null,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        ingredientGroups,
        steps,
      };
      const recipe = await createRecipe(input);
      navigate(`/recipes/${recipe.recipeId}`);
    } catch {
      // FR-010: saving a partial draft must still be possible — only a genuine validation
      // failure (e.g. missing name, FR-002) should block the save.
      setError('Could not save the recipe. Make sure it has a name.');
    } finally {
      setSaving(false);
    }
  }

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
        <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#40704f', color: '#fff', fontWeight: 700 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p style={{ color: '#b3261e' }}>{error}</p>}

      <textarea
        aria-label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        style={{ width: '100%', minHeight: 60, marginBottom: 20 }}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          aria-label="Category"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          placeholder="Category"
          style={{ flex: 1, padding: '6px 8px' }}
        />
        <input
          aria-label="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags, comma-separated"
          style={{ flex: 2, padding: '6px 8px' }}
        />
      </div>

      <h2 style={{ fontSize: 18 }}>Ingredients</h2>
      <IngredientGroupEditor groups={ingredientGroups} onChange={setIngredientGroups} />

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Method</h2>
      <StepsEditor steps={steps} onChange={setSteps} />
    </div>
  );
}
