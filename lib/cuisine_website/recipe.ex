defmodule CuisineWebsite.Recipe do
  use Ecto.Schema
  import Ecto.Query
  import Ecto.Changeset

  alias CuisineWebsite.Tag
  alias CuisineWebsite.RecipeTag

  schema "recipes" do
    field :is_active, :boolean, default: true
    field :key, :string

    has_many :languages, CuisineWebsite.Recipe.Language
    has_many :ingredients, CuisineWebsite.Recipe.IngredientLanguage
    has_many :recipe_tags, CuisineWebsite.RecipeTag
    has_many :tags, through: [:recipe_tag, :tag]

    timestamps()
  end

  @doc false
  def changeset(recipe, attrs) do
    recipe
    |> cast(attrs, [:key, :is_active])
    |> validate_required([:key, :is_active])
    |> unique_constraint(:key)
  end

  @doc """
  Get all recipes
  """
  def get_recipes(),
    do: Repo.all(from r in Recipe,
      join: t in assoc(t, :tags),
      join: l in assoc(r, :languages),
      join: tl in assoc(t, :languages),
      select: r,
      preload: [tag_languages: tl, languages: l])

  @doc """
  Get all recipes for a tag
  """
  def get_recipes_by_tag(tag),
    do: Repo.all(from r in Recipe,
      join: t in assoc(t, :tags),
      join: l in assoc(r, :languages),
      join: tl in assoc(t, :languages),
      where: t.key == ^tag,
      select: r,
      preload: [tag_languages: tl, languages: l])

  @doc """
  Get recipe by ID
  """
  def get_recipe_by_id(recipe_id, lang),
    do: Repo.all(from r in Recipe, recipe_id,
      join: l in assoc(r, :languages),
      join: i in assoc(r, :ingredients),
      join: g in assoc(i, :groups),
      join: t in assoc(r, :tags),
      join: tl in assoc(t, :languages),
      where: r.id == ^recipe_id and l.lang == ^lang and
        i.lang == ^lang and g.lang == ^lang and tl.lang == ^lang,
      select: r,
      preload: [tag_languages: tl, languages: l, ingredients: i, groups: g])

end
