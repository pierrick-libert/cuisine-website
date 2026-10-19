// Alpine.js component powering client-side browse/search/filter (004-publish-pipeline-and User
// Story 4, contracts/public-site-index.md). Loaded as a plain script (not a module) so
// `categoryBrowse` is available as a global before Alpine (deferred) evaluates
// `x-data="categoryBrowse(...)"` — see category-shell.njk and home.njk.
//
// `categorySlug` is optional — home.njk uses `categoryBrowse(locale, null)` for a locale-wide
// search across every published recipe (FR-012), not just one category.
function categoryBrowse(locale, categorySlug) {
  return {
    locale,
    categorySlug,
    query: '',
    recipes: [],
    get filtered() {
      const query = this.query.trim().toLowerCase();
      return this.recipes.filter(
        (recipe) =>
          (!this.categorySlug || recipe.categorySlug === this.categorySlug) &&
          (!query || recipe.title.toLowerCase().includes(query)),
      );
    },
    async load() {
      const response = await fetch(`/${this.locale}/browse-index.json`);
      const data = await response.json();
      this.recipes = data.recipes;
    },
  };
}
