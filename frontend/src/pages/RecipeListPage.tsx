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
    <div style={{ maxWidth: 900, padding: '26px 34px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Recipes</h1>
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
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
      {!recipes && !error && <p>Loading…</p>}
      {recipes?.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No recipes yet.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {recipes?.map((recipe) => (
          <Link
            key={recipe.recipeId}
            to={`/recipes/${recipe.recipeId}`}
            style={{
              display: 'block',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              background: 'var(--color-card-bg)',
              padding: '14px 18px',
              color: 'var(--color-text)',
              fontWeight: 600,
              fontSize: 14.5,
            }}
          >
            {recipe.name || '(untitled)'}
          </Link>
        ))}
      </div>
    </div>
  );
}
