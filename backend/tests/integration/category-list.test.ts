import { beforeAll, describe, expect, it } from 'vitest';
import { findOrCreateCategory, listCategories } from '../../src/repository/category-repository.js';
import { ensureTable } from './helpers.js';

describe('listCategories (004, category-shell reconciliation)', () => {
  beforeAll(ensureTable);

  it('lists every category, including one just created', async () => {
    const category = await findOrCreateCategory('Breakfasts And Brunch');

    const all = await listCategories();

    expect(all.find((c) => c.categoryId === category.categoryId)).toEqual(category);
  });
});
