defmodule CuisineWebsite.Recipe.IngredientLanguage do
  use Ecto.Schema
  import Ecto.Changeset

  schema "recipe_ingredient_languages" do
    field :lang, :string
    field :name, :string
    field :recipe_id, :id

    timestamps()
  end

  @doc false
  def changeset(ingredient_language, attrs) do
    ingredient_language
    |> cast(attrs, [:lang, :name, :recipe_id])
    |> validate_required([:lang, :name, :recipe_id])
  end
end
