defmodule CuisineWebsite.RecipeTag do
  use Ecto.Schema
  import Ecto.Changeset

  schema "recipe_tag" do
    belongs_to :recipe_id, CuisineWebsite.Recipe
    belongs_to :tag_id, CuisineWebsite.Tag

    timestamps()
  end

  @doc false
  def changeset(recipe_tag, attrs) do
    recipe_tag
    |> cast(attrs, [:recipe_id, :tag_id])
    |> validate_required([:recipe_id, :tag_id])
  end
end
