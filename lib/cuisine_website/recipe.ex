defmodule CuisineWebsite.Recipe do
  use Ecto.Schema
  import Ecto.Changeset

  schema "recipes" do
    field :is_active, :boolean, default: true
    field :key, :string

    timestamps()
  end

  @doc false
  def changeset(recipe, attrs) do
    recipe
    |> cast(attrs, [:key, :is_active])
    |> validate_required([:key, :is_active])
    |> unique_constraint(:key)
  end
end
