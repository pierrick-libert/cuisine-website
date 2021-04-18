defmodule CuisineWebsite.Repo.Migrations.CreateRecipes do
  use Ecto.Migration

  def change do
    create table(:recipes) do
      add :key, :string
      add :is_active, :boolean, default: false, null: false

      timestamps()
    end

    create unique_index(:recipes, [:key])
  end
end
