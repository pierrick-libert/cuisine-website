defmodule CuisineWebsite.RecipeTag do
  use Ecto.Schema
  import Ecto.Changeset

  schema "recipe_tag" do
    field :recipe_id, :id
    field :tag_id, :id

    timestamps()
  end

  @doc false
  def changeset(recipe_tag, attrs) do
    recipe_tag
    |> cast(attrs, [:recipe_id, :tag_id])
    |> validate_required([:recipe_id, :tag_id])
  end
end
