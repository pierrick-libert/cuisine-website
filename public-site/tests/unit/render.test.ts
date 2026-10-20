import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderCategoryShellPage, renderHomePage, renderRecipePage } from '../../src/render.js';

describe('renderRecipePage (004, research.md "Rendering recipes with Eleventy inside a Lambda task")', () => {
  it('renders a full HTML page from recipe data', async () => {
    const html = await renderRecipePage({
      locale: 'en',
      title: "Grandma's Apple Tart",
      description: 'A classic.',
      ingredientGroups: [{ name: null, lines: [{ text: '250g flour' }] }],
      stepsHtml: ['<p>Mix the flour.</p>'],
      category: null,
      locales: [],
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
      category: null,
      locales: [],
    });

    expect(html).not.toContain('<p></p>');
  });

  it('shows a category badge linking to the category shell, when the recipe has a category', async () => {
    const html = await renderRecipePage({
      locale: 'en',
      title: 'Apple Tart',
      description: '',
      ingredientGroups: [],
      stepsHtml: [],
      category: { name: 'Desserts', slug: 'desserts' },
      locales: [],
    });

    expect(html).toContain('Desserts');
    expect(html).toContain('/en/categories/desserts.html');
  });

  it('renders a locale switcher, disabling locales the recipe has no page in', async () => {
    const html = await renderRecipePage({
      locale: 'en',
      title: 'Apple Tart',
      description: '',
      ingredientGroups: [],
      stepsHtml: [],
      category: null,
      locales: [
        { locale: 'en', label: 'EN', href: '/en/recipes/apple-tart-abc123.html' },
        { locale: 'fr', label: 'FR', href: null },
      ],
    });

    expect(html).toContain('/en/recipes/apple-tart-abc123.html');
    expect(html).toContain('EN');
    expect(html).toContain('FR');
  });
});

describe('TEMPLATES_DIR resolution in a bundled Lambda (Critical: template bundling)', () => {
  it('resolves templates relative to LAMBDA_TASK_ROOT when deployed, not the (bundled-away) source tree', async () => {
    // A deliberately DIFFERENT template from the real one, so this only passes if the code
    // actually reads from LAMBDA_TASK_ROOT — simulates infra/pipeline.ts's copyFiles placing
    // templates/ at the function package root (the real deployed layout, where
    // import.meta.url-relative resolution would point at a location esbuild's single-file
    // bundle doesn't have, since no copyFiles step touches a bundled Lambda's source tree).
    const taskRoot = mkdtempSync(path.join(tmpdir(), 'lambda-task-root-'));
    const templatesDir = path.join(taskRoot, 'templates');
    mkdirSync(templatesDir, { recursive: true });
    writeFileSync(path.join(templatesDir, 'recipe-detail.njk'), 'FAKE TASK ROOT TEMPLATE: {{ recipe.title }}');
    process.env.LAMBDA_TASK_ROOT = taskRoot;

    try {
      // Re-import so the module re-evaluates TEMPLATES_DIR against the env var just set.
      vi.resetModules();
      const { renderRecipePage: renderWithTaskRoot } = await import('../../src/render.js');
      const html = await renderWithTaskRoot({
        locale: 'en',
        title: 'Task Root Recipe',
        description: '',
        ingredientGroups: [],
        stepsHtml: [],
        category: null,
        locales: [],
      });
      expect(html).toBe('FAKE TASK ROOT TEMPLATE: Task Root Recipe');
    } finally {
      delete process.env.LAMBDA_TASK_ROOT;
      rmSync(taskRoot, { recursive: true, force: true });
      vi.resetModules();
    }
  });
});

describe('renderCategoryShellPage (004, User Story 4)', () => {
  it('renders a category shell page wired to the given locale and slug', async () => {
    const html = await renderCategoryShellPage({
      locale: 'en',
      name: 'Desserts',
      slug: 'desserts',
      locales: [],
    });

    expect(html).toContain('<html lang="en">');
    expect(html).toContain('Desserts');
    expect(html).toContain("categoryBrowse('en', 'desserts')");
  });

  it('renders a locale switcher on the category shell page', async () => {
    const html = await renderCategoryShellPage({
      locale: 'en',
      name: 'Desserts',
      slug: 'desserts',
      locales: [
        { locale: 'en', label: 'EN', href: '/en/categories/desserts.html' },
        { locale: 'fr', label: 'FR', href: '/fr/categories/desserts.html' },
      ],
    });

    expect(html).toContain('/fr/categories/desserts.html');
    expect(html).toContain('FR');
  });
});

describe('renderHomePage (004, Important 15 - a public-site entry point)', () => {
  it('renders a locale home page linking every given category and wiring a locale-wide search', async () => {
    const html = await renderHomePage({
      locale: 'en',
      categories: [
        { name: 'Desserts', slug: 'desserts' },
        { name: 'Mains', slug: 'mains' },
      ],
      locales: [],
    });

    expect(html).toContain('<html lang="en">');
    expect(html).toContain('/en/categories/desserts.html');
    expect(html).toContain('/en/categories/mains.html');
    // null, not a specific category slug — a locale-wide search, not scoped to one category.
    expect(html).toContain("categoryBrowse('en', null)");
  });

  it('renders a locale switcher on the home page', async () => {
    const html = await renderHomePage({
      locale: 'en',
      categories: [],
      locales: [
        { locale: 'en', label: 'EN', href: '/en/index.html' },
        { locale: 'fr', label: 'FR', href: '/fr/index.html' },
      ],
    });

    expect(html).toContain('/fr/index.html');
    expect(html).toContain('FR');
  });
});
