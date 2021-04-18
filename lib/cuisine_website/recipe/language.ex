defmodule CuisineWebsite.Recipe.Language do
  use Ecto.Schema
  import Ecto.Changeset

  schema "recipe_languages" do
    field :html, :string
    field :lang, :string
    field :recipe_id, :id

    timestamps()
  end

  @doc false
  def changeset(language, attrs) do
    language
    |> cast(attrs, [:lang, :html, :recipe_id])
    |> validate_required([:lang, :html, :recipe_id])
  end
end
