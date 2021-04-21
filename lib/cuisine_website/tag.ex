defmodule CuisineWebsite.Tag do
  use Ecto.Schema
  import Ecto.Changeset

  schema "tags" do
    field :key, :string

    has_many :languages, CuisineWebsite.Tag.Language
    has_many :recipe_tags, CuisineWebsite.RecipeTag
    has_many :recipes, through: [:recipe_tag, :recipe]

    timestamps()
  end

  @doc false
  def changeset(tag, attrs) do
    tag
    |> cast(attrs, [:key])
    |> validate_required([:key])
    |> unique_constraint(:key)
  end
end
