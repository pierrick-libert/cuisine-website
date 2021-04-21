defmodule CuisineWebsite.Recipe.GroupIngredientLanguage do
  use Ecto.Schema
  import Ecto.Changeset

  schema "recipe_group_ingredient_languages" do
    field :ingredient, :string
    field :lang, :string
    field :quantity, :decimal
    field :unit, :string
    belongs_to :recipe_ingredient_language_id, CuisineWebsite.Recipe.IngredientLanguage

    timestamps()
  end

  @doc false
  def changeset(group_ingredient_language, attrs) do
    group_ingredient_language
    |> cast(attrs, [:lang, :quantity, :unit, :ingredient, :recipe_ingredient_language_id])
    |> validate_required([:lang, :quantity, :unit, :ingredient, :recipe_ingredient_language_id])
  end
end
