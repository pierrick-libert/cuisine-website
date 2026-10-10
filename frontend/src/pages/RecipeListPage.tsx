import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listRecipes, type RecipeSummary } from '../services/recipesApi.js';

/** Shows saved draft recipes (User Story 1's "reopen a previously saved draft"). */
export function RecipeListPage() {
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRecipes()
      .then(setRecipes)
      .catch(() => setError('Could not load recipes.'));
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24 }}>Recipes</h1>
        <Link to="/recipes/new" style={{ padding: '9px 18px', borderRadius: 8, background: '#40704f', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
          + New recipe
        </Link>
      </div>
      {error && <p style={{ color: '#b3261e' }}>{error}</p>}
      {!recipes && !error && <p>Loading…</p>}
      {recipes?.length === 0 && <p>No recipes yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {recipes?.map((recipe) => (
          <li key={recipe.recipeId} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
            <Link to={`/recipes/${recipe.recipeId}`} style={{ textDecoration: 'none', color: 'inherit', fontWeight: 600 }}>
              {recipe.name || '(untitled)'}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
