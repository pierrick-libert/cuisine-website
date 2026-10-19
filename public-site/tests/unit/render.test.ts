import { describe, expect, it } from 'vitest';
import { renderRecipePage } from '../../src/render.js';

describe('renderRecipePage (004, research.md "Rendering recipes with Eleventy inside a Lambda task")', () => {
  it('renders a full HTML page from recipe data', async () => {
    const html = await renderRecipePage({
      locale: 'en',
      title: "Grandma's Apple Tart",
      description: 'A classic.',
      ingredientGroups: [{ name: null, lines: [{ text: '250g flour' }] }],
      stepsHtml: ['<p>Mix the flour.</p>'],
    });

    expect(html).toContain('<html lang="en">');
    // Nunjucks auto-escapes interpolated values by default — the apostrophe becomes an entity.
    expect(html).toContain('Grandma&#39;s Apple Tart');
    expect(html).toContain('250g flour');
    expect(html).toContain('<p>Mix the flour.</p>');
  });

  it('omits the description paragraph when empty', async () => {
    const html = await renderRecipePage({
      locale: 'fr',
      title: 'Soupe',
      description: '',
      ingredientGroups: [],
      stepsHtml: [],
    });

    expect(html).not.toContain('<p></p>');
  });
});
