defmodule CuisineWebsite.Tag.Language do
  use Ecto.Schema
  import Ecto.Changeset

  schema "tag_languages" do
    field :lang, :string
    field :name, :string
    field :tag_id, :id

    timestamps()
  end

  @doc false
  def changeset(language, attrs) do
    language
    |> cast(attrs, [:lang, :name, :tag_id])
    |> validate_required([:lang, :name, :tag_id])
  end
end
