defmodule CuisineWebsite.Tag do
  use Ecto.Schema
  import Ecto.Changeset

  schema "tags" do
    field :key, :string

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
