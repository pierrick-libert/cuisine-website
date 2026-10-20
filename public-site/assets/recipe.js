// Alpine.js component powering client-side servings scaling on the recipe detail page
// (005-recipe-media-details User Story 3). Loaded as a plain script (not a module), same pattern
// as browse.js, so `recipeDetail` is available as a global before Alpine (deferred) evaluates
// `x-data="recipeDetail(...)"` in recipe-detail.njk.
//
// Only loaded/used when the recipe has a baseServings count — a recipe with none keeps 004's
// static ingredient rendering with no client-side state at all.
function recipeDetail(groups, baseServings) {
  return {
    groups,
    baseServings,
    servings: baseServings,
    inc() {
      this.servings += 1;
    },
    dec() {
      this.servings = Math.max(1, this.servings - 1);
    },
    // Rounds to at most one decimal place, with a trailing ".0" dropped — matching the approved
    // mockup's own fmt()/renderVals() prototype (spec.md's rounding rule, FR-008).
    fmt(n) {
      return String(Math.round(n * 10) / 10);
    },
    scaledQuantity(line) {
      return this.fmt(line.quantity * (this.servings / this.baseServings));
    },
    scaledApprox(line) {
      return this.fmt(line.approxEquivalent.quantity * (this.servings / this.baseServings));
    },
  };
}
