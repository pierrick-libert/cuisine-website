// @ts-expect-error — @11ty/eleventy ships no type declarations.
import Eleventy from '@11ty/eleventy';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Named currentDir, not __dirname — esbuild auto-injects its own `__dirname` shim into any
// Node-ESM bundle that references that identifier anywhere, colliding with a user-declared one
// of the same name ("Identifier '__dirname' has already been declared" — found via a real
// deployed CLP-RenderRecipe invocation).
const currentDir = path.dirname(fileURLToPath(import.meta.url));
// In a deployed Lambda, SST's esbuild bundles this module into a single file and copies
// templates/ to the function package root via `copyFiles` (infra/pipeline.ts) — `import.meta.url`
// no longer points anywhere near the original source tree, so AWS's own `LAMBDA_TASK_ROOT` (set
// to the package root at runtime) is used instead when present. Locally/in tests, where this
// module runs straight from source with no bundling, `LAMBDA_TASK_ROOT` is unset and the
// source-relative path is used.
const TEMPLATES_DIR = process.env.LAMBDA_TASK_ROOT
  ? path.join(process.env.LAMBDA_TASK_ROOT, 'templates')
  : path.join(currentDir, '..', 'templates');

export interface RecipeRenderData {
  locale: string;
  title: string;
  description: string;
  ingredientGroups: Array<{ name: string | null; lines: Array<{ text: string }> }>;
  /** Each step's rich text, already rendered to HTML by `render-rich-text.ts`. */
  stepsHtml: string[];
}

/**
 * Renders one recipe's detail page via `templates/recipe-detail.njk`.
 *
 * @remarks
 * Uses Eleventy's programmatic `toJSON()` API (renders in memory, writes nothing to disk) rather
 * than its normal whole-site `write()` build, so a Lambda task can render exactly one recipe per
 * invocation (research.md's "Rendering recipes with Eleventy inside a Lambda task") — the caller
 * (`backend/src/pipeline/render-recipe.ts`) uploads the returned HTML to S3 itself.
 *
 * @param data - The recipe's content, already locale-resolved and rich-text-rendered.
 * @returns The rendered HTML page.
 */
export async function renderRecipePage(data: RecipeRenderData): Promise<string> {
  const eleventy = new Eleventy(TEMPLATES_DIR, undefined, {
    quietMode: true,
    config(eleventyConfig: { addGlobalData: (name: string, data: unknown) => void }) {
      eleventyConfig.addGlobalData('recipe', data);
    },
  });

  const results = (await eleventy.toJSON()) as Array<{ inputPath: string; content: string }>;
  const page = results.find((r) => r.inputPath.endsWith('recipe-detail.njk'));
  if (!page) throw new Error('recipe-detail.njk did not render.');
  return page.content;
}

export interface CategoryShellRenderData {
  locale: string;
  name: string;
  slug: string;
}

/**
 * Renders one category's shell page via `templates/category-shell.njk` (User Story 4) — mostly
 * static chrome; the actual recipe listing is fetched and filtered client-side by
 * `assets/browse.js` against that locale's `browse-index.json`
 * (`contracts/public-site-index.md`).
 */
export async function renderCategoryShellPage(data: CategoryShellRenderData): Promise<string> {
  const eleventy = new Eleventy(TEMPLATES_DIR, undefined, {
    quietMode: true,
    config(eleventyConfig: { addGlobalData: (name: string, data: unknown) => void }) {
      eleventyConfig.addGlobalData('category', data);
    },
  });

  const results = (await eleventy.toJSON()) as Array<{ inputPath: string; content: string }>;
  const page = results.find((r) => r.inputPath.endsWith('category-shell.njk'));
  if (!page) throw new Error('category-shell.njk did not render.');
  return page.content;
}

export interface HomePageRenderData {
  locale: string;
  categories: Array<{ name: string; slug: string }>;
}

/**
 * Renders one locale's home page via `templates/home.njk` (Important 15 from code review — the
 * public site previously had no reachable entry point at all; a visitor needed to already know a
 * direct recipe or category URL). Links every given category and wires a locale-wide search
 * (`categoryBrowse(locale, null)`, not scoped to one category) over `browse-index.json`.
 */
export async function renderHomePage(data: HomePageRenderData): Promise<string> {
  const eleventy = new Eleventy(TEMPLATES_DIR, undefined, {
    quietMode: true,
    config(eleventyConfig: { addGlobalData: (name: string, data: unknown) => void }) {
      eleventyConfig.addGlobalData('home', data);
    },
  });

  const results = (await eleventy.toJSON()) as Array<{ inputPath: string; content: string }>;
  const page = results.find((r) => r.inputPath.endsWith('home.njk'));
  if (!page) throw new Error('home.njk did not render.');
  return page.content;
}
